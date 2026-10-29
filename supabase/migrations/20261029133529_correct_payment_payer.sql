-- Correct attribution without reversing a payment or changing cash movement.
create function atraction_private.correct_payment_payer(entry_id uuid, payment_id uuid, expected jsonb, payer uuid)
returns void language plpgsql security definer set search_path='' as $$
declare f public.atraction_finance; current_payment jsonb; corrected jsonb;
begin
 select * into f from public.atraction_finance where id=entry_id for update;
 if auth.uid() is null or coalesce(atraction_private.role_for(f.tenant_id),'') <> 'owner'
   or f.deleted_at is not null or f.direction <> 'expense' then
   raise exception 'Somente donos podem corrigir o pagador de uma baixa.' using errcode='42501';
 end if;
 select p into current_payment from jsonb_array_elements(f.payments) p where p->>'id'=payment_id::text;
 if current_payment is null or current_payment is distinct from expected then
   raise exception 'Esta baixa foi alterada. Feche e abra novamente antes de corrigir.';
 end if;
 if payer is not null and not exists(select 1 from public.atraction_members where tenant_id=f.tenant_id and user_id=payer) then
   raise exception 'Escolha um pagador que faça parte desta empresa.';
 end if;
 corrected := current_payment || jsonb_build_object('payer_user_id',payer);
 -- Legacy payments without attribution belong to the company by default.
 if not (corrected ? 'allocations') then
   corrected := corrected || jsonb_build_object('allocations',jsonb_build_array(jsonb_build_object('user_id',null,'amount_cents',current_payment->'amount_cents')));
 end if;
 update public.atraction_finance set payments=(select jsonb_agg(case when p->>'id'=payment_id::text then corrected else p end order by ord)
   from jsonb_array_elements(f.payments) with ordinality x(p,ord)) where id=f.id;
end $$;
revoke all on function atraction_private.correct_payment_payer(uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function atraction_private.correct_payment_payer(uuid,uuid,jsonb,uuid) to authenticated;
create function public.atraction_correct_payment_payer(entry_id uuid, payment_id uuid, expected jsonb, payer uuid)
returns void language sql security invoker set search_path='' as $$
 select atraction_private.correct_payment_payer(entry_id,payment_id,expected,payer)
$$;
revoke all on function public.atraction_correct_payment_payer(uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.atraction_correct_payment_payer(uuid,uuid,jsonb,uuid) to authenticated;
