-- Run inside a transaction and roll back. Requires one company with owner/manager.
select set_config('atraction.test_tenant', m.tenant_id::text, true),
       set_config('atraction.test_manager', m.user_id::text, true),
       set_config('atraction.test_owner', o.user_id::text, true)
from public.atraction_members m join public.atraction_members o on o.tenant_id=m.tenant_id and o.role='owner'
where m.role='manager' limit 1;
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('atraction.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,dre_group,due_date)
values ('00000000-0000-4000-8000-00000000fa01',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_owner')::uuid,'Permissions test expense','expense',10000,'Materiais','expense',current_date);
insert into public.atraction_contacts(id,tenant_id,owner_id,name,phone)
values ('00000000-0000-4000-8000-00000000fa02',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_owner')::uuid,'Permissions test contact','+5511999994321');
-- Owner can settle, reverse, archive and restore.
select public.atraction_record_payment('00000000-0000-4000-8000-00000000fa01',100,current_date,null,'00000000-0000-4000-8000-00000000fa03');
select public.atraction_record_payment('00000000-0000-4000-8000-00000000fa01',100,current_date,null,'00000000-0000-4000-8000-00000000fa03','00000000-0000-4000-8000-00000000fa03');
update public.atraction_contacts set deleted_at=now() where id='00000000-0000-4000-8000-00000000fa02';
update public.atraction_contacts set deleted_at=null where id='00000000-0000-4000-8000-00000000fa02';
select set_config('request.jwt.claims', jsonb_build_object('sub',current_setting('atraction.test_manager'),'role','authenticated')::text,true);
-- Manager can add and edit unpaid expense information.
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,dre_group,due_date)
values ('00000000-0000-4000-8000-00000000fa04',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_manager')::uuid,'Manager expense','expense',55000,'Materiais','expense',current_date);
update public.atraction_finance set title='Manager edited expense' where id='00000000-0000-4000-8000-00000000fa04';
select public.atraction_edit_expense_purchase(
 '00000000-0000-4000-8000-00000000fa04',
 (select jsonb_build_array(jsonb_build_object('id',id,'updated_at',updated_at)) from public.atraction_finance where id='00000000-0000-4000-8000-00000000fa04'),
 jsonb_build_object('title','Manager edited purchase','category','Materiais','dre_group','expense','amount_cents',55000,'count',1,'first_due',current_date,'issue_date',current_date,'payment_method','pix','purchase_payer','company','kind','nfe')
);
insert into public.atraction_documents(id,tenant_id,owner_id,name,path,mime_type,size,finance_id,document_kind,issue_date)
values('00000000-0000-4000-8000-00000000fa06',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_manager')::uuid,'Permissions test.pdf',current_setting('atraction.test_tenant')||'/00000000-0000-4000-8000-00000000fa06','application/pdf',100,'00000000-0000-4000-8000-00000000fa04','nfe',current_date);
create function pg_temp.expect_denied(command text) returns void language plpgsql security invoker as $$
begin
  begin
    execute command;
  exception when insufficient_privilege then return;
    when raise_exception then
      if sqlerrm = 'not allowed' then return; end if;
      raise;
  end;
  raise exception 'Permission test unexpectedly allowed: %',command;
end $$;
select pg_temp.expect_denied($q$update public.atraction_finance set deleted_at=now() where id='00000000-0000-4000-8000-00000000fa04'$q$);
select pg_temp.expect_denied($q$update public.atraction_documents set deleted_at=now() where id='00000000-0000-4000-8000-00000000fa06'$q$);
select pg_temp.expect_denied($q$update public.atraction_contacts set deleted_at=now() where id='00000000-0000-4000-8000-00000000fa02'$q$);
delete from public.atraction_finance where id='00000000-0000-4000-8000-00000000fa04';
do $$begin if not exists(select 1 from public.atraction_finance where id='00000000-0000-4000-8000-00000000fa04') then raise exception 'Manager deleted finance row';end if;end $$;
select pg_temp.expect_denied($q$select public.atraction_record_payment('00000000-0000-4000-8000-00000000fa04',100,current_date,null,'00000000-0000-4000-8000-00000000fa05')$q$);
select pg_temp.expect_denied($q$select public.atraction_record_payment('00000000-0000-4000-8000-00000000fa04',100,current_date,null,'00000000-0000-4000-8000-00000000fa05','00000000-0000-4000-8000-00000000fa05')$q$);
select pg_temp.expect_denied($q$select public.atraction_record_shared_payment('00000000-0000-4000-8000-00000000fa04',100,current_date,null,'00000000-0000-4000-8000-00000000fa05',null,'[{"user_id":null,"amount_cents":100}]')$q$);
select pg_temp.expect_denied($q$update public.atraction_finance set settled_date=current_date where id='00000000-0000-4000-8000-00000000fa04'$q$);
select pg_temp.expect_denied($q$update public.atraction_finance set payments='[{"id":"00000000-0000-4000-8000-00000000fa05","date":"2026-10-28","amount_cents":100,"account_id":null}]' where id='00000000-0000-4000-8000-00000000fa04'$q$);
select pg_temp.expect_denied($q$insert into public.atraction_finance(tenant_id,owner_id,title,direction,amount_cents,category,due_date,settled_date) values(current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_manager')::uuid,'Already paid','expense',100,'Materiais',current_date,current_date)$q$);
select pg_temp.expect_denied($q$insert into public.atraction_settlements(tenant_id,owner_id,from_user_id,to_user_id,amount_cents,date) values(current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_manager')::uuid,null,current_setting('atraction.test_manager')::uuid,100,current_date)$q$);
reset role;
-- Trigger coverage includes every soft-deletable Atraction business table.
do $$begin
 if exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name like 'atraction\_%' escape '\' and c.column_name='deleted_at' and not exists(select 1 from pg_trigger t where t.tgrelid=('public.'||c.table_name)::regclass and t.tgname='atraction_00_manager_permissions')) then raise exception 'Missing manager deletion guard'; end if;
end $$;
select 'Manager permission tests passed; transaction must be rolled back.' as result;
