alter table public.atraction_tenants add column onboarding jsonb not null default '{}';
alter table public.atraction_tenants add column pack_version integer not null default 1;
-- Explicitly snapshot niche data for existing accounts when the library changes.
alter table public.atraction_tenants add column niche_pack jsonb not null default '{}';
create function atraction_private.assign_children() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.owner_id is distinct from old.owner_id then
  if new.owner_id is not null and not exists(select 1 from public.atraction_members where tenant_id=new.tenant_id and user_id=new.owner_id and role<>'viewer') then raise exception 'invalid assignee';end if;
  update public.atraction_deals set owner_id=new.owner_id where tenant_id=new.tenant_id and contact_id=new.id and deleted_at is null;
  update public.atraction_activities set owner_id=new.owner_id where tenant_id=new.tenant_id and contact_id=new.id and deleted_at is null;
  update public.atraction_messages set owner_id=new.owner_id where tenant_id=new.tenant_id and contact_id=new.id and deleted_at is null;
 end if;return new;
end $$;
revoke all on function atraction_private.assign_children() from public,anon,authenticated;
create trigger atraction_assignment after update of owner_id on public.atraction_contacts for each row execute function atraction_private.assign_children();
-- JSON body avoids URL size limits when undoing a large import.
create function public.atraction_undo_import(p_tenant uuid,ids uuid[]) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 if cardinality(ids)>10000 then raise exception 'too many rows';end if;
 update public.atraction_contacts set deleted_at=now() where tenant_id=p_tenant and id=any(ids) and deleted_at is null;
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.atraction_undo_import(uuid,uuid[]) from public,anon;
grant execute on function public.atraction_undo_import(uuid,uuid[]) to authenticated;
-- Serialize public submissions per account; capture cannot undo a previous opt-out.
create or replace function public.atraction_capture(slug text, person_name text, person_phone text, accepted boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare t uuid;begin
 select id into t from public.atraction_tenants where capture_slug=slug and capture_enabled;
 if t is null or accepted is distinct from true or length(trim(person_name)) not between 1 and 160 or person_phone !~ '^\+[1-9][0-9]{9,14}$' then raise exception 'invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(t::text,1));
 if (select count(*) from public.atraction_contacts where tenant_id=t and source='Página' and created_at>now()-interval '1 hour')>=30 then raise exception 'try later';end if;
 insert into public.atraction_contacts(tenant_id,name,phone,source,consent,consent_proof) values(t,trim(person_name),person_phone,'Página',true,'Formulário público: consentimento expresso em '||now()::text) on conflict(tenant_id,phone) do nothing;
 return true;
end $$;
-- Defense against an agent attaching a record to another attendant's contact.
create function atraction_private.check_contact_access() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null and atraction_private.role_for(new.tenant_id)='agent' and new.contact_id is not null and not exists(select 1 from public.atraction_contacts where tenant_id=new.tenant_id and id=new.contact_id and owner_id=auth.uid()) then raise exception 'invalid contact';end if;
 return new;
end $$;
revoke all on function atraction_private.check_contact_access() from public,anon,authenticated;
create trigger atraction_check_deal_contact before insert or update on public.atraction_deals for each row execute function atraction_private.check_contact_access();
create trigger atraction_check_activity_contact before insert or update on public.atraction_activities for each row execute function atraction_private.check_contact_access();
create trigger atraction_check_message_contact before insert or update on public.atraction_messages for each row execute function atraction_private.check_contact_access();
