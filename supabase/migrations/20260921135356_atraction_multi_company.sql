-- Each user may own and join multiple companies. Existing tenant RLS remains unchanged.
drop index public.atraction_one_owned_space;
create index atraction_tenant_owner on public.atraction_tenants(owner_id);
create or replace function atraction_private.add_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.owner_id<>auth.uid() then raise exception 'not allowed';end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(new.id,new.owner_id,'owner');return new;
end $$;
create or replace function atraction_private.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.atraction_invites;uid uuid:=auth.uid();email_address text;
begin
 if uid is null then raise exception 'not allowed';end if;
 select email into email_address from auth.users where id=uid;
 select * into invitation from public.atraction_invites where token=p_token and lower(email)=lower(email_address) and expires_at>now() and accepted_at is null for update;
 if invitation.id is null then raise exception 'invalid invitation';end if;
 if invitation.role='manager' and auth.jwt()->>'aal'<>'aal2' then raise exception 'mfa required';end if;
 if exists(select 1 from public.atraction_members where user_id=uid and tenant_id=invitation.tenant_id) then raise exception 'already belongs to this company';end if;
 perform pg_advisory_xact_lock(hashtextextended(invitation.tenant_id::text,0));
 if (select count(*) from public.atraction_members where tenant_id=invitation.tenant_id)>=10 then raise exception 'team limit';end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(invitation.tenant_id,uid,invitation.role);
 update public.atraction_invites set accepted_at=now() where id=invitation.id;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(invitation.tenant_id,'members',uid,uid,'JOIN',jsonb_build_object('role',invitation.role));
 return invitation.tenant_id;
end $$;
