alter policy tenant_create on public.atraction_tenants with check(owner_id=(select auth.uid()) and ((select auth.jwt())->>'aal')='aal2');
-- Creation is single-workspace in this release, matching invitation and client behavior.
create or replace function atraction_private.add_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or new.owner_id<>auth.uid() then raise exception 'not allowed';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text,2));
 if exists(select 1 from public.atraction_members where user_id=new.owner_id) then raise exception 'already belongs to a space';end if;
 insert into public.atraction_members(tenant_id,user_id,role) values(new.id,new.owner_id,'owner');return new;
end $$;
-- The unique owner index already covers this lookup.
drop index public.atraction_tenant_owner;
