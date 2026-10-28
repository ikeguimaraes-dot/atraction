-- Managers can add/edit information, but cannot delete it or settle payments.
-- The trigger also runs inside SECURITY DEFINER RPCs, using the requesting user.
create function atraction_private.enforce_manager_permissions() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  tenant uuid;
  before_row jsonb := case when TG_OP <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  after_row jsonb := case when TG_OP <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
begin
  tenant := coalesce((before_row->>'tenant_id')::uuid, (after_row->>'tenant_id')::uuid);
  if atraction_private.role_for(tenant) = 'manager' then
    if TG_OP = 'DELETE'
      or (TG_OP = 'INSERT' and after_row->>'deleted_at' is not null)
      or (TG_OP = 'UPDATE' and after_row->'deleted_at' is distinct from before_row->'deleted_at') then
      raise exception 'Gerentes não podem excluir, arquivar ou restaurar registros.' using errcode = '42501';
    end if;
    if TG_TABLE_NAME in ('atraction_transfers', 'atraction_settlements') then
      raise exception 'Somente donos podem registrar ou estornar movimentações financeiras.' using errcode = '42501';
    end if;
    if TG_TABLE_NAME = 'atraction_finance' and (
      (TG_OP = 'INSERT' and (coalesce(after_row->'payments', '[]'::jsonb) <> '[]'::jsonb or after_row->>'settled_date' is not null))
      or (TG_OP = 'UPDATE' and (after_row->'payments' is distinct from before_row->'payments'
        or after_row->'settled_date' is distinct from before_row->'settled_date'))
    ) then
      raise exception 'Somente donos podem dar baixa ou estornar pagamentos.' using errcode = '42501';
    end if;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function atraction_private.enforce_manager_permissions() from public, anon, authenticated;

do $$
declare tab record;
begin
  for tab in
    select table_name from information_schema.columns
    where table_schema = 'public' and table_name like 'atraction\_%' escape '\'
      and column_name = 'deleted_at'
      and exists (select 1 from information_schema.columns c where c.table_schema='public'
        and c.table_name=columns.table_name and c.column_name='tenant_id')
  loop
    execute format('create trigger atraction_00_manager_permissions before insert or update or delete on public.%I for each row execute function atraction_private.enforce_manager_permissions()', tab.table_name);
  end loop;
end $$;

-- Deny even idempotent calls before processing, including deletion via helper RPCs.
do $$
declare fn record; definition text;
begin
  for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='atraction_private'
      and p.proname in ('record_payment','record_shared_payment','stop_recurrence','cancel_contract','merge_contacts','undo_import')
  loop
    definition := pg_get_functiondef(fn.oid);
    definition := regexp_replace(definition, '''owner''\s*,\s*''manager''', '''owner''', 'g');
    execute definition;
  end loop;
end $$;
