import type { CustomerDocument, FinanceEntry } from "./types";
import { financeReferenceDate } from "./finance";

export function monthlyProfit(
  finance: FinanceEntry[],
  documents: CustomerDocument[],
  month: string,
) {
  let revenue = 0,
    expense = 0;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Escolha um mês válido.");
  for (const entry of finance) {
    if (
      entry.deleted_at ||
      financeReferenceDate(entry, documents).slice(0, 7) !== month
    )
      continue;
    if (entry.direction === "income") revenue += entry.amount_cents;
    else expense += entry.amount_cents;
  }
  return { revenue, expense, profit: revenue - expense };
}

export function splitProfit(profit: number, participants: string[]) {
  if (!Number.isSafeInteger(profit))
    throw new Error("Valor de lucro inválido.");
  const ids = [...new Set(participants)].sort();
  if (!ids.length) return [];
  const available = Math.max(0, profit);
  const base = Math.floor(available / ids.length);
  const extra = available % ids.length;
  return ids.map((user_id, index) => ({
    user_id,
    amount_cents: base + (index < extra ? 1 : 0),
  }));
}
