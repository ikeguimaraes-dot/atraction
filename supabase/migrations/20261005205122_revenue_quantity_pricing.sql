alter table public.atraction_finance
  add column quantity numeric(14,3),
  add column unit_amount_cents bigint,
  add check(
    (quantity is null and unit_amount_cents is null) or
    (direction='income' and quantity>0 and quantity<=99999999999 and unit_amount_cents between 1 and 999999999999 and amount_cents=round(quantity*unit_amount_cents))
  );
