import { describe, expect, it } from "vitest";
import { cents, balance, financeReferenceDate } from "../../src/lib/finance";
import type { CustomerDocument, FinanceEntry } from "../../src/lib/types";
const row = (patch: Partial<FinanceEntry> = {}): FinanceEntry => ({
  id: "1",
  tenant_id: "demo",
  owner_id: null,
  is_example: true,
  created_at: "",
  updated_at: "",
  deleted_at: null,
  title: "Conta",
  direction: "income",
  amount_cents: 1001,
  category: "Serviços",
  due_date: "2026-09-01",
  settled_date: null,
  contact_id: null,
  supplier_id: null,
  notes: "",
  ...patch,
});
describe("operational cash ledger", () => {
  it("converts decimals exactly and refuses ambiguous or invalid amounts", () => {
    expect(cents("10,01")).toBe(1001);
    expect(cents("0.29")).toBe(29);
    expect(cents("1.629,11")).toBe(162911);
    expect(cents("1629,11")).toBe(162911);
    expect(cents("1.000,00")).toBe(100000);
    expect(cents("1.234.567,89")).toBe(123456789);
    for (const value of [
      "0",
      "-1",
      "1.999",
      "1e3",
      "NaN",
      "1.62,911",
      "1,629.11",
      "999999999999",
    ])
      expect(() => cents(value)).toThrow();
  });
  it("uses invoice issue date for expenses even after archiving the receipt", () => {
    const expense = row({ direction: "expense", due_date: "2026-10-28" });
    const document: CustomerDocument = {
      ...expense,
      id: "receipt",
      finance_id: expense.id,
      issue_date: "2026-09-15",
      document_kind: "nfe",
      name: "nota.pdf",
      path: "demo/receipt",
      mime_type: "application/pdf",
      size: 100,
    };
    expect(financeReferenceDate(expense, [document])).toBe("2026-09-15");
    expect(
      financeReferenceDate(expense, [
        { ...document, deleted_at: "2026-10-29" },
      ]),
    ).toBe("2026-09-15");
    expect(financeReferenceDate(expense, [])).toBe("2026-10-28");
    expect(
      financeReferenceDate(expense, [{ ...document, issue_date: null }]),
    ).toBe("2026-10-28");
    expect(financeReferenceDate(row(), [document])).toBe("2026-09-01");
  });
  it("separates open accounts from settled cash and excludes deleted entries", () => {
    expect(
      balance([
        row(),
        row({ direction: "expense", amount_cents: 500 }),
        row({ settled_date: "2026-09-10" }),
        row({
          direction: "expense",
          settled_date: "2026-09-10",
          amount_cents: 200,
        }),
        row({ deleted_at: "2026-09-10" }),
      ]),
    ).toEqual({
      receivable: 1001,
      payable: 500,
      received: 1001,
      paid: 200,
      net: 801,
    });
  });
  it("uses settlement date for cash and due date for forecasts", () => {
    expect(
      balance(
        [row(), row({ settled_date: "2026-10-01" })],
        "2026-09-01",
        "2026-09-30",
      ),
    ).toEqual({ receivable: 1001, payable: 0, received: 0, paid: 0, net: 0 });
  });
});
