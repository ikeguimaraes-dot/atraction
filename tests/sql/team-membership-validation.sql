-- Run inside a transaction and roll back; use an existing owner/manager pair.
select set_config('atraction.test_tenant',m.tenant_id::text,true),
 set_config('atraction.test_manager',m.user_id::text,true),
 set_config('atraction.test_owner',o.user_id::text,true)
from public.atraction_members m join public.atraction_members o on o.tenant_id=m.tenant_id and o.role='owner'
where m.role='manager' limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,due_date,purchase_payer)
values('00000000-0000-4000-8000-00000000fc01',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_owner')::uuid,'Team payer test','expense',345368,'Sistema',current_date,current_setting('atraction.test_manager'));
-- A manager may also register an expense paid by another member.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_manager'),'role','authenticated')::text,true);
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,due_date,purchase_payer)
values('00000000-0000-4000-8000-00000000fc02',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_manager')::uuid,'Manager payer test','expense',100,'Sistema',current_date,current_setting('atraction.test_owner'));
update public.atraction_finance set purchase_payer=current_setting('atraction.test_owner') where id='00000000-0000-4000-8000-00000000fc01';
do $$begin
 if (select count(*) from public.atraction_finance where id in ('00000000-0000-4000-8000-00000000fc01','00000000-0000-4000-8000-00000000fc02'))<>2 then raise exception 'Payer registration failed';end if;
 if exists(select 1 from public.atraction_members where user_id<>auth.uid() and coalesce(atraction_private.role_for(tenant_id),'') not in ('owner','manager')) then raise exception 'Cross-tenant membership leak';end if;
 begin
  update public.atraction_finance set purchase_payer='00000000-0000-4000-8000-00000000fc99' where id='00000000-0000-4000-8000-00000000fc01';
  raise exception 'Invalid payer accepted';
 exception when raise_exception then if sqlerrm<>'purchase payer must be a tenant member' then raise;end if;end;
 begin
  update public.atraction_finance set deleted_at=now() where id='00000000-0000-4000-8000-00000000fc02';
  raise exception 'Manager deletion accepted';
 exception when insufficient_privilege then null;end;
end $$;
-- A non-member sees no membership rows, even when targeting a known company.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000fc99","role":"authenticated"}',true);
do $$begin if exists(select 1 from public.atraction_members) then raise exception 'Non-member can read team';end if;end $$;
reset role;
select 'Owner and manager can select teammates; outsider reads and invalid payers denied; manager deletion still blocked.' as result;
