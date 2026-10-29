-- Execute inside a transaction and roll back.
select set_config('atraction.test_tenant',m.tenant_id::text,true),set_config('atraction.test_manager',m.user_id::text,true),set_config('atraction.test_owner',o.user_id::text,true)
from public.atraction_members m join public.atraction_members o on o.tenant_id=m.tenant_id and o.role='owner' where m.role='manager' limit 1;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.atraction_finance(id,tenant_id,owner_id,title,direction,amount_cents,category,due_date)
values('00000000-0000-4000-8000-00000000fb01',current_setting('atraction.test_tenant')::uuid,current_setting('atraction.test_owner')::uuid,'Payer correction test','expense',55000,'Materiais',current_date);
select public.atraction_record_payment('00000000-0000-4000-8000-00000000fb01',55000,current_date,null,'00000000-0000-4000-8000-00000000fb02');
select set_config('atraction.original_payment',(select payments->0 from public.atraction_finance where id='00000000-0000-4000-8000-00000000fb01')::text,true);
select public.atraction_correct_payment_payer('00000000-0000-4000-8000-00000000fb01','00000000-0000-4000-8000-00000000fb02',current_setting('atraction.original_payment')::jsonb,current_setting('atraction.test_manager')::uuid);
do $$declare f public.atraction_finance; begin
 select * into f from public.atraction_finance where id='00000000-0000-4000-8000-00000000fb01';
 if jsonb_array_length(f.payments)<>1 or f.settled_date<>current_date or ((f.payments->0)-'payer_user_id'-'allocations') <> current_setting('atraction.original_payment')::jsonb or f.payments->0->>'payer_user_id'<>current_setting('atraction.test_manager') or f.payments->0->'allocations' <> '[{"user_id":null,"amount_cents":55000}]'::jsonb then raise exception 'Payment preservation failed'; end if;
 begin
  perform public.atraction_correct_payment_payer(f.id,'00000000-0000-4000-8000-00000000fb02',current_setting('atraction.original_payment')::jsonb,null);
  raise exception 'Stale correction allowed';
 exception when raise_exception then if sqlerrm not like 'Esta baixa foi alterada.%' then raise;end if;end;
end $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('atraction.test_manager'),'role','authenticated')::text,true);
do $$begin
 begin
  perform public.atraction_correct_payment_payer('00000000-0000-4000-8000-00000000fb01','00000000-0000-4000-8000-00000000fb02',(select payments->0 from public.atraction_finance where id='00000000-0000-4000-8000-00000000fb01'),null);
  raise exception 'Manager correction allowed';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Payment preserved; payer corrected; stale writes and managers denied.' as result;
