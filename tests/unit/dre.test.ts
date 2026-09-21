import { expect, it } from "vitest";
import { demo, base } from "../../src/lib/demo";
import { dre, accountBalance } from "../../src/lib/payments";
import {
  financeCategories,
  categoryGroup,
} from "../../src/lib/finance-categories";
import type { FinanceEntry, DreGroup } from "../../src/lib/types";
it("classifies the catalog and rejects mismatched directions", () => {
  const names = financeCategories.flatMap((g) => g.categories);
  expect(new Set(names).size).toBe(names.length);
  for (const group of financeCategories)
    for (const name of group.categories) {
      expect(categoryGroup(group.direction, name)).toBe(group.key);
      expect(
        categoryGroup(
          group.direction === "income" ? "expense" : "income",
          name,
        ),
      ).toBeUndefined();
    }
});
it("calculates DRE subtotals and keeps principal out of earnings but in cash", () => {
  const s = demo();
  const add = (
    direction: "income" | "expense",
    group: DreGroup,
    amount: number,
  ): FinanceEntry => ({
    ...base(),
    title: group,
    category: group,
    direction,
    dre_group: group,
    amount_cents: amount * 2,
    due_date: "2026-02-01",
    settled_date: null,
    contact_id: null,
    supplier_id: null,
    notes: "",
    payments: [
      {
        id: group,
        date: "2026-01-10",
        amount_cents: amount,
        account_id: "bank",
      },
    ],
  });
  s.finance = [
    add("income", "revenue", 100000),
    add("expense", "sales_deduction", 10000),
    add("expense", "cost", 30000),
    add("expense", "personnel", 10000),
    add("expense", "sales", 5000),
    add("expense", "expense", 5000),
    add("income", "other_revenue", 2000),
    add("expense", "other_expense", 1000),
    add("income", "financial_revenue", 3000),
    add("expense", "financial_expense", 4000),
    add("expense", "income_tax", 6000),
    add("income", "non_dre", 200000),
    add("expense", "non_dre", 50000),
  ];
  s.transfers = [];
  const r = dre(s, "2026-01-01", "2026-01-31");
  expect(r.netRevenue).toBe(90000);
  expect(r.gross).toBe(60000);
  expect(r.operating).toBe(41000);
  expect(r.financial).toBe(-1000);
  expect(r.beforeTax).toBe(40000);
  expect(r.net).toBe(34000);
  expect(r.excludedIncome).toBe(200000);
  expect(r.excludedExpense).toBe(50000);
  expect(
    accountBalance(
      s,
      {
        ...base(),
        id: "bank",
        name: "Banco",
        kind: "bank",
        initial_cents: 0,
        initial_date: "2026-01-01",
      },
      "2026-01-31",
    ),
  ).toBe(184000);
  expect(dre(s, "2026-03-01", "2026-03-31").net).toBe(0);
  s.finance[0].deleted_at = "2026-01-01";
  expect(dre(s, "2026-01-01", "2026-01-31").net).toBe(-66000);
});
