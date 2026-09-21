-- Monthly subscriptions, isolated from contract installments and other applications.
create table public.atraction_recurrences (
 id uuid primary key, tenant_id uuid not null references public.atraction_tenants(id),
 owner_id uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 title text not null check(length(trim(title)) between 1 and 180), direction text not null check(direction in ('income','expense')),
 amount_cents bigint not null check(amount_cents between 1 and 999999999999), category text not null check(length(trim(category)) between 1 and 100),
 first_due_date date not null, end_date date, active boolean not null default true, next_index integer not null default 0 check(next_index>=0),
 contact_id uuid, supplier_id uuid, notes text not null default '', dre_group text not null default 'expense' check(dre_group in ('revenue','cost','expense','tax')),
 check(end_date is null or end_date>=first_due_date),
 check((direction='income' and supplier_id is null) or (direction='expense' and contact_id is null)),
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id),
 foreign key(tenant_id,supplier_id) references public.atraction_suppliers(tenant_id,id), unique(tenant_id,id)
);
create index atraction_recurrences_owner on public.atraction_recurrences(owner_id);
create index atraction_recurrences_contact on public.atraction_recurrences(tenant_id,contact_id);
create index atraction_recurrences_supplier on public.atraction_recurrences(tenant_id,supplier_id);
alter table public.atraction_recurrences enable row level security;
revoke all on public.atraction_recurrences from public,anon,authenticated;
grant select on public.atraction_recurrences to authenticated;
create policy recurrence_read on public.atraction_recurrences for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
alter table public.atraction_finance add column recurrence_id uuid, add column recurrence_index integer;
alter table public.atraction_finance add foreign key(tenant_id,recurrence_id) references public.atraction_recurrences(tenant_id,id);
alter table public.atraction_finance add constraint atraction_recurrence_link check((recurrence_id is null and recurrence_index is null) or (recurrence_id is not null and recurrence_index is not null and recurrence_index>=0 and contract_id is null));
create unique index atraction_finance_recurrence on public.atraction_finance(recurrence_id,recurrence_index) where recurrence_id is not null;
create index atraction_finance_recurrence_tenant on public.atraction_finance(tenant_id,recurrence_id);

-- Only the scheduler and authorized command functions can generate occurrences.
create function atraction_private.generate_recurrence(series uuid, as_of date default (now() at time zone 'America/Sao_Paulo')::date) returns void language plpgsql security invoker set search_path='' as $$
declare r public.atraction_recurrences; due date; horizon date; n integer;
begin
 select * into r from public.atraction_recurrences where id=series for update;
 if not found or not r.active then return;end if;
 horizon := (greatest(as_of,r.first_due_date)+interval '11 months')::date;
 n:=r.next_index;
 loop
  due:=(r.first_due_date+make_interval(months=>n))::date;
  exit when due>horizon or (r.end_date is not null and due>r.end_date);
  insert into public.atraction_finance(tenant_id,owner_id,title,direction,amount_cents,category,due_date,contact_id,supplier_id,notes,dre_group,recurrence_id,recurrence_index)
  values(r.tenant_id,r.owner_id,r.title||' · '||to_char(due,'MM/YYYY'),r.direction,r.amount_cents,r.category,due,r.contact_id,r.supplier_id,r.notes,r.dre_group,r.id,n)
  on conflict(recurrence_id,recurrence_index) where recurrence_id is not null do nothing;
  n:=n+1;
 end loop;
 update public.atraction_recurrences set next_index=n,updated_at=now() where id=r.id and next_index<>n;
end $$;
revoke all on function atraction_private.generate_recurrence(uuid,date) from public,anon,authenticated;

