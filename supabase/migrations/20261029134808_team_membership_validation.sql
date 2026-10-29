-- Team RPCs already expose these memberships to owners/managers. Allow the
-- same tenant-scoped read to invoker triggers validating payers/holders.
-- role_for is a private, stable SECURITY DEFINER lookup, avoiding RLS recursion.
-- No membership write permissions or cross-company access are granted.
create policy member_team_read on public.atraction_members
for select to authenticated
using ((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
