-- Atraction uses email/password sessions; membership and role checks remain enforced.
-- Shared Auth settings and factors belonging to other applications are untouched.
create or replace function atraction_private.role_for(t uuid) returns text
language sql stable security definer set search_path='' as $$
 select m.role from public.atraction_members m
 where m.tenant_id=t and m.user_id=(select auth.uid())
$$;
alter policy tenant_create on public.atraction_tenants
 with check(owner_id=(select auth.uid()));

create or replace function atraction_private.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.atraction_invites;uid uuid:=auth.uid();email_address text;
begin
 if uid is null then raise exception 'not allowed';end if;
 select email into email_address from auth.users where id=uid;
 select * into invitation from public.atraction_invites where token=p_token and lower(email)=lower(email_address) and expires_at>now() and accepted_at is null for update;
 if invitation.id is null then raise exception 'invalid invitation';end if;
 if exists(select 1 from public.atraction_members where user_id=uid and tenant_id=invitation.tenant_id) then raise exception 'already belongs to this company';end if;
 perform pg_advisory_xact_lock(hashtextextended(invitation.tenant_id::text,0));
 if (select count(*) from public.atraction_members where tenant_id=invitation.tenant_id)>=10 then raise exception 'team limit';end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(invitation.tenant_id,uid,invitation.role);
 update public.atraction_invites set accepted_at=now() where id=invitation.id;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(invitation.tenant_id,'members',uid,uid,'JOIN',jsonb_build_object('role',invitation.role));
 return invitation.tenant_id;
end $$;
