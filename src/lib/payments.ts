import type { FinanceEntry, Payment, State, Account } from "./types";
export const payments = (f: FinanceEntry): Payment[] =>
  f.payments ??
  (f.settled_date
    ? [
        {
          id: f.id,
          date: f.settled_date,
          amount_cents: f.amount_cents,
          account_id: null,
        },
      ]
    : []);
export const paid = (f: FinanceEntry) =>
  payments(f).reduce((n, p) => n + p.amount_cents, 0);
export const remaining = (f: FinanceEntry) =>
  Math.max(0, f.amount_cents - paid(f));
export const inPeriod = (date: string, from = "", to = "") =>
  (!from || date >= from) && (!to || date <= to);
export const financeInPeriod = (f: FinanceEntry, from = "", to = "") =>
  payments(f).some((p) => inPeriod(p.date, from, to)) ||
  (remaining(f) > 0 && inPeriod(f.due_date, from, to));
export function accountBalance(s: State, a: Account, until = "9999-12-31") {
  let total = a.initial_date <= until ? a.initial_cents : 0;
  for (const f of s.finance.filter((f) => !f.deleted_at))
    for (const p of payments(f))
      if (p.account_id === a.id && inPeriod(p.date, a.initial_date, until))
        total += (f.direction === "income" ? 1 : -1) * p.amount_cents;
  for (const t of s.transfers.filter(
    (t) => !t.deleted_at && inPeriod(t.date, a.initial_date, until),
  ))
    total +=
      (t.to_account === a.id ? 1 : t.from_account === a.id ? -1 : 0) *
      t.amount_cents;
  return total;
}
export function dre(s: State, from: string, to: string) {
  const result = { revenue: 0, cost: 0, expense: 0, tax: 0 };
  for (const f of s.finance.filter((f) => !f.deleted_at)) {
    const group =
      f.direction === "income"
        ? "revenue"
        : f.dre_group === "cost"
          ? "cost"
          : f.dre_group === "tax"
            ? "tax"
            : "expense";
    result[group] += payments(f)
      .filter((p) => inPeriod(p.date, from, to))
      .reduce((n, p) => n + p.amount_cents, 0);
  }
  return {
    ...result,
    gross: result.revenue - result.cost,
    net: result.revenue - result.cost - result.expense - result.tax,
  };
}
