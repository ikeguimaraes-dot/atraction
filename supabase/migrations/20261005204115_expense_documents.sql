alter table public.atraction_documents alter column contact_id drop not null;
alter table public.atraction_documents
  add column finance_id uuid,
  add column document_kind text not null default 'customer' check(document_kind in ('customer','nfe','receipt')),
  add column document_number text not null default '' check(length(document_number)<=80),
  add column issue_date date check(issue_date<=current_date),
  add foreign key(tenant_id,finance_id) references public.atraction_finance(tenant_id,id),
  add check(
    (document_kind='customer' and contact_id is not null and finance_id is null) or
    (document_kind in ('nfe','receipt') and contact_id is null and finance_id is not null)
  );
create index atraction_documents_finance on public.atraction_documents(tenant_id,finance_id);

create or replace function atraction_private.document_quota() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text,8));
 if TG_OP='UPDATE' and (new.size<>old.size or new.path<>old.path or new.contact_id is distinct from old.contact_id or new.finance_id is distinct from old.finance_id or new.mime_type<>old.mime_type or new.document_kind<>old.document_kind) then raise exception 'immutable file';end if;
 if new.finance_id is not null and not exists(select 1 from public.atraction_finance where tenant_id=new.tenant_id and id=new.finance_id and direction='expense') then raise exception 'document requires an expense';end if;
 if TG_OP='INSERT' and ((select count(*) from public.atraction_documents where tenant_id=new.tenant_id)>=500 or (select coalesce(sum(size),0) from public.atraction_documents where tenant_id=new.tenant_id)+new.size>524288000) then raise exception 'document quota exceeded';end if;return new;
end $$;
