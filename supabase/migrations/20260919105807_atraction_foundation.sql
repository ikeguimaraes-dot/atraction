-- Atraction only: no changes to existing KPH tables or authentication settings.
create schema if not exists atraction_private;
revoke all on schema atraction_private from public, anon;
grant usage on schema atraction_private to authenticated;
create table public.atraction_tenants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null check(length(name) between 1 and 160), niche text not null default 'estetica' check(niche in ('estetica','academia','pet')),
 capture_enabled boolean not null default false, capture_title text not null default 'Vamos conversar?',
 capture_slug text not null unique default gen_random_uuid()::text,
 animations boolean not null default true, created_at timestamptz not null default now()
);
create index atraction_tenant_owner on public.atraction_tenants(owner_id);
create table public.atraction_members (
 tenant_id uuid not null references public.atraction_tenants(id), user_id uuid not null references auth.users(id),
 role text not null check(role in ('owner','manager','agent','viewer')), primary key(tenant_id,user_id)
);
create index atraction_member_user on public.atraction_members(user_id,tenant_id);
alter table public.atraction_tenants enable row level security;
alter table public.atraction_members enable row level security;
-- Private membership lookup prevents recursive RLS. Privileged roles require MFA.
create function atraction_private.role_for(t uuid) returns text language sql stable security definer set search_path='' as $$
 select m.role from public.atraction_members m where m.tenant_id=t and m.user_id=(select auth.uid())
 and ((m.role not in ('owner','manager')) or (select auth.jwt()->>'aal')='aal2')
$$;
revoke all on function atraction_private.role_for(uuid) from public,anon;
grant execute on function atraction_private.role_for(uuid) to authenticated;
create policy member_self on public.atraction_members for select to authenticated using(user_id=(select auth.uid()));
create policy tenant_read on public.atraction_tenants for select to authenticated using((select atraction_private.role_for(id)) is not null);
create policy tenant_create on public.atraction_tenants for insert to authenticated with check(owner_id=(select auth.uid()) and (select auth.jwt()->>'aal')='aal2');
create policy tenant_update on public.atraction_tenants for update to authenticated using((select atraction_private.role_for(id))='owner') with check((select atraction_private.role_for(id))='owner' and owner_id=(select auth.uid()));
create function atraction_private.add_owner() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if auth.uid() is null or new.owner_id<>auth.uid() then raise exception 'not allowed'; end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(new.id,new.owner_id,'owner');return new;
 end $$;
revoke all on function atraction_private.add_owner() from public,anon,authenticated;
create trigger atraction_owner after insert on public.atraction_tenants for each row execute function atraction_private.add_owner();
grant select,insert,update on public.atraction_tenants to authenticated;
grant select on public.atraction_members to authenticated;

create table public.atraction_contacts (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false, name text not null check(length(name) between 1 and 160), phone text not null check(phone ~ '^\+[1-9][0-9]{9,14}$'), email text not null default '', source text not null default 'Cadastro', tags text[] not null default '{}', notes text not null default '', consent boolean not null default false, consent_proof text not null default '', check(not consent or length(consent_proof)>0), unique(tenant_id,phone), unique(tenant_id,id)
 );
 create index atraction_contacts_tenant on public.atraction_contacts(tenant_id,deleted_at);
 create index atraction_contacts_owner on public.atraction_contacts(owner_id);
 alter table public.atraction_contacts enable row level security;
 grant select,insert,update on public.atraction_contacts to authenticated;
create policy read_contacts on public.atraction_contacts for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())));
 create policy insert_contacts on public.atraction_contacts for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));
 create policy update_contacts on public.atraction_contacts for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));

create table public.atraction_deals (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false, contact_id uuid not null, title text not null check(length(title)>0), value numeric(14,2) not null default 0 check(value>=0), stage integer not null default 0 check(stage between -1 and 4), loss_reason text not null default '', check(stage<>-1 or length(loss_reason)>0), foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id), unique(tenant_id,id)
 );
 create index atraction_deals_tenant on public.atraction_deals(tenant_id,deleted_at);
 create index atraction_deals_owner on public.atraction_deals(owner_id);
 alter table public.atraction_deals enable row level security;
 grant select,insert,update on public.atraction_deals to authenticated;
create index atraction_deals_contact on public.atraction_deals(tenant_id,contact_id);
create policy read_deals on public.atraction_deals for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())));
 create policy insert_deals on public.atraction_deals for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));
 create policy update_deals on public.atraction_deals for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));

