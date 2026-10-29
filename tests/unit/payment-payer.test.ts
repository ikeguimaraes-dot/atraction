import { expect, it } from "vitest";
import { withPaymentPayer } from "../../src/lib/payment-payer";
import { sharedBalances } from "../../src/lib/shared-expenses";
import type { Payment, State } from "../../src/lib/types";
const payment: Payment = {
  id: "p",
  date: "2026-10-28",
  amount_cents: 55000,
  account_id: "account",
};
it("corrects legacy attribution while preserving cash data and credits the payer", () => {
  const updated = withPaymentPayer(payment, "member");
  expect(updated).toEqual({
    ...payment,
    payer_user_id: "member",
    allocations: [{ user_id: null, amount_cents: 55000 }],
  });
  const s = {
    finance: [{ direction: "expense", deleted_at: null, payments: [updated] }],
    settlements: [],
  } as unknown as State;
  expect(Object.fromEntries(sharedBalances(s))).toEqual({
    member: 55000,
    company: -55000,
  });
});
it("keeps existing allocations and supports correcting back to company", () => {
  const split = {
    ...payment,
    payer_user_id: "member",
    allocations: [
      { user_id: "member", amount_cents: 20000 },
      { user_id: null, amount_cents: 35000 },
    ],
  };
  expect(withPaymentPayer(split, null)).toEqual({
    ...split,
    payer_user_id: null,
  });
  expect(split.payer_user_id).toBe("member");
});

it("corrects the expense owner independently and recalculates reimbursement", async () => {
  const { withPaymentResponsibility } =
    await import("../../src/lib/payment-payer");
  const balances = (p: Payment) =>
    Object.fromEntries(
      sharedBalances({
        finance: [{ direction: "expense", deleted_at: null, payments: [p] }],
        settlements: [],
      } as unknown as State),
    );
  expect(balances(withPaymentResponsibility(payment, "amanda", null))).toEqual({
    amanda: 55000,
    company: -55000,
  });
  expect(
    balances(withPaymentResponsibility(payment, "amanda", "amanda")),
  ).toEqual({ amanda: 0 });
  expect(balances(withPaymentResponsibility(payment, null, "amanda"))).toEqual({
    company: 55000,
    amanda: -55000,
  });
  const changed = withPaymentResponsibility(
    { ...payment, allocations: [{ user_id: null, amount_cents: 55000 }] },
    "amanda",
    "other",
  );
  expect(changed).toEqual({
    ...payment,
    payer_user_id: "amanda",
    allocations: [{ user_id: "other", amount_cents: 55000 }],
  });
});
