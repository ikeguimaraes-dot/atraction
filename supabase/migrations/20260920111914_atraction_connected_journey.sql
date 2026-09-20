alter table public.atraction_contacts
 add column campaign text not null default '' check(length(campaign)<=160),
 add column medium text not null default '' check(length(medium)<=100),
 add column referred_by text not null default '' check(length(referred_by)<=160),
 add column last_contact_at timestamptz,
 add column retention_days integer not null default 30 check(retention_days between 1 and 365),
 add column satisfaction integer check(satisfaction between 0 and 10);
alter table public.atraction_activities add column purpose text check(purpose in ('onboarding','followup','renewal','referral'));
create unique index atraction_one_pending_care on public.atraction_activities(tenant_id,contact_id,purpose) where purpose is not null and deleted_at is null and not done;
create table public.atraction_contracts (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,
 contact_id uuid not null,deal_id uuid,renews_id uuid,title text not null check(length(trim(title)) between 1 and 200),plan text not null default '' check(length(plan)<=160),
 mode text not null check(mode in ('once','installments','monthly')),amount_cents bigint not null check(amount_cents between 1 and 999999999999),
 periods integer not null check(periods between 1 and 60),start_date date not null,first_due_date date not null,end_date date not null,
 status text not null default 'active' check(status in ('active','cancelled')),notes text not null default '',
 check(end_date>=start_date),check(first_due_date>=start_date),check(mode<>'once' or periods=1),check(mode<>'installments' or amount_cents>=periods),
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id),foreign key(tenant_id,deal_id) references public.atraction_deals(tenant_id,id),
 unique(tenant_id,id),foreign key(tenant_id,renews_id) references public.atraction_contracts(tenant_id,id)
);
create unique index atraction_contract_sale on public.atraction_contracts(tenant_id,deal_id) where deal_id is not null;
create unique index atraction_contract_renewal on public.atraction_contracts(tenant_id,renews_id) where renews_id is not null;
create index atraction_contract_customer on public.atraction_contracts(tenant_id,contact_id);
create index atraction_contract_owner on public.atraction_contracts(owner_id);
alter table public.atraction_contracts enable row level security;
revoke all on public.atraction_contracts from anon,authenticated;
grant select on public.atraction_contracts to authenticated;
create policy contracts_read on public.atraction_contracts for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
alter table public.atraction_finance add column contract_id uuid,add column installment integer;
alter table public.atraction_finance add constraint atraction_finance_contract_fk foreign key(tenant_id,contract_id) references public.atraction_contracts(tenant_id,id);
alter table public.atraction_finance add constraint atraction_finance_installment check((contract_id is null and installment is null) or (contract_id is not null and installment between 1 and 60));
create unique index atraction_finance_installment on public.atraction_finance(tenant_id,contract_id,installment) where contract_id is not null;
create trigger atraction_audit_contract before insert or update on public.atraction_contracts for each row execute function atraction_private.audit_record();
create trigger atraction_event_contract after insert or update on public.atraction_contracts for each row execute function atraction_private.record_financial_event();
-- A single transaction protects sale conversion from partial saves and duplicate installments.
create function atraction_private.create_contract(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid:=(p->>'tenant_id')::uuid; cid uuid:=(p->>'id')::uuid; c public.atraction_contracts; i integer; n integer; linked public.atraction_deals; previous public.atraction_contracts;
begin
 if auth.uid() is null or coalesce(atraction_private.role_for(t),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,7));
 if exists(select 1 from public.atraction_contracts where id=cid and tenant_id=t) then return cid;end if;
 if not exists(select 1 from public.atraction_contacts where tenant_id=t and id=(p->>'contact_id')::uuid and deleted_at is null) then raise exception 'invalid contact';end if;
 if nullif(p->>'deal_id','') is not null then
 select * into linked from public.atraction_deals where id=(p->>'deal_id')::uuid and tenant_id=t and deleted_at is null for update;
 if linked.id is null or linked.contact_id<>(p->>'contact_id')::uuid then raise exception 'invalid sale';end if;
 end if;
 if nullif(p->>'renews_id','') is not null then
 select * into previous from public.atraction_contracts where id=(p->>'renews_id')::uuid and tenant_id=t for update;
 if previous.id is null or previous.contact_id<>(p->>'contact_id')::uuid or (p->>'start_date')::date<=previous.end_date then raise exception 'invalid renewal';end if;
 end if;
 n:=case when p->>'mode'='once' then 1 else (p->>'periods')::integer end;
 insert into public.atraction_contracts(id,tenant_id,owner_id,contact_id,deal_id,renews_id,title,plan,mode,amount_cents,periods,start_date,first_due_date,end_date,notes)
 values(cid,t,auth.uid(),(p->>'contact_id')::uuid,nullif(p->>'deal_id','')::uuid,nullif(p->>'renews_id','')::uuid,trim(p->>'title'),coalesce(p->>'plan',''),p->>'mode',(p->>'amount_cents')::bigint,n,(p->>'start_date')::date,(p->>'first_due_date')::date,((p->>'start_date')::date+make_interval(months=>n)-interval '1 day')::date,coalesce(p->>'notes','')) returning * into c;
 for i in 0..n-1 loop
 insert into public.atraction_finance(tenant_id,owner_id,contact_id,contract_id,installment,title,direction,amount_cents,category,due_date)
 values(t,auth.uid(),c.contact_id,c.id,i+1,c.title||' · '||(i+1)||'/'||n,'income',case when c.mode='installments' then c.amount_cents/n+case when i<c.amount_cents%n then 1 else 0 end else c.amount_cents end,case when c.mode='monthly' then 'Mensalidades' else 'Contratos' end,(c.first_due_date+make_interval(months=>i))::date);
 end loop;
 update public.atraction_contacts set lifecycle='customer',customer_since=coalesce(customer_since,c.start_date) where tenant_id=t and id=c.contact_id;
 if linked.id is not null then update public.atraction_deals set stage=4 where tenant_id=t and id=linked.id;end if;
 insert into public.atraction_activities(tenant_id,owner_id,contact_id,title,due_at,purpose) select t,owner_id,id,'Dar boas-vindas e combinar próximos passos',c.start_date::timestamp at time zone 'America/Sao_Paulo','onboarding' from public.atraction_contacts where tenant_id=t and id=c.contact_id on conflict do nothing;
 return cid;
