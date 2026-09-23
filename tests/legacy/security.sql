-- Entire verification is rolled back, including temporary Auth users and profile triggers.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000a01','atraction-a@example.invalid'),('00000000-0000-4000-8000-000000000b01','atraction-b@example.invalid'),('00000000-0000-4000-8000-000000000c01','atraction-viewer@example.invalid');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id,capture_enabled,capture_slug) values('00000000-0000-4000-8000-000000000a02','A test','00000000-0000-4000-8000-000000000a01',true,'atraction-security-test-a');
insert into public.atraction_automations(id,tenant_id,owner_id,name,trigger,enabled) values('00000000-0000-4000-8000-000000000a05','00000000-0000-4000-8000-000000000a02','00000000-0000-4000-8000-000000000a01','Return test','contact_created',true);
insert into public.atraction_contacts(id,tenant_id,owner_id,name,phone) values('00000000-0000-4000-8000-000000000a03','00000000-0000-4000-8000-000000000a02','00000000-0000-4000-8000-000000000a01','Contact A','+5511999999901');
select pg_temp.assert_true((select count(*)=1 from public.atraction_contacts),'owner can read own contact');
select pg_temp.assert_true(public.atraction_run_tasks('00000000-0000-4000-8000-000000000a02')=1,'robot processes one job');
select pg_temp.assert_true(public.atraction_run_tasks('00000000-0000-4000-8000-000000000a02')=0,'robot is idempotent');
insert into public.atraction_deals(tenant_id,contact_id,title,value,stage) values('00000000-0000-4000-8000-000000000a02','00000000-0000-4000-8000-000000000a03','Won test',100,4);
select pg_temp.assert_true((select count(*)=1 from public.atraction_events where kind='won'),'won event generated');
-- Cross-tenant reads and writes.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b01","role":"authenticated","aal":"aal1"}',true);
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-000000000b02','B test','00000000-0000-4000-8000-000000000b01');
select pg_temp.assert_true((select count(*)=0 from public.atraction_contacts),'B cannot read A');
do $$ begin begin insert into public.atraction_contacts(tenant_id,name,phone) values('00000000-0000-4000-8000-000000000a02','Intrusion','+5511999999902');raise exception 'FAIL: cross tenant insert';exception when insufficient_privilege then null;end;end $$;
do $$ begin begin insert into public.atraction_deals(tenant_id,contact_id,title) values('00000000-0000-4000-8000-000000000b02','00000000-0000-4000-8000-000000000a03','Intrusion');raise exception 'FAIL: cross tenant relationship';exception when foreign_key_violation then null;end;end $$;
-- Password sessions retain access to their own company.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=1 from public.atraction_contacts),'owner password session reads');
-- Viewer can read but cannot write.
reset role;
insert into public.atraction_members(tenant_id,user_id,role) values('00000000-0000-4000-8000-000000000a02','00000000-0000-4000-8000-000000000c01','viewer');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000c01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)=1 from public.atraction_contacts),'viewer reads');
do $$ begin begin insert into public.atraction_contacts(tenant_id,name,phone) values('00000000-0000-4000-8000-000000000a02','Viewer attempt','+5511999999903');raise exception 'FAIL: viewer write';exception when insufficient_privilege then null;end;end $$;
-- Public capture returns only public metadata and accepts consented contacts.
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.assert_true((select count(*)=0 from public.atraction_contacts),'anonymous cannot read contacts');
select pg_temp.assert_true(public.atraction_capture_info('atraction-security-test-a')->>'name'='A test','public page limited metadata');
select pg_temp.assert_true(public.atraction_capture('atraction-security-test-a','Public opt in','+5511999999904',true),'public opt-in accepted');
select pg_temp.assert_true(public.atraction_capture('atraction-security-test-a','Public opt in','+5511999999904',true),'duplicate capture does not leak contact');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.atraction_contacts where phone='+5511999999904'),'capture deduplicated');
-- Additional assertions to insert before final ROLLBACK.
select pg_temp.assert_true((select count(*)=2 from public.atraction_events where tenant_id='00000000-0000-4000-8000-000000000a02' and entity='contacts' and kind='INSERT'),'duplicate capture does not create phantom audit');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000a01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true(jsonb_array_length(public.atraction_export_contacts('00000000-0000-4000-8000-000000000a02'))=2,'owner export works');
select pg_temp.assert_true((select count(*)=1 from public.atraction_events where kind='EXPORT'),'export audited');
-- The entire import must roll back on one duplicate.
do $$begin begin
 perform public.atraction_import_contacts('00000000-0000-4000-8000-000000000a02','[{"id":"00000000-0000-4000-8000-000000000a11","name":"Good import","phone":"+5511999999920"},{"id":"00000000-0000-4000-8000-000000000a12","name":"Duplicate","phone":"+5511999999901"}]');
 raise exception 'FAIL: duplicate import accepted';exception when unique_violation then null;end;end $$;
select pg_temp.assert_true((select count(*)=0 from public.atraction_contacts where phone='+5511999999920'),'atomic import rolled back first row');
-- Revenue adjustment must follow edits and reversals.
update public.atraction_deals set value=150 where tenant_id='00000000-0000-4000-8000-000000000a02';
select pg_temp.assert_true((select sum((payload->>'revenue_delta')::numeric)=150 from public.atraction_events where entity='deals'),'won value adjustment');
update public.atraction_deals set stage=2 where tenant_id='00000000-0000-4000-8000-000000000a02';
select pg_temp.assert_true((select sum((payload->>'revenue_delta')::numeric)=0 from public.atraction_events where entity='deals'),'won reversal');
-- Invite an existing user to another company without replacing the original membership.
insert into public.atraction_invites(tenant_id,email,role,token) values('00000000-0000-4000-8000-000000000a02','atraction-b@example.invalid','agent','00000000-0000-4000-8000-000000000a20');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000b01","role":"authenticated","aal":"aal1"}',true);
select public.atraction_accept_invite('00000000-0000-4000-8000-000000000a20');
select pg_temp.assert_true((select count(*)=2 from public.atraction_members),'invitation preserves previous membership');
-- Viewers cannot call private export through the public wrapper.
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000c01","role":"authenticated","aal":"aal1"}',true);
do $$begin begin perform public.atraction_export_contacts('00000000-0000-4000-8000-000000000a02');raise exception 'FAIL: viewer export';exception when raise_exception then if sqlerrm='FAIL: viewer export' then raise;end if;end;end $$;
reset role;
-- Actual background worker (no user identity) also creates tasks and is idempotent.
select set_config('request.jwt.claims','{}',true);
select pg_temp.assert_true(atraction_private.background_tasks()=1,'background worker handles queued capture');
select pg_temp.assert_true(atraction_private.background_tasks()=0,'background worker duplicate safety');

rollback;
