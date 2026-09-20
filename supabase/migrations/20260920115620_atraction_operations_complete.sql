-- Separate validation from append-only audit: conflicting INSERTs must not create phantom events.
create or replace function atraction_private.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.tenant_id<>old.tenant_id or new.id<>old.id or new.created_at<>old.created_at then raise exception 'immutable identity'; end if;
  if new.deleted_at is null and old.deleted_at is not null and old.deleted_at<now()-interval '30 days' then raise exception 'restore expired'; end if;
  new.updated_at:=now();
 end if;
 return new;
end $$;
alter table public.atraction_tenants add column settings jsonb not null default '{}' check(jsonb_typeof(settings)='object' and octet_length(settings::text)<100000);
alter table public.atraction_contacts add column birthday date,add column custom_data jsonb not null default '{}' check(jsonb_typeof(custom_data)='object' and octet_length(custom_data::text)<10000),add column merged_into uuid;
alter table public.atraction_contacts add foreign key(tenant_id,merged_into) references public.atraction_contacts(tenant_id,id);
create index atraction_contact_merged on public.atraction_contacts(tenant_id,merged_into);
alter table public.atraction_deals add column pipeline_id text not null default 'main' check(length(pipeline_id)<=100);
alter table public.atraction_finance add column payments jsonb not null default '[]',add column dre_group text not null default 'expense' check(dre_group in ('revenue','cost','expense','tax'));
update public.atraction_finance set payments=jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'date',settled_date,'amount_cents',amount_cents,'account_id',null)) where settled_date is not null;
update public.atraction_finance set dre_group=case when direction='income' then 'revenue' when category in ('Materiais','Custos operacionais') then 'cost' when category='Impostos' then 'tax' else 'expense' end;
create table public.atraction_accounts(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,name text not null check(length(trim(name)) between 1 and 160),kind text not null check(kind in ('cash','bank')),initial_cents bigint not null default 0 check(abs(initial_cents)<=999999999999),initial_date date not null,unique(tenant_id,id));
create index atraction_accounts_owner on public.atraction_accounts(owner_id);
alter table public.atraction_accounts enable row level security;
revoke all on public.atraction_accounts from anon,authenticated;
grant select,insert,update on public.atraction_accounts to authenticated;
create trigger atraction_audit_accounts before insert or update on public.atraction_accounts for each row execute function atraction_private.audit_record();
create policy read_accounts on public.atraction_accounts for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy insert_accounts on public.atraction_accounts for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy update_accounts on public.atraction_accounts for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create trigger atraction_event_accounts after insert or update on public.atraction_accounts for each row execute function atraction_private.record_financial_event();
create table public.atraction_transfers(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,from_account uuid not null,to_account uuid not null,amount_cents bigint not null check(amount_cents between 1 and 999999999999),date date not null check(date<=current_date),notes text not null default '',check(from_account<>to_account),foreign key(tenant_id,from_account) references public.atraction_accounts(tenant_id,id),foreign key(tenant_id,to_account) references public.atraction_accounts(tenant_id,id),unique(tenant_id,id));
create index atraction_transfers_owner on public.atraction_transfers(owner_id);
alter table public.atraction_transfers enable row level security;
revoke all on public.atraction_transfers from anon,authenticated;
grant select,insert,update on public.atraction_transfers to authenticated;
create trigger atraction_audit_transfers before insert or update on public.atraction_transfers for each row execute function atraction_private.audit_record();
create policy read_transfers on public.atraction_transfers for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy insert_transfers on public.atraction_transfers for insert to authenticated with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create policy update_transfers on public.atraction_transfers for update to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager')) with check((select atraction_private.role_for(tenant_id)) in ('owner','manager'));
create trigger atraction_event_transfers after insert or update on public.atraction_transfers for each row execute function atraction_private.record_financial_event();
create table public.atraction_segments(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,name text not null check(length(trim(name)) between 1 and 120),rule text not null check(rule in ('all','source','tag','lifecycle','overdue','renewals')),value text not null default '' check(length(value)<=200),unique(tenant_id,id));
create index atraction_segments_owner on public.atraction_segments(owner_id);
alter table public.atraction_segments enable row level security;
revoke all on public.atraction_segments from anon,authenticated;
grant select,insert,update on public.atraction_segments to authenticated;
create trigger atraction_audit_segments before insert or update on public.atraction_segments for each row execute function atraction_private.audit_record();
create policy read_segments on public.atraction_segments for select to authenticated using((select atraction_private.role_for(tenant_id)) is not null);
create policy insert_segments on public.atraction_segments for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));
create policy update_segments on public.atraction_segments for update to authenticated using(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid())))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and owner_id=(select auth.uid()))));
create trigger atraction_event_segments after insert or update on public.atraction_segments for each row execute function atraction_private.record_financial_event();
create table public.atraction_chat_sessions(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,contact_id uuid not null,visitor_name text not null,closed boolean not null default false,foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id),unique(tenant_id,id));
create index atraction_chat_sessions_owner on public.atraction_chat_sessions(owner_id);
alter table public.atraction_chat_sessions enable row level security;
revoke all on public.atraction_chat_sessions from anon,authenticated;
grant select,insert,update on public.atraction_chat_sessions to authenticated;
create trigger atraction_audit_chat_sessions before insert or update on public.atraction_chat_sessions for each row execute function atraction_private.audit_record();
create policy read_chat_sessions on public.atraction_chat_sessions for select to authenticated using(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and exists(select 1 from public.atraction_contacts ct where ct.id=atraction_chat_sessions.contact_id and ct.tenant_id=atraction_chat_sessions.tenant_id and ct.owner_id=(select auth.uid())))));
create policy update_chat_sessions on public.atraction_chat_sessions for update to authenticated using(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and exists(select 1 from public.atraction_contacts ct where ct.id=atraction_chat_sessions.contact_id and ct.tenant_id=atraction_chat_sessions.tenant_id and ct.owner_id=(select auth.uid()))))) with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and exists(select 1 from public.atraction_contacts ct where ct.id=atraction_chat_sessions.contact_id and ct.tenant_id=atraction_chat_sessions.tenant_id and ct.owner_id=(select auth.uid())))));
create table public.atraction_chat_messages(id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),owner_id uuid references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deleted_at timestamptz,is_example boolean not null default false,session_id uuid not null,body text not null check(length(trim(body)) between 1 and 2000),direction text not null check(direction in ('in','out')),client_id uuid not null,foreign key(tenant_id,session_id) references public.atraction_chat_sessions(tenant_id,id),unique(session_id,client_id),unique(tenant_id,id));
create index atraction_chat_messages_owner on public.atraction_chat_messages(owner_id);
alter table public.atraction_chat_messages enable row level security;
revoke all on public.atraction_chat_messages from anon,authenticated;
grant select,insert,update on public.atraction_chat_messages to authenticated;
create trigger atraction_audit_chat_messages before insert or update on public.atraction_chat_messages for each row execute function atraction_private.audit_record();
create policy read_chat_messages on public.atraction_chat_messages for select to authenticated using(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and exists(select 1 from public.atraction_chat_sessions cs join public.atraction_contacts ct on ct.id=cs.contact_id where cs.id=atraction_chat_messages.session_id and ct.owner_id=(select auth.uid())))));
create policy insert_chat_messages on public.atraction_chat_messages for insert to authenticated with check(((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='agent' and exists(select 1 from public.atraction_chat_sessions cs join public.atraction_contacts ct on ct.id=cs.contact_id where cs.id=atraction_chat_messages.session_id and ct.owner_id=(select auth.uid())))) and direction='out');
create index atraction_transfers_from on public.atraction_transfers(tenant_id,from_account);
create index atraction_transfers_to on public.atraction_transfers(tenant_id,to_account);
create index atraction_chat_session_contact on public.atraction_chat_sessions(tenant_id,contact_id);
create index atraction_chat_message_session on public.atraction_chat_messages(tenant_id,session_id);
create index atraction_chat_rate on public.atraction_chat_messages(tenant_id,created_at);
create index atraction_chat_starts on public.atraction_chat_sessions(tenant_id,created_at);
create table atraction_private.chat_tokens(session_id uuid primary key references public.atraction_chat_sessions(id),secret_hash text not null,expires_at timestamptz not null);
alter table atraction_private.chat_tokens enable row level security;
revoke all on atraction_private.chat_tokens from public,anon,authenticated;
drop policy event_read on public.atraction_events;
create policy event_read on public.atraction_events for select to authenticated using((select atraction_private.role_for(tenant_id)) in ('owner','manager') or ((select atraction_private.role_for(tenant_id))='viewer' and entity not in ('finance','suppliers','contracts','documents','accounts','transfers')));
create function atraction_private.validate_payments() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb;total bigint:=0;last_date date;seen uuid[]:='{}';begin
 if TG_OP='UPDATE' and current_user='authenticated' and new.payments is distinct from old.payments then raise exception 'use payment operation';end if;
 if jsonb_typeof(new.payments)<>'array' or jsonb_array_length(new.payments)>200 then raise exception 'invalid payments';end if;
 for p in select value from jsonb_array_elements(new.payments) loop
 if (p->>'amount_cents') is null or (p->>'amount_cents')!~'^[0-9]+$' or (p->>'amount_cents')::bigint<1 or (p->>'date') is null or (p->>'date')::date>current_date or (p->>'id') is null or (p->>'id')::uuid=any(seen) then raise exception 'invalid payment';end if;
 seen:=array_append(seen,(p->>'id')::uuid);total:=total+(p->>'amount_cents')::bigint;last_date:=greatest(last_date,(p->>'date')::date);
 if p->>'account_id' is not null and not exists(select 1 from public.atraction_accounts where id=(p->>'account_id')::uuid and tenant_id=new.tenant_id) then raise exception 'invalid account';end if;
 end loop;
 if total>new.amount_cents then raise exception 'payment exceeds amount';end if;
 new.settled_date:=case when total=new.amount_cents then last_date else null end;
 if new.direction='income' then new.dre_group:='revenue';elsif new.dre_group='revenue' then raise exception 'invalid expense group';end if;
 return new;
