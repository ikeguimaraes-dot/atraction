import type { FinanceEntry } from "./types";
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function cents(input: string): number {
  const value = input.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("Informe um valor positivo com até duas casas decimais.");
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999999999999)
    throw new Error("Valor fora do limite permitido.");
  return amount;
}
export function balance(rows: FinanceEntry[], from = "", to = "") {
  const sums = { received: 0, paid: 0, receivable: 0, payable: 0 };
  for (const row of rows) {
    if (row.deleted_at) continue;
    const date = row.settled_date || row.due_date;
    if ((from && date < from) || (to && date > to)) continue;
    const key =
      row.direction === "income"
        ? row.settled_date
          ? "received"
          : "receivable"
        : row.settled_date
          ? "paid"
          : "payable";
    sums[key] += row.amount_cents;
  }
  return { ...sums, net: sums.received - sums.paid };
}
export const entryStatus = (entry: FinanceEntry) =>
  entry.settled_date
    ? entry.direction === "income"
      ? "Recebido"
      : "Pago"
    : entry.due_date < today()
      ? "Atrasado"
      : "Em aberto";
