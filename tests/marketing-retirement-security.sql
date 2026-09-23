begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
select pg_temp.assert_true(not exists(select 1 from cron.job where jobname='atraction-task-worker' and active),'marketing worker retired');
select pg_temp.assert_true(exists(select 1 from cron.job where jobname='atraction-finance-recurrences' and active),'financial recurrence worker remains active');
select pg_temp.assert_true(not exists(select 1 from pg_trigger where tgname='atraction_queue_contact'),'no new automation jobs on customer creation');
do $$declare f record;begin
 for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('atraction_capture','atraction_capture_info','atraction_capture_attributed','atraction_chat_start','atraction_chat_poll','atraction_chat_send','atraction_run_tasks') loop
 perform pg_temp.assert_true(not has_function_privilege('anon',f.oid,'execute') and not has_function_privilege('authenticated',f.oid,'execute'), f.proname||' disabled');
 end loop;
end $$;
select pg_temp.assert_true(not has_table_privilege('authenticated','public.atraction_automations','insert,update'),'cannot reactivate robots');
insert into auth.users(id,email) values('00000000-0000-4000-8000-00000000f101','retirement-test@example.invalid');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000f101","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-00000000f102','Gestão teste','00000000-0000-4000-8000-00000000f101');
insert into public.atraction_contacts(tenant_id,name,phone,lifecycle) values('00000000-0000-4000-8000-00000000f102','Cliente manual','+5511998765432','customer');
select pg_temp.assert_true((select count(*)=1 from public.atraction_contacts),'manual customers remain available');
select 'marketing retired; customer management and financial scheduler preserved' as result;
rollback;
