import { addMonths } from "./journey";
export function installmentPlan(
  total: number,
  count: number,
  firstDue: string,
) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 999999999999)
    throw new Error("Informe um valor total válido.");
  if (!Number.isInteger(count) || count < 1 || count > 60 || total < count)
    throw new Error(
      "Informe de 1 a 60 parcelas, com pelo menos R$ 0,01 em cada uma.",
    );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(firstDue) ||
    !Number.isFinite(Date.parse(firstDue)) ||
    new Date(firstDue).toISOString().slice(0, 10) !== firstDue
  )
    throw new Error("Informe um vencimento válido.");
  return Array.from({ length: count }, (_, i) => ({
    amount_cents: Math.floor(total / count) + (i < total % count ? 1 : 0),
    due_date: addMonths(firstDue, i),
  }));
}
