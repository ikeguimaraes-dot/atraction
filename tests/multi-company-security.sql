begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-00000000ea01','multi-owner@example.invalid',now()),
('00000000-0000-4000-8000-00000000eb01','multi-team@example.invalid',now()),
('00000000-0000-4000-8000-00000000ec01','second-owner@example.invalid',now());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ea01","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-00000000ea02','Empresa A','00000000-0000-4000-8000-00000000ea01'),('00000000-0000-4000-8000-00000000ea03','Empresa B','00000000-0000-4000-8000-00000000ea01');
select pg_temp.assert_true((select count(*)=2 from public.atraction_tenants),'same user owns two companies');
select pg_temp.assert_true((select count(*)=2 from public.atraction_members where role='owner'),'owner membership per company');
insert into public.atraction_contacts(id,tenant_id,owner_id,name,phone) values('00000000-0000-4000-8000-00000000ea04','00000000-0000-4000-8000-00000000ea02','00000000-0000-4000-8000-00000000ea01','Pessoa A','+5511988887777'),('00000000-0000-4000-8000-00000000ea05','00000000-0000-4000-8000-00000000ea03','00000000-0000-4000-8000-00000000ea01','Pessoa B','+5511988887777');
insert into public.atraction_finance(tenant_id,title,direction,amount_cents,category,due_date) values('00000000-0000-4000-8000-00000000ea02','Receita A','income',10000,'Serviços',current_date),('00000000-0000-4000-8000-00000000ea03','Receita B','income',20000,'Serviços',current_date);
select pg_temp.assert_true((select sum(amount_cents)=30000 from public.atraction_finance),'owner consolidates both');
select public.atraction_add_member('00000000-0000-4000-8000-00000000ea02','multi-team@example.invalid','manager');
select public.atraction_add_member('00000000-0000-4000-8000-00000000ea03','multi-team@example.invalid','manager');
select public.atraction_add_member('00000000-0000-4000-8000-00000000ea02','second-owner@example.invalid','owner');
select pg_temp.assert_true((select count(*)=2 from jsonb_array_elements(atraction_private.team('00000000-0000-4000-8000-00000000ea02')) m where m->>'role'='owner'),'company supports multiple owners');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ec01","role":"authenticated","aal":"aal1"}',true);
update public.atraction_tenants set capture_title='Alterada pelo segundo dono' where id='00000000-0000-4000-8000-00000000ea02';
select pg_temp.assert_true((select capture_title='Alterada pelo segundo dono' from public.atraction_tenants where id='00000000-0000-4000-8000-00000000ea02'),'second owner changes company settings');
select public.atraction_member_role('00000000-0000-4000-8000-00000000ea02','00000000-0000-4000-8000-00000000ea01','manager');
select pg_temp.assert_true((select owner_id='00000000-0000-4000-8000-00000000ec01' from public.atraction_tenants where id='00000000-0000-4000-8000-00000000ea02'),'primary owner moves to another owner');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000eb01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=2 from public.atraction_tenants),'direct member sees two companies');
select pg_temp.assert_true((select count(*)=2 from public.atraction_contacts),'manager reads allowed contacts');
select pg_temp.assert_true((select sum(amount_cents)=30000 from public.atraction_finance),'consolidation honors direct memberships');
do $$begin begin update public.atraction_contacts set tenant_id='00000000-0000-4000-8000-00000000ea02' where id='00000000-0000-4000-8000-00000000ea05';raise exception 'FAIL: moved across company';exception when raise_exception then if sqlerrm like 'FAIL:%' then raise;end if;end;end $$;
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-00000000eb02','Empresa da equipe','00000000-0000-4000-8000-00000000eb01');
-- Client inserts without RETURNING, then loads companies after the owner trigger completes.
select pg_temp.assert_true((select count(*)=3 from public.atraction_tenants),'member may register own company');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000eb01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=3 from public.atraction_tenants),'password session reads all memberships');
select 'multi-company security passed' as result;
rollback;
