-- Keep privileged implementations out of the exposed API schema.
alter function public.atraction_capture_info(text) set schema atraction_private;
alter function public.atraction_capture(text,text,text,boolean) set schema atraction_private;
-- USAGE alone grants no access to other helpers: each helper has explicit EXECUTE grants.
grant usage on schema atraction_private to anon;
create function public.atraction_capture_info(slug text) returns jsonb language sql stable security invoker set search_path='' as $$select atraction_private.atraction_capture_info(slug)$$;
create function public.atraction_capture(slug text,person_name text,person_phone text,accepted boolean) returns boolean language sql security invoker set search_path='' as $$select atraction_private.atraction_capture(slug,person_name,person_phone,accepted)$$;
revoke all on function public.atraction_capture_info(text),public.atraction_capture(text,text,text,boolean) from public;
grant execute on function public.atraction_capture_info(text),public.atraction_capture(text,text,text,boolean) to anon,authenticated;
-- Immutable consent history, readable only under the same contact ownership policies.
create table public.atraction_consents (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.atraction_tenants(id),contact_id uuid not null,
 granted boolean not null,proof text not null,actor_id uuid,created_at timestamptz not null default now(),
 foreign key(tenant_id,contact_id) references public.atraction_contacts(tenant_id,id)
);
create index atraction_consents_contact on public.atraction_consents(tenant_id,contact_id);
alter table public.atraction_consents enable row level security;
revoke all on public.atraction_consents from anon,authenticated;
grant select on public.atraction_consents to authenticated;
create policy consent_read on public.atraction_consents for select to authenticated using(exists(select 1 from public.atraction_contacts c where c.tenant_id=atraction_consents.tenant_id and c.id=atraction_consents.contact_id));
create function atraction_private.record_consent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.consent is distinct from old.consent or new.consent_proof is distinct from old.consent_proof then
 insert into public.atraction_consents(tenant_id,contact_id,granted,proof,actor_id) values(new.tenant_id,new.id,new.consent,new.consent_proof,auth.uid());
 end if;return new;
end $$;
revoke all on function atraction_private.record_consent() from public,anon,authenticated;
create trigger atraction_consent after insert or update of consent,consent_proof on public.atraction_contacts for each row execute function atraction_private.record_consent();