end $$;
revoke all on function atraction_private.validate_payments() from public,anon,authenticated;
create trigger atraction_validate_payments before insert or update on public.atraction_finance for each row execute function atraction_private.validate_payments();
create function atraction_private.record_payment(entry uuid,amount bigint,paid_on date,account uuid,request_id uuid,reverse_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare f public.atraction_finance;begin
 select * into f from public.atraction_finance where id=entry for update;
 if auth.uid() is null or coalesce(atraction_private.role_for(f.tenant_id),'') not in ('owner','manager') or f.deleted_at is not null then raise exception 'not allowed';end if;
 if reverse_id='00000000-0000-0000-0000-000000000000' then update public.atraction_finance set payments='[]' where id=f.id;
 elsif reverse_id is not null then
 update public.atraction_finance set payments=coalesce((select jsonb_agg(x) from jsonb_array_elements(f.payments) x where x->>'id'<>reverse_id::text),'[]') where id=f.id;
 else
 if request_id is null then raise exception 'request id required';end if;
 if exists(select 1 from jsonb_array_elements(f.payments) x where x->>'id'=request_id::text) then return;end if;
 if account is not null and not exists(select 1 from public.atraction_accounts where tenant_id=f.tenant_id and id=account and deleted_at is null) then raise exception 'invalid account';end if;
 update public.atraction_finance set payments=f.payments||jsonb_build_array(jsonb_build_object('id',request_id,'date',paid_on,'amount_cents',amount,'account_id',account)) where id=f.id;
 end if;
end $$;
revoke all on function atraction_private.record_payment(uuid,bigint,date,uuid,uuid,uuid) from public,anon;
grant execute on function atraction_private.record_payment(uuid,bigint,date,uuid,uuid,uuid) to authenticated;
create function public.atraction_record_payment(entry uuid,amount bigint,paid_on date,account uuid,request_id uuid,reverse_id uuid default null) returns void language sql security invoker set search_path='' as $$select atraction_private.record_payment(entry,amount,paid_on,account,request_id,reverse_id)$$;
revoke all on function public.atraction_record_payment(uuid,bigint,date,uuid,uuid,uuid) from public,anon;
grant execute on function public.atraction_record_payment(uuid,bigint,date,uuid,uuid,uuid) to authenticated;
create function atraction_private.member_role(tenant uuid,member uuid,new_role text) returns void language plpgsql security definer set search_path='' as $$
declare old_role text;boss uuid;begin
 if auth.uid() is null or coalesce(atraction_private.role_for(tenant),'')<>'owner' or new_role not in ('manager','agent','viewer','remove') then raise exception 'not allowed';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text,10));
 select role into old_role from public.atraction_members where tenant_id=tenant and user_id=member for update;
 if old_role is null or old_role='owner' or member=auth.uid() then raise exception 'owner protected';end if;
 select owner_id into boss from public.atraction_tenants where id=tenant;
 if new_role in ('viewer','remove') then update public.atraction_contacts set owner_id=boss where tenant_id=tenant and owner_id=member;update public.atraction_activities set owner_id=boss where tenant_id=tenant and owner_id=member;end if;
 if new_role='remove' then delete from public.atraction_members where tenant_id=tenant and user_id=member;else update public.atraction_members set role=new_role where tenant_id=tenant and user_id=member;end if;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(tenant,'members',member,auth.uid(),'role_changed',jsonb_build_object('before',old_role,'after',new_role));
