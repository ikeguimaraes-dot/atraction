begin;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-00000000ed01','installments-test@example.invalid',now());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ed01","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-00000000ed02','Parcelas teste','00000000-0000-4000-8000-00000000ed01');
insert into public.atraction_finance(tenant_id,title,direction,amount_cents,category,due_date,payments)
select '00000000-0000-4000-8000-00000000ed02', 'Taxa · '||i||'/12', direction, 833+case when i<=4 then 1 else 0 end,'Taxas',('2028-01-31'::date+make_interval(months=>i-1))::date,'[]'::jsonb from generate_series(1,12) i cross join unnest(array['income','expense']) direction;
do $$begin
if (select count(*) from public.atraction_finance where tenant_id='00000000-0000-4000-8000-00000000ed02')<>24 then raise exception 'Missing installments'; end if;
if exists(select direction from public.atraction_finance where tenant_id='00000000-0000-4000-8000-00000000ed02' group by direction having sum(amount_cents)<>10000) then raise exception 'Wrong total'; end if;
begin
insert into public.atraction_finance(tenant_id,title,direction,amount_cents,category,due_date) values
('00000000-0000-4000-8000-00000000ed02','Atomic test','expense',100,'Taxas',current_date),
('00000000-0000-4000-8000-00000000ed02','','expense',100,'Taxas',current_date);
raise exception 'Invalid batch accepted';
exception when check_violation then null; end;
if exists(select 1 from public.atraction_finance where title='Atomic test') then raise exception 'Partial batch saved';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ed01","role":"authenticated","aal":"aal1"}',true);
do $$begin
begin
insert into public.atraction_finance(tenant_id,title,direction,amount_cents,category,due_date) values('00000000-0000-4000-8000-00000000ed02','Denied','expense',100,'Taxas',current_date);
raise exception 'MFA bypass';exception when insufficient_privilege then null;end;
end $$;
select 'installments atomic save, totals and MFA passed' as result;
rollback;