create table public.atraction_activities (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false, contact_id uuid, title text not null check(length(title)>0), due_at timestamptz not null, done boolean not null default false, kind text not null default 'task' check(kind in ('task','appointment')), foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id), unique(tenant_id,id)
 );
 create index atraction_activities_tenant on public.atraction_activities(tenant_id,deleted_at);
 create index atraction_activities_owner on public.atraction_activities(owner_id);
 alter table public.atraction_activities enable row level security;
 grant select,insert,update on public.atraction_activities to authenticated;
create index atraction_activities_contact on public.atraction_activities(tenant_id,contact_id);
create policy read_activities on public.atraction_activities for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())));
 create policy insert_activities on public.atraction_activities for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));
 create policy update_activities on public.atraction_activities for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));

create table public.atraction_messages (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false, contact_id uuid not null, body text not null check(length(body) between 1 and 10000), direction text not null check(direction in ('in','out','note')), status text not null default 'draft' check(status in ('draft','received','sent','example')), foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id), unique(tenant_id,id)
 );
 create index atraction_messages_tenant on public.atraction_messages(tenant_id,deleted_at);
 create index atraction_messages_owner on public.atraction_messages(owner_id);
 alter table public.atraction_messages enable row level security;
 grant select,insert,update on public.atraction_messages to authenticated;
create index atraction_messages_contact on public.atraction_messages(tenant_id,contact_id);
create policy read_messages on public.atraction_messages for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())));
 create policy insert_messages on public.atraction_messages for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) and direction in ('out','note') and status='draft');
 create policy update_messages on public.atraction_messages for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))) and direction in ('out','note') and status='draft');

create table public.atraction_automations (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false, name text not null, trigger text not null check(trigger in ('contact_created','deal_stale')), delay_hours integer not null default 0 check(delay_hours between 0 and 8760), action text not null default 'create_task' check(action='create_task'), enabled boolean not null default false, unique(tenant_id,id)
 );
 create index atraction_automations_tenant on public.atraction_automations(tenant_id,deleted_at);
 create index atraction_automations_owner on public.atraction_automations(owner_id);
 alter table public.atraction_automations enable row level security;
 grant select,insert,update on public.atraction_automations to authenticated;
create policy read_automations on public.atraction_automations for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())));
 create policy insert_automations on public.atraction_automations for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager')));
 create policy update_automations on public.atraction_automations for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager')));

create table public.atraction_events (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 entity text not null, entity_id uuid not null, actor_id uuid, kind text not null, payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create index atraction_events_tenant_date on public.atraction_events(tenant_id,created_at desc);
alter table public.atraction_events enable row level security;
grant select on public.atraction_events to authenticated;
create policy event_read on public.atraction_events for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager','viewer'));
create function atraction_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
 declare k text:=TG_OP; p jsonb;
 begin
 if TG_OP='UPDATE' then
   if new.tenant_id<>old.tenant_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'immutable identity'; end if;
   new.updated_at:=now();
   if old.deleted_at is not null and old.deleted_at<now()-interval '30 days' then raise exception 'restore expired'; end if;
 end if;
 p:=jsonb_build_object('source',to_jsonb(new)->'source','value',to_jsonb(new)->'value','stage',to_jsonb(new)->'stage','direction',to_jsonb(new)->'direction','contact_id',to_jsonb(new)->'contact_id');
 if TG_TABLE_NAME='atraction_deals' and (to_jsonb(new)->>'stage')='4' and (TG_OP='INSERT' or (to_jsonb(old)->>'stage')<>'4') then k:='won'; end if;
 if TG_TABLE_NAME='atraction_deals' and TG_OP='UPDATE' and (to_jsonb(old)->>'stage')='4' and (to_jsonb(new)->>'stage')<>'4' then k:='unwon'; p:=jsonb_set(p,'value',to_jsonb(old)->'value'); end if;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(new.tenant_id,replace(TG_TABLE_NAME,'atraction_',''),new.id,auth.uid(),k,p);
 return new;
 end $$;
revoke all on function atraction_private.audit_record() from public,anon,authenticated;
create trigger atraction_audit_contacts before insert or update on public.atraction_contacts for each row execute function atraction_private.audit_record();
create trigger atraction_audit_deals before insert or update on public.atraction_deals for each row execute function atraction_private.audit_record();
create trigger atraction_audit_activities before insert or update on public.atraction_activities for each row execute function atraction_private.audit_record();
create trigger atraction_audit_messages before insert or update on public.atraction_messages for each row execute function atraction_private.audit_record();
create trigger atraction_audit_automations before insert or update on public.atraction_automations for each row execute function atraction_private.audit_record();

-- Idempotent task queue, intentionally no paid messages or external model calls.
create table public.atraction_jobs (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 automation_id uuid not null, contact_id uuid not null, due_at timestamptz not null, done_at timestamptz,
 unique(automation_id,contact_id), foreign key(tenant_id,automation_id) references public.atraction_automations(tenant_id,id),
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id)
);
create index atraction_jobs_due on public.atraction_jobs(due_at) where done_at is null;
create index atraction_jobs_tenant on public.atraction_jobs(tenant_id,automation_id);
create index atraction_jobs_contact on public.atraction_jobs(tenant_id,contact_id);
alter table public.atraction_jobs enable row level security;
create function atraction_private.queue_contact() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.atraction_jobs(tenant_id,automation_id,contact_id,due_at)
 select new.tenant_id,a.id,new.id,now()+make_interval(hours=>a.delay_hours) from public.atraction_automations a
 where a.tenant_id=new.tenant_id and a.enabled and a.deleted_at is null and a.trigger='contact_created'
 on conflict do nothing; return new;
 end $$;
