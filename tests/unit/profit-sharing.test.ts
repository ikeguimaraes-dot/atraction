import { expect, it } from "vitest";
import {
  monthlyProfit,
  accumulatedProfit,
  distributableProfit,
  splitProfit,
} from "../../src/lib/profit-sharing";
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

it("carries prior losses forward and excludes future months and deleted entries", () => {
  const rows = [
    { ...entry, due_date: "2026-09-01", amount_cents: 10000 },
    { ...entry, direction: "income" as const, amount_cents: 7000 },
    {
      ...entry,
      direction: "income" as const,
      due_date: "2026-11-01",
      amount_cents: 5000,
    },
    { ...entry, amount_cents: 90000, deleted_at: "2026-10-01" },
  ];
  expect(accumulatedProfit(rows, [], "2026-10")).toEqual({
    revenue: 7000,
    expense: 10000,
    profit: -3000,
  });
  expect(accumulatedProfit(rows, [], "2026-11").profit).toBe(2000);
  expect(accumulatedProfit(rows, [], "2026-08").profit).toBe(0);
  expect(monthlyProfit(rows, [], "2026-10").profit).toBe(7000);
  expect(() => accumulatedProfit(rows, [], "invalid")).toThrow();
});
it("uses invoice issue dates and installment due dates in accumulated profit", () => {
  const purchase = {
    ...entry,
    purchase_id: "purchase",
    purchase_date: "2026-09-01",
    due_date: "2026-11-01",
    purchase_installments: 1,
  };
  expect(accumulatedProfit([purchase], [], "2026-10").expense).toBe(3000);
  expect(
    accumulatedProfit(
      [{ ...purchase, purchase_installments: 3 }],
      [],
      "2026-10",
    ).expense,
  ).toBe(0);
});

it("does not distribute uncollected revenue and reserves old losses and unpaid expenses", () => {
  const income = {
    ...entry,
    direction: "income" as const,
    amount_cents: 15000,
    payments: [],
  };
  const expense = { ...entry, amount_cents: 2000 };
  const priorLoss = { ...entry, due_date: "2026-09-01", amount_cents: 10000 };
  const rows = [income, expense, priorLoss];
  expect(distributableProfit(rows, [], "2026-10")).toMatchObject({
    profit: 3000,
    received: 0,
    receivable: 15000,
    deficit: 12000,
    available: 0,
  });
  const partiallyReceived = {
    ...income,
    payments: [
      { id: "p", date: "2026-10-20", account_id: null, amount_cents: 13000 },
    ],
  };
  expect(
    distributableProfit([partiallyReceived, expense, priorLoss], [], "2026-10"),
  ).toMatchObject({
    received: 13000,
    expense: 12000,
    receivable: 2000,
    available: 1000,
    deficit: 0,
  });
});
it("uses accumulated collected profit even in a loss month and excludes future receipts and advances", () => {
  const income = {
    ...entry,
    direction: "income" as const,
    amount_cents: 10000,
    due_date: "2026-09-01",
    payments: [
      { id: "p", date: "2026-09-01", amount_cents: 10000, account_id: null },
    ],
  };
  const expense = { ...entry, amount_cents: 2000 };
  expect(monthlyProfit([income, expense], [], "2026-10").profit).toBe(-2000);
  expect(distributableProfit([income, expense], [], "2026-10").available).toBe(
    8000,
  );
  expect(
    distributableProfit(
      [
        {
          ...income,
          payments: [{ ...income.payments[0], date: "2026-11-01" }],
        },
        expense,
      ],
      [],
      "2026-10",
    ).available,
  ).toBe(0);
  expect(
    distributableProfit(
      [{ ...income, due_date: "2026-11-01" }, expense],
      [],
      "2026-10",
    ).available,
  ).toBe(0);
});
