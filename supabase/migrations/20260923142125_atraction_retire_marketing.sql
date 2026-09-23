-- Retire acquisition and marketing without deleting customer or financial history.
drop trigger if exists atraction_queue_contact on public.atraction_contacts;
select cron.unschedule(jobid) from cron.job where jobname='atraction-task-worker';
-- Disable public entry points and direct private calls, including old published links.
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname in ('atraction_capture','atraction_capture_info','atraction_capture_attributed','atraction_chat_start','atraction_chat_poll','atraction_chat_send','atraction_run_tasks'))
 or (n.nspname='atraction_private' and p.proname in ('atraction_capture','atraction_capture_info','capture_attributed','chat_start','chat_poll','chat_send','process_tasks','background_tasks'))
 loop execute format('revoke execute on function %s from public, anon, authenticated, service_role',f.signature);end loop;
end $$;
revoke insert,update,delete on public.atraction_deals,public.atraction_messages,public.atraction_automations,public.atraction_segments,public.atraction_chat_sessions,public.atraction_chat_messages from authenticated,anon;
-- Recurring financial entries retain their separate scheduler and permissions.