end $$;
revoke all on function atraction_private.member_role(uuid,uuid,text) from public,anon;
grant execute on function atraction_private.member_role(uuid,uuid,text) to authenticated;
create function public.atraction_member_role(tenant uuid,member uuid,new_role text) returns void language sql security invoker set search_path='' as $$select atraction_private.member_role(tenant,member,new_role)$$;
revoke all on function public.atraction_member_role(uuid,uuid,text) from public,anon;
grant execute on function public.atraction_member_role(uuid,uuid,text) to authenticated;
-- Chat tokens authorize a fresh session, never a contact's prior history.
create function atraction_private.chat_start(slug text,person_name text,person_phone text,accepted boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.atraction_tenants;c uuid;sid uuid:=gen_random_uuid();secret text:=gen_random_uuid()::text||gen_random_uuid()::text;begin
 select * into t from public.atraction_tenants where capture_slug=slug and capture_enabled;
 if t.id is null or accepted is distinct from true or person_name is null or length(trim(person_name)) not between 1 and 160 or person_phone is null or person_phone!~'^\+[1-9][0-9]{9,14}$' then raise exception 'invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(t.id::text,11));
 if (select count(*) from public.atraction_chat_sessions where tenant_id=t.id and created_at>now()-interval '1 hour')>=30 then raise exception 'try later';end if;
 insert into public.atraction_contacts(tenant_id,owner_id,name,phone,source,consent,consent_proof) values(t.id,t.owner_id,trim(person_name),person_phone,'Chat do site',true,'Consentimento para atendimento pelo chat em '||now()::text) on conflict(tenant_id,phone) do nothing;
 select coalesce(merged_into,id) into c from public.atraction_contacts where tenant_id=t.id and phone=person_phone;
 while exists(select 1 from public.atraction_contacts where id=c and merged_into is not null) loop select merged_into into c from public.atraction_contacts where id=c;end loop;
 insert into public.atraction_chat_sessions(id,tenant_id,owner_id,contact_id,visitor_name) values(sid,t.id,t.owner_id,c,trim(person_name));
 insert into atraction_private.chat_tokens values(sid,encode(extensions.digest(secret,'sha256'),'hex'),now()+interval '7 days');
 return jsonb_build_object('id',sid,'token',secret);
end $$;
create function atraction_private.chat_poll(session uuid,token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from atraction_private.chat_tokens where session_id=session and secret_hash=encode(extensions.digest(token,'sha256'),'hex') and expires_at>now()) then raise exception 'invalid session';end if;
 return jsonb_build_object('closed',(select closed from public.atraction_chat_sessions where id=session),'messages',coalesce((select jsonb_agg(m order by m.created_at,m.id) from (select id,body,direction,created_at from public.atraction_chat_messages where session_id=session order by created_at desc,id desc limit 200) m),'[]'::jsonb));
end $$;
create function atraction_private.chat_send(session uuid,token text,body text,request_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cs public.atraction_chat_sessions;begin
 if not exists(select 1 from atraction_private.chat_tokens where session_id=session and secret_hash=encode(extensions.digest(token,'sha256'),'hex') and expires_at>now()) then raise exception 'invalid session';end if;
 select * into cs from public.atraction_chat_sessions where id=session;
 if cs.closed or body is null or length(trim(body)) not between 1 and 2000 or request_id is null then raise exception 'invalid message';end if;
 perform pg_advisory_xact_lock(hashtextextended(cs.tenant_id::text,12));
 if exists(select 1 from public.atraction_chat_messages where session_id=session and client_id=request_id) then return;end if;
 if (select count(*) from public.atraction_chat_messages where session_id=session and direction='in' and created_at>now()-interval '1 minute')>=5 or (select count(*) from public.atraction_chat_messages where session_id=session)>=200 or (select count(*) from public.atraction_chat_messages where tenant_id=cs.tenant_id and created_at>now()-interval '1 hour')>=500 then raise exception 'try later';end if;
 insert into public.atraction_chat_messages(tenant_id,owner_id,session_id,body,direction,client_id) values(cs.tenant_id,cs.owner_id,session,trim(body),'in',request_id);
end $$;
revoke all on function atraction_private.chat_start(text,text,text,boolean),atraction_private.chat_poll(uuid,text),atraction_private.chat_send(uuid,text,text,uuid) from public;
grant execute on function atraction_private.chat_start(text,text,text,boolean),atraction_private.chat_poll(uuid,text),atraction_private.chat_send(uuid,text,text,uuid) to anon,authenticated;
create function public.atraction_chat_start(slug text,person_name text,person_phone text,accepted boolean) returns jsonb language sql security invoker set search_path='' as $$select atraction_private.chat_start(slug,person_name,person_phone,accepted)$$;
create function public.atraction_chat_poll(session uuid,token text) returns jsonb language sql security invoker set search_path='' as $$select atraction_private.chat_poll(session,token)$$;
create function public.atraction_chat_send(session uuid,token text,body text,request_id uuid) returns void language sql security invoker set search_path='' as $$select atraction_private.chat_send(session,token,body,request_id)$$;
revoke all on function public.atraction_chat_start(text,text,text,boolean),public.atraction_chat_poll(uuid,text),public.atraction_chat_send(uuid,text,text,uuid) from public;
grant execute on function public.atraction_chat_start(text,text,text,boolean),public.atraction_chat_poll(uuid,text),public.atraction_chat_send(uuid,text,text,uuid) to anon,authenticated;
create function atraction_private.merge_contacts(source_id uuid,target_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare src public.atraction_contacts;dst public.atraction_contacts;begin
 if source_id=target_id then raise exception 'same contact';end if;
 select * into dst from public.atraction_contacts where id=target_id;
 if auth.uid() is null or coalesce(atraction_private.role_for(dst.tenant_id),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 perform pg_advisory_xact_lock(hashtextextended(dst.tenant_id::text,13));
 select * into dst from public.atraction_contacts where id=target_id for update;
 select * into src from public.atraction_contacts where id=source_id and tenant_id=dst.tenant_id for update;
 if src.id is null or src.deleted_at is not null or dst.deleted_at is not null then raise exception 'invalid contacts';end if;
 perform set_config('atraction.merge','on',true);
 update public.atraction_activities a set done=true,title=title||' (mesclada)' where a.contact_id=src.id and not a.done and a.deleted_at is null and a.purpose is not null and exists(select 1 from public.atraction_activities b where b.contact_id=dst.id and b.tenant_id=dst.tenant_id and b.purpose=a.purpose and not b.done and b.deleted_at is null);
 update public.atraction_contracts set contact_id=dst.id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_finance set contact_id=dst.id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_deals set contact_id=dst.id,owner_id=dst.owner_id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_activities set contact_id=dst.id,owner_id=dst.owner_id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_messages set contact_id=dst.id,owner_id=dst.owner_id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_documents set contact_id=dst.id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_chat_sessions set contact_id=dst.id where tenant_id=dst.tenant_id and contact_id=src.id;
 update public.atraction_contacts set tags=array(select distinct unnest(dst.tags||src.tags)),notes=dst.notes||E'\n\nCadastro mesclado: '||src.name||' / '||src.phone||E'\n'||src.notes,custom_data=src.custom_data||dst.custom_data where id=dst.id;
 update public.atraction_contacts set deleted_at=now(),merged_into=dst.id where id=src.id;
 insert into public.atraction_events(tenant_id,entity,entity_id,actor_id,kind,payload) values(dst.tenant_id,'contacts',dst.id,auth.uid(),'merged',jsonb_build_object('source_id',src.id,'source_name',src.name,'source_phone',src.phone));
 perform set_config('atraction.merge','off',true);
end $$;
revoke all on function atraction_private.merge_contacts(uuid,uuid) from public,anon;
grant execute on function atraction_private.merge_contacts(uuid,uuid) to authenticated;
create function public.atraction_merge_contacts(source_id uuid,target_id uuid) returns void language sql security invoker set search_path='' as $$select atraction_private.merge_contacts(source_id,target_id)$$;
revoke all on function public.atraction_merge_contacts(uuid,uuid) from public,anon;
grant execute on function public.atraction_merge_contacts(uuid,uuid) to authenticated;
create function atraction_private.protect_merged_contact() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if old.merged_into is not null and (new.deleted_at is null or new.merged_into is distinct from old.merged_into) then raise exception 'merged contact cannot be restored';end if;return new;
end $$;
revoke all on function atraction_private.protect_merged_contact() from public,anon,authenticated;
create trigger atraction_protect_merge before update on public.atraction_contacts for each row execute function atraction_private.protect_merged_contact();
create function atraction_private.chat_integrity() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_TABLE_NAME='atraction_chat_sessions' then
 if TG_OP='UPDATE' and new.contact_id<>old.contact_id and coalesce(current_setting('atraction.merge',true),'')<>'on' then raise exception 'immutable chat';end if;
 end if;
 if TG_TABLE_NAME='atraction_chat_messages' and TG_OP='INSERT' then
 if not exists(select 1 from public.atraction_chat_sessions where id=new.session_id and tenant_id=new.tenant_id and not closed) then raise exception 'chat closed';end if;
 end if;return new;
end $$;
revoke all on function atraction_private.chat_integrity() from public,anon,authenticated;
create trigger atraction_chat_integrity before insert on public.atraction_chat_messages for each row execute function atraction_private.chat_integrity();
create trigger atraction_chat_identity before update on public.atraction_chat_sessions for each row execute function atraction_private.chat_integrity();

create or replace function atraction_private.document_quota() returns trigger language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text,8));
 if TG_OP='UPDATE' and (new.size<>old.size or new.path<>old.path or (new.contact_id<>old.contact_id and coalesce(current_setting('atraction.merge',true),'')<>'on') or new.mime_type<>old.mime_type) then raise exception 'immutable file';end if;
 if TG_OP='INSERT' and ((select count(*) from public.atraction_documents where tenant_id=new.tenant_id)>=20 or (select coalesce(sum(size),0) from public.atraction_documents where tenant_id=new.tenant_id)+new.size>104857600) then raise exception 'document quota exceeded';end if;return new;
end $$;

create or replace function atraction_private.contract_action(contract uuid,action text,amount bigint,effective date) returns void language plpgsql security definer set search_path='' as $$
declare c public.atraction_contracts;
begin
 select * into c from public.atraction_contracts where id=contract for update;
 if auth.uid() is null or coalesce(atraction_private.role_for(c.tenant_id),'') not in ('owner','manager') then raise exception 'not allowed';end if;
 if c.status<>'active' or effective is null or effective<current_date then raise exception 'invalid date or contract';end if;
 if action='adjust' then
 if c.mode<>'monthly' or amount is null or amount not between 1 and 999999999999 or not exists(select 1 from public.atraction_finance where contract_id=c.id and deleted_at is null and settled_date is null and jsonb_array_length(payments)=0 and due_date>=effective) then raise exception 'invalid adjustment';end if;
 update public.atraction_finance set amount_cents=amount where contract_id=c.id and tenant_id=c.tenant_id and settled_date is null and jsonb_array_length(payments)=0 and deleted_at is null and due_date>=effective;
 update public.atraction_contracts set amount_cents=amount where id=c.id;
 elsif action='cancel' then
 if effective<>current_date then raise exception 'cancel is immediate';end if;
 update public.atraction_finance set deleted_at=now() where contract_id=c.id and tenant_id=c.tenant_id and settled_date is null and jsonb_array_length(payments)=0 and deleted_at is null and due_date>=effective;
 update public.atraction_contracts set status='cancelled' where id=c.id;
 else raise exception 'invalid action';end if;
end $$;

create or replace function atraction_private.remove_member(t uuid,u uuid) returns void language sql security definer set search_path='' as $$select atraction_private.member_role(t,u,'remove')$$;
