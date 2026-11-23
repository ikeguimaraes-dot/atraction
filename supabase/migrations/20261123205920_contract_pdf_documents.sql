-- Contract PDFs share the document registry, with a dedicated private PDF-only bucket.
alter table public.atraction_documents
  add column contract_id uuid,
  add constraint atraction_documents_contract_fkey foreign key (tenant_id, contract_id)
    references public.atraction_contracts(tenant_id, id);
alter table public.atraction_documents drop constraint atraction_documents_document_kind_check;
alter table public.atraction_documents add constraint atraction_documents_document_kind_check
  check (document_kind in ('customer', 'nfe', 'receipt', 'contract'));
alter table public.atraction_documents drop constraint atraction_documents_check1;
alter table public.atraction_documents add constraint atraction_documents_check1 check (
  (document_kind = 'customer' and contact_id is not null and finance_id is null and contract_id is null) or
  (document_kind in ('nfe', 'receipt') and contact_id is null and finance_id is not null and contract_id is null) or
  (document_kind = 'contract' and contact_id is null and finance_id is null and contract_id is not null and mime_type = 'application/pdf')
);
create index atraction_documents_contract on public.atraction_documents(tenant_id, contract_id);

create or replace function atraction_private.document_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text, 8));
  if TG_OP = 'UPDATE' and (
    new.size <> old.size or new.path <> old.path or
    new.contact_id is distinct from old.contact_id or
    new.finance_id is distinct from old.finance_id or
    new.contract_id is distinct from old.contract_id or
    new.mime_type <> old.mime_type or
    (new.document_kind <> old.document_kind and not (new.document_kind in ('nfe','receipt') and old.document_kind in ('nfe','receipt')))
  ) then raise exception 'immutable file'; end if;
  if new.finance_id is not null and not exists (
    select 1 from public.atraction_finance where tenant_id = new.tenant_id and id = new.finance_id and direction = 'expense'
  ) then raise exception 'document requires an expense'; end if;
  if TG_OP = 'INSERT' and new.document_kind = 'contract' and not exists (
    select 1 from storage.objects where bucket_id = 'atraction-contracts' and name = new.path
      and owner_id = auth.uid()::text
      and (metadata->>'size')::bigint = new.size
      and metadata->>'mimetype' = 'application/pdf'
  ) then raise exception 'upload contract PDF before registering it'; end if;
  if TG_OP = 'INSERT' and (
    (select count(*) from public.atraction_documents where tenant_id = new.tenant_id) >= 500 or
    (select coalesce(sum(size), 0) from public.atraction_documents where tenant_id = new.tenant_id) + new.size > 524288000
  ) then raise exception 'document quota exceeded'; end if;
  return new;
end $$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('atraction-contracts', 'atraction-contracts', false, 5242880, array['application/pdf']);

create policy atraction_contract_pdf_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'atraction-contracts' and
  name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$' and
  exists (select 1 from public.atraction_members m where m.tenant_id::text = split_part(name, '/', 1)
    and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager'))
);
create policy atraction_contract_pdf_read on storage.objects for select to authenticated using (
  bucket_id = 'atraction-contracts' and
  exists (select 1 from public.atraction_members m where m.tenant_id::text = split_part(name, '/', 1)
    and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')) and
  (owner_id = (select auth.uid()::text) or exists (
    select 1 from public.atraction_documents d where d.path = storage.objects.name
      and d.document_kind = 'contract' and d.deleted_at is null
  ))
);
-- Only unlinked uploads may be cleaned up; registered attachments remain protected.
create policy atraction_contract_pdf_cleanup on storage.objects for delete to authenticated using (
  bucket_id = 'atraction-contracts' and owner_id = (select auth.uid()::text) and
  exists (select 1 from public.atraction_members m where m.tenant_id::text = split_part(name, '/', 1)
    and m.user_id = (select auth.uid()) and m.role in ('owner', 'manager')) and
  not exists (select 1 from public.atraction_documents d where d.path = storage.objects.name)
);
