-- Operational customer and cash management, isolated from other apps.
alter table public.atraction_contacts
 add column lifecycle text not null default 'prospect' check(lifecycle in ('prospect','customer','inactive')),
 add column customer_since date,
 add column document text not null default '' check(length(document)<=30),
 add column address text not null default '' check(length(address)<=500);
create index atraction_contacts_lifecycle on public.atraction_contacts(tenant_id,lifecycle) where deleted_at is null;
create table public.atraction_suppliers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false,
 name text not null check(length(trim(name)) between 1 and 160), document text not null default '' check(length(document)<=30),
 email text not null default '', phone text not null default '', category text not null default 'Outros',
 address text not null default '', notes text not null default '', unique(tenant_id,id)
);
create table public.atraction_finance (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 deleted_at timestamptz, is_example boolean not null default false,
 title text not null check(length(trim(title)) between 1 and 200), direction text not null check(direction in ('income','expense')),
 amount_cents bigint not null check(amount_cents between 1 and 999999999999),
 category text not null check(length(trim(category)) between 1 and 100), due_date date not null, settled_date date,
 contact_id uuid, supplier_id uuid, notes text not null default '',
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id),
 foreign key(tenant_id,supplier_id) references public.atraction_suppliers(tenant_id,id),
 check((direction='income' and supplier_id is null) or (direction='expense' and contact_id is null)),
 check(settled_date is null or settled_date<=current_date), unique(tenant_id,id)
);
create index atraction_suppliers_owner on public.atraction_suppliers(owner_id);
create index atraction_finance_owner on public.atraction_finance(owner_id);
create index atraction_suppliers_active on public.atraction_suppliers(tenant_id,deleted_at);
create index atraction_finance_due on public.atraction_finance(tenant_id,due_date) where deleted_at is null;
create index atraction_finance_contact on public.atraction_finance(tenant_id,contact_id);
create index atraction_finance_supplier on public.atraction_finance(tenant_id,supplier_id);
alter table public.atraction_suppliers enable row level security;
alter table public.atraction_finance enable row level security;
-- Financial information restricted to owners and managers, including audit payloads.
grant select,insert,update on public.atraction_suppliers,public.atraction_finance to authenticated;
create policy suppliers_read on public.atraction_suppliers for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy suppliers_insert on public.atraction_suppliers for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy suppliers_update on public.atraction_suppliers for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy finance_read on public.atraction_finance for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy finance_insert on public.atraction_finance for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy finance_update on public.atraction_finance for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create trigger atraction_audit_finance before insert or update on public.atraction_finance for each row execute function atraction_private.audit_record();
create trigger atraction_audit_suppliers before insert or update on public.atraction_suppliers for each row execute function atraction_private.audit_record();
create function atraction_private.record_financial_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload)
 values(new.tenant_id,replace(TG_TABLE_NAME,'atraction_',''),new.id,auth.uid(),TG_OP,
 jsonb_build_object('before',case when TG_OP='UPDATE' then to_jsonb(old) else null end,'after',to_jsonb(new)));
 return new;
end $$;
revoke all on function atraction_private.record_financial_event() from public,anon,authenticated;
create trigger atraction_event_finance after insert or update on public.atraction_finance for each row execute function atraction_private.record_financial_event();
create trigger atraction_event_suppliers after insert or update on public.atraction_suppliers for each row execute function atraction_private.record_financial_event();
drop policy event_read on public.atraction_events;
create policy event_read on public.atraction_events for select to authenticated using(
 (select atraction_private.role_for(tenant_id)) in ('owner','manager') or
 ((select atraction_private.role_for(tenant_id))='viewer' and entity not in ('finance','suppliers'))
);
