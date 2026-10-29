import { expect, it } from "vitest";
import { monthlyProfit, splitProfit } from "../../src/lib/profit-sharing";
import type { FinanceEntry } from "../../src/lib/types";
const entry = {
  id: "expense",
  direction: "expense",
  amount_cents: 3000,
  due_date: "2026-10-20",
  deleted_at: null,
  settled_date: null,
  payments: [],
} as unknown as FinanceEntry;
it("uses registered monthly income and expense even without payments, excluding archived and other months", () => {
  const rows = [
    entry,
    {
      ...entry,
      id: "income",
      direction: "income" as const,
      amount_cents: 10001,
    },
    { ...entry, id: "archived", deleted_at: "2026-10-25", amount_cents: 90000 },
    { ...entry, id: "next", due_date: "2026-11-01", amount_cents: 60000 },
  ];
  expect(monthlyProfit(rows, [], "2026-10")).toEqual({
    revenue: 10001,
    expense: 3000,
    profit: 7001,
  });
});
it("matches Finance issue-month and installment-month rules", () => {
  const single = {
    ...entry,
    id: "single",
    purchase_id: "single",
    purchase_installments: 1,
    purchase_date: "2026-09-15",
    amount_cents: 1000,
  };
  const installment = {
    ...entry,
    id: "part",
    purchase_id: "purchase",
    purchase_installments: 10,
    purchase_date: "2026-09-15",
    amount_cents: 2000,
  };
  expect(monthlyProfit([single, installment], [], "2026-10").expense).toBe(
    2000,
  );
  expect(monthlyProfit([single, installment], [], "2026-09").expense).toBe(
    1000,
  );
});
it("divides exactly and deterministically, including remaining cents", () => {
  const shares = splitProfit(10001, ["b", "a", "c", "a"]);
  expect(shares).toEqual([
    { user_id: "a", amount_cents: 3334 },
    { user_id: "b", amount_cents: 3334 },
    { user_id: "c", amount_cents: 3333 },
  ]);
  expect(shares.reduce((sum, s) => sum + s.amount_cents, 0)).toBe(10001);
  expect(splitProfit(2, ["a", "b", "c"]).map((s) => s.amount_cents)).toEqual([
    1, 1, 0,
  ]);
});
it("does not allocate a loss or distribute without participants", () => {
  expect(splitProfit(-100, ["a", "b"]).map((s) => s.amount_cents)).toEqual([
    0, 0,
  ]);
  expect(splitProfit(100, [])).toEqual([]);
  expect(() => monthlyProfit([], [], "invalid")).toThrow();
});
