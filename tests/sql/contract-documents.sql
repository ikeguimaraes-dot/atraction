begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
insert into auth.users(id,email,email_confirmed_at) values
('00000000-0000-4000-8000-00000000fd01','pdf-owner@example.invalid',now()),
('00000000-0000-4000-8000-00000000fd02','pdf-manager@example.invalid',now()),
('00000000-0000-4000-8000-00000000fd03','pdf-outsider@example.invalid',now());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000fd01","role":"authenticated"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id) values
('00000000-0000-4000-8000-00000000fd04','PDF test A','00000000-0000-4000-8000-00000000fd01'),
('00000000-0000-4000-8000-00000000fd05','PDF test B','00000000-0000-4000-8000-00000000fd01');
select public.atraction_add_member('00000000-0000-4000-8000-00000000fd04','pdf-manager@example.invalid','manager');
insert into public.atraction_contacts(id,tenant_id,name,phone) values
('00000000-0000-4000-8000-00000000fd06','00000000-0000-4000-8000-00000000fd04','PDF customer','+5511999999971');
select public.atraction_create_contract('{"id":"00000000-0000-4000-8000-00000000fd07","tenant_id":"00000000-0000-4000-8000-00000000fd04","contact_id":"00000000-0000-4000-8000-00000000fd06","title":"PDF test","plan":"","mode":"once","amount_cents":1000,"periods":1,"start_date":"2026-11-23","first_due_date":"2026-11-23","end_date":"2026-12-22","status":"active","notes":""}'::jsonb);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000fd02","role":"authenticated"}',true);
-- Storage rows represent completed API uploads, rolled back with every other fixture.
insert into storage.objects(bucket_id,name,owner_id,metadata) values
('atraction-contracts','00000000-0000-4000-8000-00000000fd04/00000000-0000-4000-8000-00000000fd08','00000000-0000-4000-8000-00000000fd02','{"size":100,"mimetype":"application/pdf"}'),
('atraction-contracts','00000000-0000-4000-8000-00000000fd04/00000000-0000-4000-8000-00000000fd09','00000000-0000-4000-8000-00000000fd02','{"size":100,"mimetype":"application/pdf"}');
insert into public.atraction_documents(id,tenant_id,contract_id,document_kind,name,path,mime_type,size) values
('00000000-0000-4000-8000-00000000fd08','00000000-0000-4000-8000-00000000fd04','00000000-0000-4000-8000-00000000fd07','contract','test.pdf','00000000-0000-4000-8000-00000000fd04/00000000-0000-4000-8000-00000000fd08','application/pdf',100);
select pg_temp.assert_true((select count(*)=1 from public.atraction_documents where contract_id='00000000-0000-4000-8000-00000000fd07'),'manager registers contract PDF');
do $$begin
  begin
    update public.atraction_documents set contract_id=null where id='00000000-0000-4000-8000-00000000fd08';
    raise exception 'FAIL: changed contract';
  exception when raise_exception then if sqlerrm <> 'immutable file' then raise; end if; end;
  begin
    insert into storage.objects(bucket_id,name) values ('atraction-contracts','00000000-0000-4000-8000-00000000fd05/00000000-0000-4000-8000-00000000fd10');
    raise exception 'FAIL: cross-company upload';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000fd03","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from public.atraction_documents where id='00000000-0000-4000-8000-00000000fd08'),'outsider cannot read metadata');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='atraction-contracts' and name like '00000000-0000-4000-8000-00000000fd04/%'),'outsider cannot download');
reset role;
select 'Contract PDF permissions passed; all fixtures rolled back.' as result;
rollback;
