-- Owners add existing Auth users directly. Invitation links are retired.
revoke all on public.atraction_invites from anon, authenticated;
revoke all on function public.atraction_accept_invite(uuid) from public, anon, authenticated;

alter policy tenant_update on public.atraction_tenants
  using ((select atraction_private.role_for(id)) = 'owner')
  with check ((select atraction_private.role_for(id)) = 'owner');

create function atraction_private.protect_primary_owner() returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.owner_id is distinct from old.owner_id
    and coalesce(current_setting('atraction.owner_transfer', true), '') <> 'on'
  then
    raise exception 'primary owner is managed through team access';
  end if;
  return new;
end $$;

revoke all on function atraction_private.protect_primary_owner() from public, anon, authenticated;
create trigger atraction_protect_primary_owner
before update of owner_id on public.atraction_tenants
for each row execute function atraction_private.protect_primary_owner();

create or replace function atraction_private.add_member_by_email(
  tenant uuid,
  member_email text,
  member_role text
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  member_id uuid;
begin
  if auth.uid() is null
    or coalesce(atraction_private.role_for(tenant), '') <> 'owner'
    or member_role not in ('owner', 'manager', 'agent')
    or member_email is null
    or length(trim(member_email)) > 320
  then
    raise exception 'not allowed';
  end if;

  select id into member_id
  from auth.users
  where lower(email) = lower(trim(member_email))
    and deleted_at is null
  order by created_at
  limit 1;

  if member_id is null then
    raise exception 'account not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(tenant::text, 0));
  if exists (
    select 1 from public.atraction_members
    where tenant_id = tenant and user_id = member_id
  ) then
    raise exception 'already a member';
  end if;
  if (select count(*) from public.atraction_members where tenant_id = tenant) >= 10 then
    raise exception 'team limit';
  end if;

  insert into public.atraction_members(tenant_id, user_id, role)
  values (tenant, member_id, member_role);
  insert into public.atraction_events(tenant_id, entity, entity_id, actor_id, kind, payload)
  values (
    tenant,
    'members',
    member_id,
    auth.uid(),
    'member_added',
    jsonb_build_object('role', member_role)
  );
  return member_id;
end $$;

revoke all on function atraction_private.add_member_by_email(uuid,text,text) from public, anon;
grant execute on function atraction_private.add_member_by_email(uuid,text,text) to authenticated;

create or replace function public.atraction_add_member(
  tenant uuid,
  member_email text,
  member_role text
) returns uuid
language sql
security invoker
set search_path=''
as $$
  select atraction_private.add_member_by_email(tenant, member_email, member_role)
$$;

revoke all on function public.atraction_add_member(uuid,text,text) from public, anon;
grant execute on function public.atraction_add_member(uuid,text,text) to authenticated;

create or replace function atraction_private.member_role(
  tenant uuid,
  member uuid,
  new_role text
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  old_role text;
  boss uuid;
begin
  if auth.uid() is null
    or coalesce(atraction_private.role_for(tenant), '') <> 'owner'
    or new_role not in ('owner', 'manager', 'agent', 'viewer', 'remove')
  then
    raise exception 'not allowed';
  end if;
  if member = auth.uid() then
    raise exception 'change your own access through another owner';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(tenant::text, 10));
  select role into old_role
  from public.atraction_members
  where tenant_id = tenant and user_id = member
  for update;
  if old_role is null then
    raise exception 'member not found';
  end if;
  if old_role = 'owner'
    and new_role <> 'owner'
    and (select count(*) from public.atraction_members where tenant_id = tenant and role = 'owner') <= 1
  then
    raise exception 'last owner';
  end if;

  select owner_id into boss from public.atraction_tenants where id = tenant for update;
  if boss = member and old_role = 'owner' and new_role <> 'owner' then
    select user_id into boss
    from public.atraction_members
    where tenant_id = tenant and role = 'owner' and user_id <> member
    order by user_id
    limit 1;
    perform set_config('atraction.owner_transfer', 'on', true);
    update public.atraction_tenants set owner_id = boss where id = tenant;
    perform set_config('atraction.owner_transfer', 'off', true);
  end if;

  if new_role in ('viewer', 'remove') then
    update public.atraction_contacts set owner_id = boss
    where tenant_id = tenant and owner_id = member;
    update public.atraction_activities set owner_id = boss
    where tenant_id = tenant and owner_id = member;
  end if;

  if new_role = 'remove' then
    delete from public.atraction_members where tenant_id = tenant and user_id = member;
  else
    update public.atraction_members set role = new_role
    where tenant_id = tenant and user_id = member;
  end if;

  insert into public.atraction_events(tenant_id, entity, entity_id, actor_id, kind, payload)
  values (
    tenant,
    'members',
    member,
    auth.uid(),
    'role_changed',
    jsonb_build_object('before', old_role, 'after', new_role)
  );
end $$;
