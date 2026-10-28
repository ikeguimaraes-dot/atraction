-- Purchase metadata stays on the existing tenant-protected expense rows.
alter table public.atraction_finance
  add column purchase_id uuid,
  add column purchase_date date,
  add column payment_method text check (payment_method in ('credit_card', 'debit_card', 'pix', 'cash', 'bank_slip', 'transfer')),
  add column purchase_installment integer,
  add column purchase_installments integer,
  add constraint atraction_purchase_metadata check (
    (purchase_id is null and purchase_date is null and payment_method is null
      and purchase_installment is null and purchase_installments is null)
    or
    (purchase_id is not null and purchase_date is not null and payment_method is not null
      and purchase_installment is not null and purchase_installments is not null
      and direction = 'expense' and contract_id is null
      and purchase_installments between 1 and 60
      and purchase_installment between 1 and purchase_installments
      and (payment_method in ('credit_card', 'bank_slip') or purchase_installments = 1))
  );
create unique index atraction_purchase_installment
  on public.atraction_finance(tenant_id, purchase_id, purchase_installment)
  where purchase_id is not null;
