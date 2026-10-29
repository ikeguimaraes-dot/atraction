import type { Payment } from "./types";

export function withPaymentPayer(
  payment: Payment,
  payer: string | null,
): Payment {
  return {
    ...payment,
    payer_user_id: payer,
    allocations: payment.allocations ?? [
      { user_id: null, amount_cents: payment.amount_cents },
    ],
  };
}

export function withPaymentResponsibility(
  payment: Payment,
  payer: string | null,
  expenseOwner: string | null,
): Payment {
  return {
    ...payment,
    payer_user_id: payer,
    allocations: [
      { user_id: expenseOwner, amount_cents: payment.amount_cents },
    ],
  };
}
