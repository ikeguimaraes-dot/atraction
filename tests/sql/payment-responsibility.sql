-- Run in a transaction and roll back. Exercises a fully paid expense with two payments.
select set_config('atraction.test_tenant',m.tenant_id::text,true),set_config('atraction.test_manager',m.user_id::text,true),set_config('atraction.test_owner',o.user_id::text,true)
from public.atraction_members m join public.atraction_members o on o.tenant_id=m.tenant_id and o.role='owner' where m.role='manager' limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,due_date)
values('00000000-0000-4000-8000-00000000fd01',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_owner')::uuid,'Responsibility correction test','expense',55000,'Materiais',current_date);
select public.atraction_record_payment('00000000-0000-4000-8000-00000000fd01',35000,current_date,null,'00000000-0000-4000-8000-00000000fd02');
select public.atraction_record_payment('00000000-0000-4000-8000-00000000fd01',20000,current_date,null,'00000000-0000-4000-8000-00000000fd03');
select set_config('atraction.original_payments',(select payments from public.atraction_finance where id='00000000-0000-4000-8000-00000000fd01')::text,true);
select public.atraction_correct_payment_responsibility('00000000-0000-4000-8000-00000000fd01','00000000-0000-4000-8000-00000000fd02',current_setting('atraction.original_payments')::jsonb->0,current_setting('atraction.test_owner')::uuid,current_setting('atraction.test_manager')::uuid);
do $$declare f public.atraction_finance; begin
 select * into f from public.atraction_finance where id='00000000-0000-4000-8000-00000000fd01';
 if jsonb_array_length(f.payments)<>2 or f.settled_date<>current_date
   or ((f.payments->0)-'payer_user_id'-'allocations') <> current_setting('atraction.original_payments')::jsonb->0
   or f.payments->1 <> current_setting('atraction.original_payments')::jsonb->1
   or f.payments->0->>'payer_user_id'<>current_setting('atraction.test_owner')
   or f.payments->0->'allocations' <> jsonb_build_array(jsonb_build_object('user_id',current_setting('atraction.test_manager'),'amount_cents',35000))
 then raise exception 'Correction changed payment data or failed to set participants'; end if;
 begin
  perform public.atraction_correct_payment_responsibility(f.id,'00000000-0000-4000-8000-00000000fd02',current_setting('atraction.original_payments')::jsonb->0,null,null);
  raise exception 'Stale correction allowed';
 exception when raise_exception then if sqlerrm not like 'Esta baixa foi alterada.%' then raise;end if;end;
 begin
  perform public.atraction_correct_payment_responsibility(f.id,'00000000-0000-4000-8000-00000000fd02',f.payments->0,null,'00000000-0000-4000-8000-00000000fd99');
  raise exception 'Invalid owner allowed';
 exception when raise_exception then if sqlerrm <> 'Escolha um responsável que faça parte desta empresa.' then raise;end if;end;
 -- Company can be selected as owner independently of the payer.
 perform public.atraction_correct_payment_responsibility(f.id,'00000000-0000-4000-8000-00000000fd02',f.payments->0,current_setting('atraction.test_manager')::uuid,null);
 if (select payments->0->'allocations' from public.atraction_finance where id=f.id) <> '[{"user_id":null,"amount_cents":35000}]'::jsonb then raise exception 'Company ownership failed';end if;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_manager'),'role','authenticated')::text,true);
do $$begin
 begin
  perform public.atraction_correct_payment_responsibility('00000000-0000-4000-8000-00000000fd01','00000000-0000-4000-8000-00000000fd02',(select payments->0 from public.atraction_finance where id='00000000-0000-4000-8000-00000000fd01'),null,null);
  raise exception 'Manager correction allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Both participants corrected; payments and paid status preserved; invalid owners, stale changes and managers rejected.' as result;