create function atraction_private.create_recurrence(t uuid, request_id uuid, entry jsonb, ends_on date) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.atraction_recurrences; first_due date;
begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'') not in ('owner','manager') then raise exception 'forbidden';end if;
 first_due:=(entry->>'due_date')::date;
 if first_due is null or first_due<(current_date-interval '5 years')::date or first_due>(current_date+interval '10 years')::date then raise exception 'invalid first due date';end if;
 insert into public.atraction_recurrences(id,tenant_id,owner_id,title,direction,amount_cents,category,first_due_date,end_date,contact_id,supplier_id,notes,dre_group)
 values(request_id,t,auth.uid(),trim(entry->>'title'),entry->>'direction',(entry->>'amount_cents')::bigint,entry->>'category',first_due,ends_on,nullif(entry->>'contact_id','')::uuid,nullif(entry->>'supplier_id','')::uuid,coalesce(entry->>'notes',''),coalesce(entry->>'dre_group','expense'))
 on conflict(id) do nothing;
 select * into existing from public.atraction_recurrences where id=request_id;
 if existing.tenant_id<>t then raise exception 'request conflict';end if;
 perform atraction_private.generate_recurrence(request_id);
 return request_id;
end $$;
revoke all on function atraction_private.create_recurrence(uuid,uuid,jsonb,date) from public,anon,authenticated;
grant execute on function atraction_private.create_recurrence(uuid,uuid,jsonb,date) to authenticated;
create function public.atraction_create_recurrence(t uuid,request_id uuid,entry jsonb,ends_on date default null) returns uuid language sql security invoker set search_path='' as $$ select atraction_private.create_recurrence(t,request_id,entry,ends_on); $$;
revoke all on function public.atraction_create_recurrence(uuid,uuid,jsonb,date) from public,anon;
grant execute on function public.atraction_create_recurrence(uuid,uuid,jsonb,date) to authenticated;

create function atraction_private.stop_recurrence(series uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.atraction_recurrences;
begin
 select * into r from public.atraction_recurrences where id=series for update;
 if not found or auth.uid() is null or coalesce(atraction_private.role_for(r.tenant_id),'') not in ('owner','manager') then raise exception 'forbidden';end if;
 update public.atraction_recurrences set active=false,updated_at=now() where id=series;
 -- Preserve historical dues and every occurrence with any payment.
 update public.atraction_finance set deleted_at=now() where recurrence_id=series and deleted_at is null and due_date>(now() at time zone 'America/Sao_Paulo')::date and settled_date is null and jsonb_array_length(payments)=0;
end $$;
revoke all on function atraction_private.stop_recurrence(uuid) from public,anon,authenticated;
grant execute on function atraction_private.stop_recurrence(uuid) to authenticated;
create function public.atraction_stop_recurrence(series uuid) returns void language sql security invoker set search_path='' as $$ select atraction_private.stop_recurrence(series); $$;
revoke all on function public.atraction_stop_recurrence(uuid) from public,anon;
grant execute on function public.atraction_stop_recurrence(uuid) to authenticated;

create function atraction_private.check_recurrence_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and (new.recurrence_id is distinct from old.recurrence_id or new.recurrence_index is distinct from old.recurrence_index) then raise exception 'immutable recurrence';end if;
 if TG_OP='INSERT' and new.recurrence_id is not null and current_user<>'postgres' then raise exception 'use recurrence command';end if;
 return new;
end $$;
revoke all on function atraction_private.check_recurrence_link() from public,anon,authenticated;
create trigger atraction_recurrence_link before insert or update on public.atraction_finance for each row execute function atraction_private.check_recurrence_link();

create function atraction_private.recurrence_worker() returns void language plpgsql security invoker set search_path='' as $$
declare r record;
begin
 for r in select id from public.atraction_recurrences where active and (end_date is null or (first_due_date+make_interval(months=>next_index))::date<=end_date) for update skip locked loop
  perform atraction_private.generate_recurrence(r.id);
 end loop;
end $$;
revoke all on function atraction_private.recurrence_worker() from public,anon,authenticated;
select cron.schedule('atraction-finance-recurrences','23 6 * * *','select atraction_private.recurrence_worker()');