end $$;
revoke all on function atraction_private.create_contract(jsonb) from public,anon;
grant execute on function atraction_private.create_contract(jsonb) to authenticated;
create function public.atraction_create_contract(p jsonb) returns uuid language sql security invoker set search_path='' as $$select atraction_private.create_contract(p)$$;
revoke all on function public.atraction_create_contract(jsonb) from public,anon;
grant execute on function public.atraction_create_contract(jsonb) to authenticated;
create function atraction_private.contract_action(contract uuid,action text,amount bigint,effective date) returns void language plpgsql security definer set search_path='' as $$
declare c public.atraction_contracts;
begin
 select * into c from public.atraction_contracts where id=contract for update;
 if auth.uid() is null or coalesce(atraction_private.role_for(c.tenant_id),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 if c.status<>'active' or effective is null or effective<current_date then raise exception 'invalid date or contract';end if;
 if action='adjust' then
 if c.mode<>'monthly' or amount is null or amount not between 1 and 999999999999 or not exists(select 1 from public.atraction_finance where contract_id=c.id and deleted_at is null and settled_date is null and due_date>=effective) then raise exception 'invalid adjustment';end if;
 update public.atraction_finance set amount_cents=amount where contract_id=c.id and tenant_id=c.tenant_id and settled_date is null and deleted_at is null and due_date>=effective;
 update public.atraction_contracts set amount_cents=amount where id=c.id;
 elsif action='cancel' then
 if effective<>current_date then raise exception 'cancel is immediate';end if;
 update public.atraction_finance set deleted_at=now() where contract_id=c.id and tenant_id=c.tenant_id and settled_date is null and deleted_at is null and due_date>=effective;
 update public.atraction_contracts set status='cancelled' where id=c.id;
 else raise exception 'invalid action';end if;
end $$;
revoke all on function atraction_private.contract_action(uuid,text,bigint,date) from public,anon;
grant execute on function atraction_private.contract_action(uuid,text,bigint,date) to authenticated;
create function public.atraction_contract_action(contract uuid,action text,amount bigint,effective date) returns void language sql security invoker set search_path='' as $$select atraction_private.contract_action(contract,action,amount,effective)$$;
revoke all on function public.atraction_contract_action(uuid,text,bigint,date) from public,anon;
grant execute on function public.atraction_contract_action(uuid,text,bigint,date) to authenticated;
-- First-touch attribution: a repeat form never overwrites existing customer attribution/consent.
create function atraction_private.capture_attributed(slug text,person_name text,person_phone text,accepted boolean,attribution jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare t uuid;begin
 select id into t from public.atraction_tenants where capture_slug=slug and capture_enabled;
 if t is null or accepted is distinct from true or person_name is null or length(trim(person_name)) not between 1 and 160 or person_phone is null or person_phone !~ '^\+[1-9][0-9]{9,14}$' then raise exception 'invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 if (select count(*) from public.atraction_contacts where tenant_id=t and created_at>now()-interval '1 hour')>=30 then raise exception 'try later';end if;
 insert into public.atraction_contacts(tenant_id,name,phone,source,campaign,medium,referred_by,consent,consent_proof)
 values(t,trim(person_name),person_phone,coalesce(nullif(left(attribution->>'utm_source',100),''),'Página'),coalesce(left(attribution->>'utm_campaign',160),''),coalesce(left(attribution->>'utm_medium',100),''),coalesce(left(attribution->>'ref',160),''),true,'Formulário público: consentimento expresso em '||now()::text) on conflict(tenant_id,phone) do nothing;return true;
end $$;
revoke all on function atraction_private.capture_attributed(text,text,text,boolean,jsonb) from public;
grant execute on function atraction_private.capture_attributed(text,text,text,boolean,jsonb) to anon,authenticated;
create function public.atraction_capture_attributed(slug text,person_name text,person_phone text,accepted boolean,attribution jsonb) returns boolean language sql security invoker set search_path='' as $$select atraction_private.capture_attributed(slug,person_name,person_phone,accepted,attribution)$$;
revoke all on function public.atraction_capture_attributed(text,text,text,boolean,jsonb) from public;
grant execute on function public.atraction_capture_attributed(text,text,text,boolean,jsonb) to anon,authenticated;
-- Private documents, 5 MB/file, 100 MB/account. Metadata is required before upload.
create table public.atraction_documents (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,
 contact_id uuid not null,name text not null check(length(name) between 1 and 200),path text not null unique,mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg')),size integer not null check(size between 1 and 5242880),
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id),check(path=tenant_id::text||'/'||id::text)
);
create index atraction_documents_contact on public.atraction_documents(tenant_id,contact_id);
create index atraction_documents_owner on public.atraction_documents(owner_id);
alter table public.atraction_documents enable row level security;
revoke all on public.atraction_documents from anon,authenticated;
grant select,insert,update on public.atraction_documents to authenticated;
create policy documents_read on public.atraction_documents for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy documents_insert on public.atraction_documents for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy documents_update on public.atraction_documents for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create function atraction_private.document_quota() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text,8));
 if TG_OP='UPDATE' and (new.size<>old.size or new.path<>old.path or new.contact_id<>old.contact_id or new.mime_type<>old.mime_type) then raise exception 'immutable file';end if;
 if TG_OP='INSERT' and ((select count(*) from public.atraction_documents where tenant_id=new.tenant_id)>=20 or (select coalesce(sum(size),0) from public.atraction_documents where tenant_id=new.tenant_id)+new.size>104857600) then raise exception 'document quota exceeded';end if;return new;
