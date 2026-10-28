import { alive } from "./domain";
import { financeReferenceDate } from "./finance";
import { installmentPlan } from "./installments";
import type { CustomerDocument, FinanceEntry } from "./types";

export const paymentMethods = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  bank_slip: "Boleto",
  transfer: "Transferência",
} as const;

export function purchaseInstallments(
  entry: FinanceEntry,
  count: number,
  nextId: () => string,
): FinanceEntry[] {
  if (!entry.payment_method || !(entry.payment_method in paymentMethods))
    throw new Error("Escolha a forma de pagamento.");
  if (
    !["credit_card", "bank_slip"].includes(entry.payment_method) &&
    count !== 1
  )
    throw new Error("Essa forma de pagamento deve ser à vista.");
  return installmentPlan(entry.amount_cents, count, entry.due_date).map(
    (part, i) => ({
      ...entry,
      ...part,
      id: i === 0 ? entry.id : nextId(),
      purchase_id: entry.id,
      purchase_installment: i + 1,
      purchase_installments: count,
      title:
        count > 1
          ? `${entry.title.slice(0, 188)} · ${i + 1}/${count}`
          : entry.title,
    }),
  );
}

export function expensePurchases(
  finance: FinanceEntry[],
  documents: CustomerDocument[],
) {
  const groups = new Map<string, FinanceEntry[]>();
  for (const row of alive(finance).filter(
    (row) => row.direction === "expense",
  )) {
    const key = row.purchase_id || row.id;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.entries()]
    .map(([id, rows]) => {
      rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
      const first = rows[0];
      const linkedIds = new Set(
        finance
          .filter((row) => (row.purchase_id || row.id) === id)
          .map((row) => row.id),
      );
      const linkedDocuments = documents.filter(
        (doc) => doc.finance_id && linkedIds.has(doc.finance_id),
      );
      const date =
        first.purchase_date ||
        linkedDocuments.find((doc) => doc.issue_date)?.issue_date ||
        financeReferenceDate(first, documents);
      return {
        id,
        rows,
        date,
        month: date.slice(0, 7),
        title: first.purchase_id
          ? first.title.replace(/ · \d+\/\d+$/, "")
          : first.title,
        total: rows.reduce((sum, row) => sum + row.amount_cents, 0),
        documents: alive(linkedDocuments),
        paymentMethod: first.payment_method
          ? paymentMethods[first.payment_method]
          : "Não informada",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
