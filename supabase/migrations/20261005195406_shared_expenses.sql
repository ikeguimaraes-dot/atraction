alter table public.atraction_accounts
  add column holder_user_id uuid references auth.users(id);

create function atraction_private.validate_account_holder() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.holder_user_id is not null and not exists (
    select 1 from public.atraction_members
    where tenant_id=new.tenant_id and user_id=new.holder_user_id
  ) then raise exception 'account holder must be a tenant member'; end if;
  return new;
end $$;
revoke all on function atraction_private.validate_account_holder() from public,anon,authenticated;
create trigger atraction_validate_account_holder before insert or update on public.atraction_accounts
for each row execute function atraction_private.validate_account_holder();

create table public.atraction_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.atraction_tenants(id),
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz, is_example boolean not null default false,
  from_user_id uuid references auth.users(id), to_user_id uuid references auth.users(id),
  amount_cents bigint not null check(amount_cents between 1 and 999999999999),
  date date not null check(date<=current_date),
  from_account_id uuid, to_account_id uuid, notes text not null default '' check(length(notes)<=500),
  check(from_user_id is distinct from to_user_id),
  foreign key(tenant_id,from_account_id) references public.atraction_accounts(tenant_id,id),
  foreign key(tenant_id,to_account_id) references public.atraction_accounts(tenant_id,id),
  unique(tenant_id,id)
);
create index atraction_settlements_tenant_date on public.atraction_settlements(tenant_id,date);
alter table public.atraction_settlements enable row level security;
revoke all on public.atraction_settlements from anon,authenticated;
grant select,insert,update on public.atraction_settlements to authenticated;
create policy read_settlements on public.atraction_settlements for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy insert_settlements on public.atraction_settlements for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy update_settlements on public.atraction_settlements for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create trigger atraction_audit_settlements before insert or update on public.atraction_settlements for each row execute function atraction_private.audit_record();
create trigger atraction_event_settlements after insert or update on public.atraction_settlements for each row execute function atraction_private.record_financial_event();

create function atraction_private.validate_settlement() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.from_user_id is not null and not exists(select 1 from public.atraction_members where tenant_id=new.tenant_id and user_id=new.from_user_id) then raise exception 'invalid sender'; end if;
  if new.to_user_id is not null and not exists(select 1 from public.atraction_members where tenant_id=new.tenant_id and user_id=new.to_user_id) then raise exception 'invalid receiver'; end if;
  return new;
end $$;
revoke all on function atraction_private.validate_settlement() from public,anon,authenticated;
create trigger atraction_validate_settlement before insert or update on public.atraction_settlements for each row execute function atraction_private.validate_settlement();

create or replace function atraction_private.validate_payments() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb;a jsonb;total bigint:=0;split_total bigint;last_date date;seen uuid[]:='{}';begin
 if TG_OP='UPDATE' and current_user='authenticated' and new.payments is distinct from old.payments then raise exception 'use payment operation';end if;
 if jsonb_typeof(new.payments)<>'array' or jsonb_array_length(new.payments)>200 then raise exception 'invalid payments';end if;
 for p in select value from jsonb_array_elements(new.payments) loop
  if (p->>'amount_cents') is null or (p->>'amount_cents')!~'^[0-9]+$' or (p->>'amount_cents')::bigint<1 or (p->>'date') is null or (p->>'date')::date>current_date or (p->>'id') is null or (p->>'id')::uuid=any(seen) then raise exception 'invalid payment';end if;
  seen:=array_append(seen,(p->>'id')::uuid);total:=total+(p->>'amount_cents')::bigint;last_date:=greatest(last_date,(p->>'date')::date);
  if p->>'account_id' is not null and not exists(select 1 from public.atraction_accounts where id=(p->>'account_id')::uuid and tenant_id=new.tenant_id) then raise exception 'invalid account';end if;
  if p ? 'allocations' then
   if new.direction<>'expense' or jsonb_typeof(p->'allocations')<>'array' or jsonb_array_length(p->'allocations')<1 then raise exception 'invalid allocation';end if;
   if p->>'payer_user_id' is not null and not exists(select 1 from public.atraction_members where tenant_id=new.tenant_id and user_id=(p->>'payer_user_id')::uuid) then raise exception 'invalid payer';end if;
   split_total:=0;
   for a in select value from jsonb_array_elements(p->'allocations') loop
    if (a->>'amount_cents') is null or (a->>'amount_cents')!~'^[0-9]+$' or (a->>'amount_cents')::bigint<1 then raise exception 'invalid allocation amount';end if;
    if a->>'user_id' is not null and not exists(select 1 from public.atraction_members where tenant_id=new.tenant_id and user_id=(a->>'user_id')::uuid) then raise exception 'invalid participant';end if;
    split_total:=split_total+(a->>'amount_cents')::bigint;
   end loop;
   if split_total<>(p->>'amount_cents')::bigint then raise exception 'allocation total mismatch';end if;
  end if;
 end loop;
 if total>new.amount_cents then raise exception 'payment exceeds amount';end if;
 new.settled_date:=case when total=new.amount_cents then last_date else null end;
 if new.direction='income' then new.dre_group:='revenue';elsif new.dre_group='revenue' then raise exception 'invalid expense group';end if;
 return new;
end $$;

create function atraction_private.record_shared_payment(entry uuid,amount bigint,paid_on date,account uuid,request_id uuid,payer uuid,allocations jsonb,reverse_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare f public.atraction_finance;begin
 select * into f from public.atraction_finance where id=entry for update;
 if auth.uid() is null or coalesce(atraction_private.role_for(f.tenant_id),'') not in ('owner','manager') or f.deleted_at is not null or f.direction<>'expense' then raise exception 'not allowed';end if;
 if reverse_id is not null then
  update public.atraction_finance set payments=coalesce((select jsonb_agg(x) from jsonb_array_elements(f.payments) x where x->>'id'<>reverse_id::text),'[]') where id=f.id;
 else
  if request_id is null or jsonb_typeof(allocations)<>'array' then raise exception 'invalid request';end if;
  if exists(select 1 from jsonb_array_elements(f.payments) x where x->>'id'=request_id::text) then return;end if;
  update public.atraction_finance set payments=f.payments||jsonb_build_array(jsonb_build_object('id',request_id,'date',paid_on,'amount_cents',amount,'account_id',account,'payer_user_id',payer,'allocations',allocations)) where id=f.id;
 end if;
end $$;
revoke all on function atraction_private.record_shared_payment(uuid,bigint,date,uuid,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function atraction_private.record_shared_payment(uuid,bigint,date,uuid,uuid,uuid,jsonb,uuid) to authenticated;
create function public.atraction_record_shared_payment(entry uuid,amount bigint,paid_on date,account uuid,request_id uuid,payer uuid,allocations jsonb,reverse_id uuid default null) returns void language sql security invoker set search_path='' as $$select atraction_private.record_shared_payment(entry,amount,paid_on,account,request_id,payer,allocations,reverse_id)$$;
revoke all on function public.atraction_record_shared_payment(uuid,bigint,date,uuid,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.atraction_record_shared_payment(uuid,bigint,date,uuid,uuid,uuid,jsonb,uuid) to authenticated;

drop policy event_read on public.atraction_events;
create policy event_read on public.atraction_events for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='viewer' and entity not in ('finance','suppliers','contracts','documents','accounts','transfers','settlements')));