end $$;
revoke all on function atraction_private.document_quota() from public,anon,authenticated;
create trigger atraction_doc_quota before insert or update on public.atraction_documents for each row execute function atraction_private.document_quota();
create trigger atraction_audit_doc before insert or update on public.atraction_documents for each row execute function atraction_private.audit_record();
create trigger atraction_event_doc after insert or update on public.atraction_documents for each row execute function atraction_private.record_financial_event();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('atraction-documents','atraction-documents',false,5242880,array['application/pdf','image/png','image/jpeg']);
create policy atraction_document_read on storage.objects for select to authenticated using(bucket_id='atraction-documents' and exists(select 1 from public.atraction_documents d where d.path=storage.objects.name and d.deleted_at is null));
create policy atraction_document_upload on storage.objects for insert to authenticated with check(bucket_id='atraction-documents' and exists(select 1 from public.atraction_documents d where d.path=storage.objects.name and d.deleted_at is null and d.owner_id=(select auth.uid())));
-- Keep financial contracts and potentially sensitive attachments out of reader audit feeds.
drop policy event_read on public.atraction_events;
create policy event_read on public.atraction_events for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='viewer' and entity not in ('finance','suppliers','contracts','documents')));
-- A contract installment cannot be reassigned or detached through the general ledger API.
create function atraction_private.check_installment() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_OP='UPDATE' and (new.contract_id is distinct from old.contract_id or new.installment is distinct from old.installment) then raise exception 'immutable installment';end if;
 if new.contract_id is not null and not exists(select 1 from public.atraction_contracts c where c.id=new.contract_id and c.tenant_id=new.tenant_id and c.contact_id=new.contact_id and new.direction='income') then raise exception 'invalid installment';end if;return new;
end $$;
revoke all on function atraction_private.check_installment() from public,anon,authenticated;
create trigger atraction_check_installment before insert or update on public.atraction_finance for each row execute function atraction_private.check_installment();
