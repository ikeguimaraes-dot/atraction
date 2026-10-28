-- Keep historical archived installments while allowing a new active schedule.
drop index public.atraction_purchase_installment;
create unique index atraction_purchase_installment on public.atraction_finance(tenant_id,purchase_id,purchase_installment)
where purchase_id is not null and deleted_at is null;

-- NF/receipt classification can change without changing file identity or ownership.
create or replace function atraction_private.document_quota() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text,8));
 if TG_OP='UPDATE' and (new.size<>old.size or new.path<>old.path or new.contact_id is distinct from old.contact_id or new.finance_id is distinct from old.finance_id or new.mime_type<>old.mime_type or (new.document_kind<>old.document_kind and not (new.document_kind in ('nfe','receipt') and old.document_kind in ('nfe','receipt')))) then raise exception 'immutable file';end if;
 if new.finance_id is not null and not exists(select 1 from public.atraction_finance where tenant_id=new.tenant_id and id=new.finance_id and direction='expense') then raise exception 'document requires an expense';end if;
 if TG_OP='INSERT' and ((select count(*) from public.atraction_documents where tenant_id=new.tenant_id)>=500 or (select coalesce(sum(size),0) from public.atraction_documents where tenant_id=new.tenant_id)+new.size>524288000) then raise exception 'document quota exceeded';end if;return new;
end $$;

create function public.atraction_edit_expense_purchase(
 entry_id uuid, expected jsonb, changes jsonb,
 document_id uuid default null, document_version timestamptz default null,
 replacement_id uuid default null
) returns void language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare
 source public.atraction_finance; row public.atraction_finance; doc public.atraction_documents;
 ids uuid[]; total bigint; old_total bigint; n int; old_n int; i int;
 first_due date; issue_date date; old_due date; replan boolean; group_id uuid;
 title text; category text; method text; payer text; amount bigint; due date;
