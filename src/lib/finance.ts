import { payments, remaining, inPeriod, paid } from "./payments";
import type { CustomerDocument, FinanceEntry } from "./types";
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function cents(input: string): number {
  const raw = input.trim();
  const value = /^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw)
    ? raw.replaceAll(".", "").replace(",", ".")
    : raw.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Informe um valor positivo com até duas casas decimais.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999999999999)
    throw new Error("Valor fora do limite permitido.");
  return amount;
}
export function financeReferenceDate(
  entry: FinanceEntry,
  documents: CustomerDocument[],
): string {
  if (entry.direction === "expense" && entry.purchase_id) {
    return (entry.purchase_installments || 1) > 1
      ? entry.due_date
      : entry.purchase_date || entry.due_date;
  }
  // Archiving a receipt must not move its expense to another month.
  const document =
    entry.direction === "expense"
      ? documents.find(
          (item) => item.finance_id === entry.id && item.issue_date,
        )
      : undefined;
  return document?.issue_date || entry.due_date;
}
export function balance(rows: FinanceEntry[], from = "", to = "") {
  const sums = { received: 0, paid: 0, receivable: 0, payable: 0 };
  for (const row of rows) {
    if (row.deleted_at) continue;
    for (const p of payments(row))
      if (inPeriod(p.date, from, to))
        sums[row.direction === "income" ? "received" : "paid"] +=
          p.amount_cents;
    if (inPeriod(row.due_date, from, to))
      sums[row.direction === "income" ? "receivable" : "payable"] +=
        remaining(row);
  }
  return { ...sums, net: sums.received - sums.paid };
}
export const entryStatus = (entry: FinanceEntry) =>
  remaining(entry) === 0
    ? entry.direction === "income"
      ? "Recebido"
      : "Pago"
    : paid(entry) > 0
      ? "Parcial"
      : entry.due_date < today()
        ? "Atrasado"
        : "Em aberto";
