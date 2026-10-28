-- Null preserves the unknown payer of existing entries; company is explicit.
alter table public.atraction_finance add column purchase_payer text
  check (purchase_payer is null or (direction = 'expense' and
    (purchase_payer = 'company' or purchase_payer ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')));

create function atraction_private.validate_purchase_payer() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  -- Preserve history when a member leaves; validate new selections only.
  if TG_OP = 'UPDATE' then
    if new.purchase_payer is not distinct from old.purchase_payer
       and new.tenant_id is not distinct from old.tenant_id then return new; end if;
  end if;
  if new.purchase_payer is not null and new.purchase_payer <> 'company' and not exists (
    select 1 from public.atraction_members
    where tenant_id = new.tenant_id and user_id::text = new.purchase_payer
  ) then raise exception 'purchase payer must be a tenant member'; end if;
  return new;
end $$;
revoke all on function atraction_private.validate_purchase_payer() from public,anon,authenticated;
create trigger atraction_validate_purchase_payer before insert or update on public.atraction_finance
for each row execute function atraction_private.validate_purchase_payer();
