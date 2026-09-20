-- A merge pointer is created only by the atomic merge operation.
create or replace function atraction_private.protect_merged_contact() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if TG_OP='INSERT' then
  if new.merged_into is not null then raise exception 'use merge operation';end if;
 else
  if current_user='authenticated' and new.merged_into is distinct from old.merged_into then raise exception 'use merge operation';end if;
  if old.merged_into is not null and (new.deleted_at is null or new.merged_into is distinct from old.merged_into) then raise exception 'merged contact cannot be restored';end if;
 end if;return new;
end $$;
drop trigger atraction_protect_merge on public.atraction_contacts;
create trigger atraction_protect_merge before insert or update on public.atraction_contacts for each row execute function atraction_private.protect_merged_contact();
