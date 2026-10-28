import { alive } from "./domain";
import { financeReferenceDate } from "./finance";
import { installmentPlan } from "./installments";
import type { CustomerDocument, FinanceEntry } from "./types";
import { paid, payments } from "./payments";
import { categoryGroup } from "./finance-categories";

export const paymentMethods = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  bank_slip: "Boleto",
  transfer: "Transferência",
} as const;

export type ExpensePurchase = ReturnType<typeof expensePurchases>[number];
export type PurchaseChanges = {
  title: string;
  category: string;
  dre_group: string;
  amount_cents: number;
  count: number;
  first_due: string;
  issue_date: string;
  payment_method: keyof typeof paymentMethods;
  purchase_payer: string;
  supplier_id: string | null;
  notes: string;
  kind: "nfe" | "receipt";
  number: string;
};

export function editPurchaseRows(
  purchase: ExpensePurchase,
  changes: PurchaseChanges,
  base: () => FinanceEntry,
): FinanceEntry[] {
  const rows = [...purchase.rows].sort(
    (a, b) => (a.purchase_installment || 1) - (b.purchase_installment || 1),
  );
  const plan = installmentPlan(
    changes.amount_cents,
    changes.count,
    changes.first_due,
  );
  if (!changes.title.trim() || !changes.category.trim())
    throw new Error("Informe a descrição e a categoria.");
  if (
    changes.count > 1 &&
    !["credit_card", "bank_slip"].includes(changes.payment_method)
  )
    throw new Error("Essa forma de pagamento deve ser à vista.");
  if (
    changes.count !== rows.length &&
    rows.some((row) => paid(row) > 0 || row.recurrence_id)
  )
    throw new Error(
      "Estorne os pagamentos antes de alterar a quantidade de parcelas. Lançamentos recorrentes não podem ser reparcelados.",
    );
  const replan =
    changes.amount_cents !== purchase.total ||
    changes.count !== rows.length ||
    changes.first_due !== purchase.rows[0].due_date;
  return plan.map((part, i) => {
    const previous = rows[i];
    const amount =
      previous && !replan ? previous.amount_cents : part.amount_cents;
    if (previous && amount < paid(previous))
      throw new Error(
        "O valor da parcela não pode ser menor que o valor já pago.",
      );
    return {
      ...(previous || base()),
      title:
        changes.count > 1
          ? `${changes.title.slice(0, 188)} · ${i + 1}/${changes.count}`
          : changes.title,
      direction: "expense",
      amount_cents: amount,
      due_date: previous && !replan ? previous.due_date : part.due_date,
      category: changes.category,
      dre_group: categoryGroup("expense", changes.category) || "expense",
      supplier_id: changes.supplier_id,
      notes: changes.notes,
      purchase_id: purchase.id,
      purchase_date: changes.issue_date,
      payment_method: changes.payment_method,
      purchase_payer: changes.purchase_payer,
      purchase_installment: i + 1,
      purchase_installments: changes.count,
      payments: previous ? payments(previous) : [],
      settled_date:
        previous && amount === paid(previous)
          ? payments(previous)
              .map((p) => p.date)
              .sort()
              .at(-1) || null
          : null,
    };
  });
}

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