begin
 select * into source from public.atraction_finance where id=entry_id and deleted_at is null for update;
 if source.id is null or source.direction<>'expense' or source.contract_id is not null
    or auth.uid() is null or coalesce(atraction_private.role_for(source.tenant_id),'') not in ('owner','manager') then
   raise exception 'Sem permissão para editar esta despesa.';
 end if;
 group_id:=coalesce(source.purchase_id,source.id);
 -- Serialize edits to every active installment before checking the submitted versions.
 perform 1 from public.atraction_finance f where f.tenant_id=source.tenant_id
   and coalesce(f.purchase_id,f.id)=group_id and f.deleted_at is null order by f.id for update;
 select array_agg(f.id order by f.purchase_installment nulls last,f.due_date,f.id),sum(f.amount_cents),min(f.due_date)
 into ids,old_total,old_due from public.atraction_finance f where f.tenant_id=source.tenant_id
   and coalesce(f.purchase_id,f.id)=group_id and f.deleted_at is null;
 old_n:=cardinality(ids);
 if jsonb_typeof(expected) is distinct from 'array' or jsonb_array_length(expected)<>old_n
   or exists(select 1 from public.atraction_finance f where f.id=any(ids) and not exists(
     select 1 from jsonb_array_elements(expected) e where e->>'id'=f.id::text and (e->>'updated_at')::timestamptz=f.updated_at)) then
   raise exception 'Esta despesa foi alterada. Feche a edição e abra novamente.';
 end if;
 total:=(changes->>'amount_cents')::bigint; n:=(changes->>'count')::int;
 first_due:=(changes->>'first_due')::date; issue_date:=(changes->>'issue_date')::date;
 title:=trim(changes->>'title'); category:=trim(changes->>'category');
 method:=changes->>'payment_method'; payer:=changes->>'purchase_payer';
 if total is null or total<1 or total>999999999999 or n is null or n<1 or n>60 or total<n
   or first_due is null or issue_date is null or issue_date>current_date or coalesce(length(title),0) not between 1 and 200
   or coalesce(length(category),0) not between 1 and 120 or method is null
   or method not in ('credit_card','debit_card','pix','cash','bank_slip','transfer')
   or (n>1 and method not in ('credit_card','bank_slip')) or payer is null
   or (changes->>'kind') is null or changes->>'kind' not in ('nfe','receipt') then
   raise exception 'Confira os dados da despesa e do parcelamento.';
 end if;
 replan:=total<>old_total or n<>old_n or first_due<>old_due;
 if n<>old_n and (source.recurrence_id is not null or exists(select 1 from public.atraction_finance f where f.id=any(ids) and (jsonb_array_length(f.payments)>0 or f.settled_date is not null))) then
   raise exception 'Estorne os pagamentos antes de alterar a quantidade de parcelas. Lançamentos recorrentes não podem ser reparcelados.';
 end if;
 if document_id is not null then
   select * into doc from public.atraction_documents where id=document_id and tenant_id=source.tenant_id and deleted_at is null for update;
   if doc.id is null or doc.updated_at is distinct from document_version or not exists(
     select 1 from public.atraction_finance f where f.id=doc.finance_id and f.tenant_id=source.tenant_id and coalesce(f.purchase_id,f.id)=group_id) then
     raise exception 'O comprovante foi alterado. Feche a edição e abra novamente.';
   end if;
 end if;
 if replacement_id is not null and not exists(select 1 from public.atraction_documents d where d.id=replacement_id and d.tenant_id=source.tenant_id and d.finance_id=entry_id and d.deleted_at is null) then
   raise exception 'Comprovante substituto inválido.';
 end if;
 for i in 1..n loop
   amount:=total/n+case when i<=total%n then 1 else 0 end;
   due:=(first_due+make_interval(months=>i-1))::date;
   if i<=old_n then
     select * into row from public.atraction_finance where id=ids[i];
     if not replan then amount:=row.amount_cents;due:=row.due_date;end if;
     if amount<(select coalesce(sum((p->>'amount_cents')::bigint),0) from jsonb_array_elements(row.payments) p) then
       raise exception 'O valor da parcela não pode ser menor que o valor já pago.';
     end if;
     update public.atraction_finance set
       title=case when n>1 then left(title,188)||' · '||i||'/'||n else title end,
       amount_cents=amount,due_date=due,category=category,dre_group=changes->>'dre_group',
       supplier_id=nullif(changes->>'supplier_id','')::uuid,notes=coalesce(changes->>'notes',''),
       purchase_id=group_id,purchase_date=issue_date,payment_method=method,purchase_payer=payer,
       purchase_installment=i,purchase_installments=n where id=row.id;
   else
     insert into public.atraction_finance(tenant_id,owner_id,title,direction,amount_cents,category,dre_group,due_date,supplier_id,notes,purchase_id,purchase_date,payment_method,purchase_payer,purchase_installment,purchase_installments)
     values(source.tenant_id,source.owner_id,left(title,188)||' · '||i||'/'||n,'expense',amount,category,changes->>'dre_group',due,nullif(changes->>'supplier_id','')::uuid,coalesce(changes->>'notes',''),group_id,issue_date,method,payer,i,n);
   end if;
 end loop;
 if n<old_n then
   update public.atraction_finance set deleted_at=now() where id=any(ids[n+1:old_n]);
 end if;
 if replacement_id is not null then
   if document_id is not null then update public.atraction_documents set deleted_at=now() where id=document_id;end if;
   document_id:=replacement_id;
 end if;
 if document_id is not null then
   update public.atraction_documents set document_kind=changes->>'kind',document_number=coalesce(changes->>'number',''),issue_date=issue_date where id=document_id;
 end if;
end $$;
revoke all on function public.atraction_edit_expense_purchase(uuid,jsonb,jsonb,uuid,timestamptz,uuid) from public,anon;
grant execute on function public.atraction_edit_expense_purchase(uuid,jsonb,jsonb,uuid,timestamptz,uuid) to authenticated;
