import { describe, it, expect } from "vitest";
import { demo } from "../../src/lib/demo";
import { accountBalance, dre, paid, remaining } from "../../src/lib/payments";
import { segmentContacts, upcomingBirthdays } from "../../src/lib/segments";
import { makePdf } from "../../src/lib/files";
import { today } from "../../src/lib/finance";
import { PDFDocument } from "pdf-lib";
import type { FinanceEntry, Account } from "../../src/lib/types";
describe("operations", () => {
  it("counts partial payments by payment date and transfers only in balances", () => {
    const s = demo();
    const base = s.contacts[0];
    const a: Account = {
      ...base,
      id: "bank",
      name: "Bank",
      kind: "bank",
      initial_cents: 10000,
      initial_date: "2026-01-01",
    };
    s.accounts = [a];
    const f: FinanceEntry = {
      ...base,
      id: "invoice",
      contact_id: base.id,
      supplier_id: null,
      title: "Sale",
      direction: "income",
      amount_cents: 10000,
      due_date: "2026-02-01",
      settled_date: null,
      category: "Services",
      notes: "",
      payments: [
        { id: "p", amount_cents: 3000, date: "2026-01-10", account_id: a.id },
        { id: "q", amount_cents: 2000, date: "2026-02-10", account_id: a.id },
      ],
    };
    s.finance = [f];
    s.transfers = [
      {
        ...base,
        id: "transfer",
        from_account: a.id,
        to_account: "cash",
        amount_cents: 1000,
        date: "2026-01-15",
        notes: "",
      },
    ];
    expect(paid(f)).toBe(5000);
    expect(remaining(f)).toBe(5000);
    expect(accountBalance(s, a, "2026-01-31")).toBe(12000);
    expect(dre(s, "2026-01-01", "2026-01-31").net).toBe(3000);
    s.finance.push({
      ...f,
      id: "cost",
      direction: "expense",
      dre_group: "cost",
      payments: [
        { id: "r", amount_cents: 1000, date: "2026-01-12", account_id: a.id },
      ],
    });
    expect(dre(s, "2026-01-01", "2026-01-31").gross).toBe(2000);
  });
  it("segments and birthdays exclude archived contacts", () => {
    const s = demo();
    s.contacts = s.contacts.slice(0, 2).map((c, i) => ({
      ...c,
      source: "Campaign",
      birthday: "1990" + today().slice(4),
      deleted_at: i ? new Date().toISOString() : null,
    }));
    expect(
      segmentContacts(s, { rule: "source", value: "campaign" }),
    ).toHaveLength(1);
    expect(upcomingBirthdays(s)).toHaveLength(1);
  });
  it("creates multipage PDFs with accents", async () => {
    const blob = await makePdf(
      "Proposta comercial",
      "Condições de prestação de serviço. ".repeat(700),
    );
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(2);
  });
});
