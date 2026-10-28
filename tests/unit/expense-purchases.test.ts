import { expect, it } from "vitest";
import {
  expensePurchases,
  purchaseInstallments,
} from "../../src/lib/expense-purchases";
import { financeReferenceDate } from "../../src/lib/finance";
import type { CustomerDocument, FinanceEntry } from "../../src/lib/types";

const entry: FinanceEntry = {
  is_example: true,
  id: "purchase",
  tenant_id: "demo",
  owner_id: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  title: "Compra",
  direction: "expense",
  amount_cents: 162911,
  category: "Materiais",
  due_date: "2028-01-31",
  purchase_date: "2027-12-15",
  payment_method: "credit_card",
  settled_date: null,
  payments: [],
  contact_id: null,
  supplier_id: null,
  notes: "",
};
const document: CustomerDocument = {
  is_example: true,
  id: "document",
  tenant_id: "demo",
  owner_id: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  contact_id: null,
  finance_id: entry.id,
  issue_date: "2027-12-15",
  document_kind: "nfe",
  name: "nota.pdf",
  path: "demo/document",
  size: 100,
  mime_type: "application/pdf",
};
function parts() {
  let index = 0;
  return purchaseInstallments(entry, 10, () => `part-${++index}`);
}
it("creates exactly ten monthly charges without losing cents and groups the purchase by issue month", () => {
  const rows = parts();
  expect(rows).toHaveLength(10);
  expect(new Set(rows.map((row) => row.id)).size).toBe(10);
  expect(rows.reduce((sum, row) => sum + row.amount_cents, 0)).toBe(162911);
  expect(rows[0].amount_cents).toBe(16292);
  expect(rows[1].amount_cents).toBe(16291);
  expect(rows[1].due_date).toBe("2028-02-29");
  expect(rows[2].due_date).toBe("2028-03-31");
  expect(rows[9].due_date).toBe("2028-10-31");
  expect(
    rows.every(
      (row) =>
        row.payment_method === "credit_card" && row.settled_date === null,
    ),
  ).toBe(true);
  const purchases = expensePurchases(rows, [document]);
  expect(purchases).toHaveLength(1);
  expect(purchases[0]).toMatchObject({
    month: "2027-12",
    total: 162911,
    title: "Compra",
    documents: [document],
  });
  expect(financeReferenceDate(rows[0], [document])).toBe("2028-01-31");
  expect(financeReferenceDate(rows[1], [document])).toBe("2028-02-29");
});
it("includes expenses without receipts and keeps receipts available when the first installment is archived", () => {
  const rows = parts();
  rows[0].deleted_at = "2028-01-01";
  const purchases = expensePurchases(
    [...rows, { ...entry, id: "manual", purchase_date: null }],
    [document],
  );
  expect(purchases).toHaveLength(2);
  expect(purchases.find((row) => row.id === "purchase")?.documents).toEqual([
    document,
  ]);
  expect(purchases.find((row) => row.id === "manual")?.month).toBe("2028-01");
  expect(
    expensePurchases(rows, [{ ...document, deleted_at: "2028-01-01" }])[0]
      .documents,
  ).toEqual([]);
});
it("keeps single payments in the purchase month and refuses installments for Pix", () => {
  const [single] = purchaseInstallments(
    { ...entry, payment_method: "pix" },
    1,
    () => "unused",
  );
  expect(single.amount_cents).toBe(162911);
  expect(financeReferenceDate(single, [document])).toBe("2027-12-15");
  expect(() =>
    purchaseInstallments(
      { ...entry, payment_method: "pix" },
      10,
      () => "unused",
    ),
  ).toThrow();
});
