-- Separate validation from append-only audit: conflicting INSERTs must not create phantom events.
create or replace function atraction_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.tenant_id<>old.tenant_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'immutable identity'; end if;
  if old.deleted_at is not null and old.deleted_at<now()-interval '30 days' then raise exception 'restore expired'; end if;
  new.updated_at:=now();
 end if;
 return new;
end $$;
create function atraction_private.record_event() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb; k text:=TG_OP; old_won boolean:=false; new_won boolean:=false; old_value numeric:=0; new_value numeric:=0;
begin
 p:=jsonb_build_object('source',to_jsonb(new)->'source','direction',to_jsonb(new)->'direction','contact_id',to_jsonb(new)->'contact_id');
 if TG_TABLE_NAME='atraction_deals' then
  new_won:=(to_jsonb(new)->>'stage')='4' and new.deleted_at is null;
  if TG_OP='UPDATE' then old_won:=(to_jsonb(old)->>'stage')='4' and old.deleted_at is null;old_value:=coalesce((to_jsonb(old)->>'value')::numeric,0);end if;
  new_value:=coalesce((to_jsonb(new)->>'value')::numeric,0);
  if new_won and not old_won then k:='won';elsif old_won and not new_won then k:='unwon';end if;
  p:=p||jsonb_build_object('value',new_value,'stage',to_jsonb(new)->'stage','revenue_delta',(case when new_won then new_value else 0 end)-(case when old_won then old_value else 0 end));
 end if;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(new.tenant_id,replace(TG_TABLE_NAME,'atraction_',''),new.id,auth.uid(),k,p);
 return new;
end $$;
revoke all on function atraction_private.record_event() from public,anon,authenticated;
do $$ declare n text;begin foreach n in array array['contacts','deals','activities','messages','automations'] loop
 execute format('create trigger atraction_record_%s after insert or update on public.atraction_%s for each row execute function atraction_private.record_event()',n,n);
end loop;end $$;
-- Explicit grants narrow accidental future API access to a private work queue.
revoke all on public.atraction_jobs from anon,authenticated;
create policy jobs_private on public.atraction_jobs for all to authenticated using(false) with check(false);
create unique index atraction_one_owned_space on public.atraction_tenants(owner_id);
create function public.atraction_import_contacts(p_tenant uuid, rows jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(rows)<>'array' or jsonb_array_length(rows)>10000 then raise exception 'invalid import';end if;
 insert into public.atraction_contacts(id,tenant_id,owner_id,name,phone,email,source)
 select (r->>'id')::uuid,p_tenant,auth.uid(),r->>'name',r->>'phone',coalesce(r->>'email',''),coalesce(r->>'source','Planilha') from jsonb_array_elements(rows) r;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.atraction_import_contacts(uuid,jsonb) from public,anon;
grant execute on function public.atraction_import_contacts(uuid,jsonb) to authenticated;
create function public.atraction_export_contacts(p_tenant uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
begin return atraction_private.export_contacts(p_tenant);end $$;
create function atraction_private.export_contacts(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'phone',phone,'email',email,'source',source)),'[]') into result from public.atraction_contacts where tenant_id=t and deleted_at is null;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(t,'contacts',t,auth.uid(),'EXPORT',jsonb_build_object('count',jsonb_array_length(result)));
 return result;
end $$;
revoke all on function atraction_private.export_contacts(uuid),public.atraction_export_contacts(uuid) from public,anon;
grant execute on function atraction_private.export_contacts(uuid),public.atraction_export_contacts(uuid) to authenticated;
-- Free in-database background worker; no network requests, API subscriptions or model usage.
create function atraction_private.background_tasks() returns integer language plpgsql security definer set search_path='' as $$
declare j record;n integer:=0;
begin
 insert into public.atraction_jobs(tenant_id,automation_id,contact_id,due_at)
 select a.tenant_id,a.id,d.contact_id,now() from public.atraction_automations a join public.atraction_deals d on d.tenant_id=a.tenant_id
 where a.enabled and a.deleted_at is null and a.trigger='deal_stale' and d.stage between 0 and 3 and d.deleted_at is null and d.updated_at<now()-make_interval(hours=>a.delay_hours)
 on conflict do nothing;
 for j in select q.*,a.name,c.owner_id from public.atraction_jobs q
 join public.atraction_automations a on a.id=q.automation_id join public.atraction_contacts c on c.id=q.contact_id
 where q.due_at<=now() and q.done_at is null and a.enabled and a.deleted_at is null and c.deleted_at is null
 order by q.due_at limit 100 for update of q skip locked loop
 insert into public.atraction_activities(tenant_id,owner_id,contact_id,title,due_at) values(j.tenant_id,j.owner_id,j.contact_id,j.name,now());
 update public.atraction_jobs set done_at=now() where id=j.id;n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function atraction_private.background_tasks() from public,anon,authenticated,service_role;
