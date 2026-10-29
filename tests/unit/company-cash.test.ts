import { expect, it } from "vitest";
import { companyCash } from "../../src/lib/company-cash";
import type { State } from "../../src/lib/types";
const date = "2026-10-20";
const payment = (
  amount: number,
  payer: string | null | undefined,
  account_id: string | null = null,
) => ({ date, amount_cents: amount, payer_user_id: payer, account_id });
const fixture = (data: object) =>
  ({
    accounts: [],
    finance: [],
    settlements: [],
    transfers: [],
    ...data,
  }) as unknown as State;
it("counts company cash and reimbursements without deducting team payments twice", () => {
  const s = fixture({
    finance: [
      { direction: "income", payments: [payment(10000, undefined)] },
      {
        direction: "expense",
        payments: [
          payment(2000, null),
          payment(3000, "member"),
          payment(500, undefined),
        ],
      },
      {
        direction: "expense",
        deleted_at: date,
        payments: [payment(90000, null)],
      },
    ],
    settlements: [
      {
        date,
        from_user_id: null,
        to_user_id: "member",
        amount_cents: 1000,
        from_account_id: null,
        to_account_id: null,
      },
    ],
  });
  expect(companyCash(s, date)).toEqual({
    opening: 0,
    incoming: 10000,
    outgoing: 3000,
    reimbursements: 1000,
    unidentified: 500,
    balance: 7000,
  });
});
it("respects opening snapshots, excludes personal balances and future movements, and retains archived accounts", () => {
  const s = fixture({
    accounts: [
      {
        id: "bank",
        initial_date: "2026-10-01",
        initial_cents: 5000,
        holder_user_id: null,
        deleted_at: date,
      },
      {
        id: "personal",
        initial_date: "2026-10-01",
        initial_cents: 90000,
        holder_user_id: "member",
      },
    ],
    finance: [
      {
        direction: "income",
        payments: [
          payment(2000, undefined, "bank"),
          payment(9000, undefined, "personal"),
          { ...payment(8000, undefined, "bank"), date: "2026-09-01" },
          { ...payment(7000, undefined), date: "2026-11-01" },
        ],
      },
    ],
  });
  expect(companyCash(s, date).balance).toBe(7000);
  expect(companyCash(s, date).incoming).toBe(2000);
});
it("cancels internal transfers and includes transfers across company and personal accounts", () => {
  const s = fixture({
    accounts: [
      { id: "a", initial_date: "2026-01-01", initial_cents: 5000 },
      { id: "b", initial_date: "2026-01-01", initial_cents: 0 },
      {
        id: "p",
        initial_date: "2026-01-01",
        initial_cents: 90000,
        holder_user_id: "member",
      },
    ],
    transfers: [
      { date, from_account: "a", to_account: "b", amount_cents: 2000 },
      { date, from_account: "a", to_account: "p", amount_cents: 1000 },
      { date, from_account: "p", to_account: "b", amount_cents: 300 },
    ],
  });
  expect(companyCash(s, date)).toMatchObject({
    incoming: 300,
    outgoing: 1000,
    balance: 4300,
  });
});
it("does not double count transfers already included in a newer opening snapshot", () => {
  const s = fixture({
    accounts: [
      { id: "a", initial_date: "2026-01-01", initial_cents: 5000 },
      { id: "b", initial_date: "2026-10-01", initial_cents: 2000 },
    ],
    transfers: [
      {
        date: "2026-09-01",
        from_account: "a",
        to_account: "b",
        amount_cents: 2000,
      },
    ],
  });
  expect(companyCash(s, date).balance).toBe(5000);
});
it("includes repayments to company but ignores team-to-team and deleted settlements", () => {
  const s = fixture({
    settlements: [
      { date, from_user_id: "member", to_user_id: null, amount_cents: 300 },
      { date, from_user_id: "a", to_user_id: "b", amount_cents: 900 },
      {
        date,
        from_user_id: null,
        to_user_id: "b",
        amount_cents: 1000,
        deleted_at: date,
      },
    ],
  });
  expect(companyCash(s, date).balance).toBe(300);
});
