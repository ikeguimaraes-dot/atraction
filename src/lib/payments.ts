import { effectiveDreGroup, dreLabels } from "./finance-categories";
import type { DreGroup } from "./types";
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
  const result = Object.fromEntries(
    Object.keys(dreLabels).map((k) => [k, 0]),
  ) as Record<DreGroup, number>;
  const categories = new Map<
    string,
    { category: string; group: DreGroup; direction: string; amount: number }
  >();
  let excludedIncome = 0,
    excludedExpense = 0;
  for (const f of s.finance.filter((f) => !f.deleted_at)) {
    const group = effectiveDreGroup(f);
    const amount = payments(f)
      .filter((p) => inPeriod(p.date, from, to))
      .reduce((n, p) => n + p.amount_cents, 0);
    if (!amount) continue;
    if (group === "non_dre") {
      if (f.direction === "income") excludedIncome += amount;
      else excludedExpense += amount;
    } else result[group] += amount;
    const key = `${group}:${f.direction}:${f.category}`;
    const previous = categories.get(key);
    categories.set(key, {
      category: f.category,
      group,
      direction: f.direction,
      amount: (previous?.amount || 0) + amount,
    });
  }
  const netRevenue = result.revenue - result.sales_deduction;
  const gross = netRevenue - result.cost;
  const operating =
    gross -
    result.personnel -
    result.sales -
    result.expense +
    result.other_revenue -
    result.other_expense -
    result.tax;
  const financial = result.financial_revenue - result.financial_expense;
  const beforeTax = operating + financial;
  return {
    ...result,
    netRevenue,
    gross,
    operating,
    financial,
    beforeTax,
    net: beforeTax - result.income_tax,
    excludedIncome,
    excludedExpense,
    categories: [...categories.values()],
  };
}
export function dreLines(result: ReturnType<typeof dre>): [string, number][] {
  return [
    ["Receitas recebidas — operacionais", result.revenue],
    ["− Deduções da receita", -result.sales_deduction],
    ["Receita líquida", result.netRevenue],
    ["− Custos dos produtos e serviços", -result.cost],
    ["Resultado bruto", result.gross],
    ["− Despesas com pessoal", -result.personnel],
    ["− Despesas comerciais e marketing", -result.sales],
    ["− Despesas administrativas", -result.expense],
    ["+ Outras receitas operacionais", result.other_revenue],
    ["− Outras despesas operacionais", -result.other_expense],
    ["− Tributos sem detalhamento (legado)", -result.tax],
    ["Resultado operacional — caixa", result.operating],
    ["+ Receitas financeiras", result.financial_revenue],
    ["− Despesas financeiras", -result.financial_expense],
    ["Resultado financeiro", result.financial],
    ["Resultado antes dos tributos sobre o lucro", result.beforeTax],
    ["− Tributos sobre o lucro", -result.income_tax],
    ["Resultado do período", result.net],
  ];
}