select cron.schedule('atraction-task-worker','* * * * *','select atraction_private.background_tasks()');
-- Retain only this application's cron history. Do not touch other apps' jobs.
select cron.schedule('atraction-worker-history','17 3 * * *',$$delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname like 'atraction-%') and end_time<now()-interval '30 days'$$);
-- Account membership controlled by owner, scoped to invited email. No email is sent automatically.
create table public.atraction_invites(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),email text not null,role text not null check(role in ('manager','agent','viewer')),token uuid not null unique default gen_random_uuid(),created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz);
create index atraction_invites_tenant on public.atraction_invites(tenant_id);
alter table public.atraction_invites enable row level security;
revoke all on public.atraction_invites from anon,authenticated;
grant select,insert,delete on public.atraction_invites to authenticated;
create policy invites_read on public.atraction_invites for select to authenticated using((select atraction_private.role_for(tenant_id))='owner');
create policy invites_insert on public.atraction_invites for insert to authenticated with check((select atraction_private.role_for(tenant_id))='owner' and role in ('manager','agent','viewer') and expires_at<=now()+interval '7 days' and accepted_at is null);
create policy invites_delete on public.atraction_invites for delete to authenticated using((select atraction_private.role_for(tenant_id))='owner');
create function atraction_private.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.atraction_invites;uid uuid:=auth.uid();email_address text;
begin
 if uid is null then raise exception 'not allowed';end if;
 select email into email_address from auth.users where id=uid;
 select * into invitation from public.atraction_invites where token=p_token and lower(email)=lower(email_address) and expires_at>now() and accepted_at is null for update;
 if invitation.id is null then raise exception 'invalid invitation';end if;
 if invitation.role='manager' and auth.jwt()->>'aal'<>'aal2' then raise exception 'mfa required';end if;
 if exists(select 1 from public.atraction_members where user_id=uid) then raise exception 'already belongs to a space';end if;
 perform pg_advisory_xact_lock(hashtextextended(invitation.tenant_id::text,0));
 if (select count(*) from public.atraction_members where tenant_id=invitation.tenant_id)>=10 then raise exception 'team limit';end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(invitation.tenant_id,uid,invitation.role);
 update public.atraction_invites set accepted_at=now() where id=invitation.id;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(invitation.tenant_id,'members',uid,uid,'JOIN',jsonb_build_object('role',invitation.role));
 return invitation.tenant_id;
end $$;
create function public.atraction_accept_invite(p_token uuid) returns uuid language sql security invoker set search_path='' as $$select atraction_private.accept_invite(p_token)$$;
revoke all on function atraction_private.accept_invite(uuid),public.atraction_accept_invite(uuid) from public,anon;
grant execute on function atraction_private.accept_invite(uuid),public.atraction_accept_invite(uuid) to authenticated;
create function atraction_private.team(t uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or atraction_private.role_for(t) is null then raise exception 'not allowed';end if;
 return (select jsonb_agg(jsonb_build_object('user_id',m.user_id,'role',m.role,'email',u.email)) from public.atraction_members m join auth.users u on u.id=m.user_id where m.tenant_id=t);
end $$;
create function public.atraction_team(p_tenant uuid) returns jsonb language sql security invoker set search_path='' as $$select atraction_private.team(p_tenant)$$;
revoke all on function atraction_private.team(uuid),public.atraction_team(uuid) from public,anon;
grant execute on function atraction_private.team(uuid),public.atraction_team(uuid) to authenticated;
create function atraction_private.remove_member(t uuid,u uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'')<>'owner' or u=auth.uid() then raise exception 'not allowed';end if;
 delete from public.atraction_members where tenant_id=t and user_id=u and role<>'owner';
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind) values(t,'members',u,auth.uid(),'REMOVE');
end $$;
create function public.atraction_remove_member(p_tenant uuid,p_user uuid) returns void language sql security invoker set search_path='' as $$select atraction_private.remove_member(p_tenant,p_user)$$;
revoke all on function atraction_private.remove_member(uuid,uuid),public.atraction_remove_member(uuid,uuid) from public,anon;
grant execute on function atraction_private.remove_member(uuid,uuid),public.atraction_remove_member(uuid,uuid) to authenticated;
