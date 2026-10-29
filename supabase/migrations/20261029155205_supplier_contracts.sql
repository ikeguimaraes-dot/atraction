-- Existing contracts remain customer contracts. Only the existing RPC can write contracts.
alter table public.atraction_contracts alter column contact_id drop not null;
alter table public.atraction_contracts add column supplier_id uuid;
alter table public.atraction_contracts add constraint atraction_contract_supplier_fk foreign key(tenant_id,supplier_id) references public.atraction_suppliers(tenant_id,id);
alter table public.atraction_contracts add constraint atraction_contract_party check ((contact_id is not null and supplier_id is null) or (contact_id is null and supplier_id is not null and deal_id is null));
create index atraction_contract_supplier on public.atraction_contracts(tenant_id,supplier_id) where supplier_id is not null;
create or replace function atraction_private.create_contract(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenant_id')::uuid; cid uuid:=(p->>'id')::uuid; c public.atraction_contracts; i integer; n integer; linked public.atraction_deals; previous public.atraction_contracts; supplier uuid:=nullif(p->>'supplier_id','')::uuid; customer uuid:=nullif(p->>'contact_id','')::uuid;
begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,7));
 if exists(select 1 from public.atraction_contracts where id=cid and tenant_id=t) then return cid;end if;
 if (supplier is null) = (customer is null) then raise exception 'Choose either a customer or a supplier';end if;
 if supplier is not null then
   if nullif(p->>'deal_id','') is not null then raise exception 'Supplier contracts cannot reference sales';end if;
   if not exists(select 1 from public.atraction_suppliers where tenant_id=t and id=supplier and deleted_at is null) then raise exception 'invalid supplier';end if;
 elsif not exists(select 1 from public.atraction_contacts where tenant_id=t and id=customer and deleted_at is null) then raise exception 'invalid contact';end if;
 if nullif(p->>'deal_id','') is not null then
 select * into linked from public.atraction_deals where id=(p->>'deal_id')::uuid and tenant_id=t and deleted_at is null for update;
 if linked.id is null or linked.contact_id<>(p->>'contact_id')::uuid then raise exception 'invalid sale';end if;
 end if;
 if nullif(p->>'renews_id','') is not null then
 select * into previous from public.atraction_contracts where id=(p->>'renews_id')::uuid and tenant_id=t for update;
 if previous.id is null or previous.contact_id is distinct from customer or previous.supplier_id is distinct from supplier or (p->>'start_date')::date<=previous.end_date then raise exception 'invalid renewal';end if;
 end if;
 n:=case when p->>'mode'='once' then 1 else (p->>'periods')::integer end;
 insert into public.atraction_contracts(id,tenant_id,owner_id,contact_id,supplier_id,deal_id,renews_id,title,plan,mode,amount_cents,periods,start_date,first_due_date,end_date,notes)
 values(cid,t,auth.uid(),customer,supplier,nullif(p->>'deal_id','')::uuid,nullif(p->>'renews_id','')::uuid,trim(p->>'title'),coalesce(p->>'plan',''),p->>'mode',(p->>'amount_cents')::bigint,n,(p->>'start_date')::date,(p->>'first_due_date')::date,((p->>'start_date')::date+make_interval(months=>n)-interval '1 day')::date,coalesce(p->>'notes','')) returning * into c;
 for i in 0..n-1 loop
 insert into public.atraction_finance(tenant_id,owner_id,contact_id,supplier_id,contract_id,installment,title,direction,amount_cents,category,due_date)
 values(t,auth.uid(),c.contact_id,c.supplier_id,c.id,i+1,c.title||' · '||(i+1)||'/'||n,case when c.supplier_id is null then 'income' else 'expense' end,case when c.mode='installments' then c.amount_cents/n+case when i<c.amount_cents%n then 1 else 0 end else c.amount_cents end,case when c.mode='monthly' then 'Mensalidades' else 'Contratos' end,(c.first_due_date+make_interval(months=>i))::date);
 end loop;
 update public.atraction_contacts set lifecycle='customer',customer_since=coalesce(customer_since,c.start_date) where tenant_id=t and id=c.contact_id;
 if linked.id is not null then update public.atraction_deals set stage=4 where tenant_id=t and id=linked.id;end if;
 insert into public.atraction_activities(tenant_id,owner_id,contact_id,title,due_at,purpose) select t,owner_id,id,'Dar boas-vindas e combinar próximos passos',c.start_date::timestamp at time zone 'America/Sao_Paulo','onboarding' from public.atraction_contacts where tenant_id=t and id=c.contact_id on conflict do nothing;
 return cid;
end $$;

create or replace function atraction_private.check_installment() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_OP='UPDATE' and (new.contract_id is distinct from old.contract_id or new.installment is distinct from old.installment) then raise exception 'immutable installment';end if;
 if new.contract_id is not null and not exists(
   select 1 from public.atraction_contracts c where c.id=new.contract_id and c.tenant_id=new.tenant_id
   and c.contact_id is not distinct from new.contact_id
   and c.supplier_id is not distinct from new.supplier_id
   and new.direction=case when c.supplier_id is null then 'income' else 'expense' end
 ) then raise exception 'invalid installment';end if;
 return new;
end $$;
notify pgrst, 'reload schema';