revoke all on function atraction_private.queue_contact() from public,anon,authenticated;
create trigger atraction_queue_contact after insert on public.atraction_contacts for each row execute function atraction_private.queue_contact();
create function public.atraction_run_tasks(p_tenant uuid) returns integer language plpgsql security invoker set search_path='' as $$
 begin
 if (select atraction_private.role_for(p_tenant)) not in ('owner','manager') or (select atraction_private.role_for(p_tenant)) is null then raise exception 'not allowed'; end if;
 return atraction_private.process_tasks(p_tenant);
 end $$;
create function atraction_private.process_tasks(t uuid) returns integer language plpgsql security definer set search_path='' as $$
 declare j record; n integer:=0;
 begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'') not in ('owner','manager') then raise exception 'not allowed'; end if;
 insert into public.atraction_jobs(tenant_id,automation_id,contact_id,due_at)
 select t,a.id,d.contact_id,now() from public.atraction_automations a join public.atraction_deals d on d.tenant_id=a.tenant_id
 where a.tenant_id=t and a.enabled and a.deleted_at is null and a.trigger='deal_stale' and d.stage between 0 and 3 and d.deleted_at is null and d.updated_at<now()-make_interval(hours=>a.delay_hours)
 on conflict do nothing;
 for j in select q.*,a.name,c.owner_id from public.atraction_jobs q
 join public.atraction_automations a on a.id=q.automation_id join public.atraction_contacts c on c.id=q.contact_id
 where q.tenant_id=t and q.due_at<=now() and q.done_at is null and a.enabled and a.deleted_at is null and c.deleted_at is null
 limit 100 for update of q skip locked loop
 insert into public.atraction_activities(tenant_id,owner_id,contact_id,title,due_at) values(t,j.owner_id,j.contact_id,j.name,now());
 update public.atraction_jobs set done_at=now() where id=j.id; n:=n+1;
 end loop; return n;
 end $$;
revoke all on function atraction_private.process_tasks(uuid) from public,anon;
grant execute on function atraction_private.process_tasks(uuid) to authenticated;
revoke all on function public.atraction_run_tasks(uuid) from public,anon;
grant execute on function public.atraction_run_tasks(uuid) to authenticated;
-- Public capture is narrowly scoped: no public reads or arbitrary contact inserts.
create function public.atraction_capture_info(slug text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',name,'title',capture_title,'niche',niche) from public.atraction_tenants where capture_slug=slug and capture_enabled limit 1
$$;
create function public.atraction_capture(slug text, person_name text, person_phone text, accepted boolean) returns boolean language plpgsql security definer set search_path='' as $$
 declare t uuid;
 begin
 select id into t from public.atraction_tenants where capture_slug=slug and capture_enabled;
 if t is null or not accepted or length(trim(person_name)) not between 1 and 160 or person_phone !~ '^\+[1-9][0-9]{9,14}$' then raise exception 'invalid request'; end if;
 if (select count(*) from public.atraction_contacts where tenant_id=t and source='Página' and created_at>now()-interval '1 hour')>=30 then raise exception 'try later'; end if;
 insert into public.atraction_contacts(tenant_id,name,phone,source,consent,consent_proof) values(t,trim(person_name),person_phone,'Página',true,'Formulário público: consentimento expresso em '||now()::text) on conflict(tenant_id,phone) do nothing;
 return true;
 end $$;
revoke all on function public.atraction_capture_info(text) from public;
revoke all on function public.atraction_capture(text,text,text,boolean) from public;
grant execute on function public.atraction_capture_info(text),public.atraction_capture(text,text,text,boolean) to anon,authenticated;
