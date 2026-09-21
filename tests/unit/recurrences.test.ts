import { expect, it } from "vitest";
import { replenishRecurrences } from "../../src/lib/recurrences";
import { demo } from "../../src/lib/demo";
import type { Recurrence } from "../../src/lib/types";
const r: Recurrence = {
  id: "subscription",
  tenant_id: "demo",
  owner_id: null,
  title: "Assinatura",
  direction: "expense",
  amount_cents: 9900,
  category: "Serviços",
  first_due_date: "2028-01-31",
  end_date: null,
  active: true,
  next_index: 0,
  contact_id: null,
  supplier_id: null,
  notes: "",
  created_at: "",
  updated_at: "",
};
it("repeats the full monthly amount, replenishes the horizon and never duplicates", () => {
  const initial = replenishRecurrences(
    { ...demo(), finance: [], recurrences: [r] },
    "2028-01-31",
  );
  expect(initial.finance).toHaveLength(12);
  expect(
    initial.finance.every((f) => f.amount_cents === 9900 && !f.settled_date),
  ).toBe(true);
  expect(initial.finance.map((f) => f.due_date)).toContain("2028-02-29");
  expect(replenishRecurrences(initial, "2028-01-31").finance).toHaveLength(12);
  expect(replenishRecurrences(initial, "2028-03-31").finance).toHaveLength(14);
});
it("honors end dates and cancellation without regenerating deleted occurrences", () => {
  const initial = replenishRecurrences(
    { ...demo(), finance: [], recurrences: [{ ...r, end_date: "2028-03-31" }] },
    "2028-01-31",
  );
  expect(initial.finance).toHaveLength(3);
  initial.finance[0].deleted_at = "2028-01-01";
  expect(replenishRecurrences(initial, "2029-01-31").finance).toHaveLength(3);
  expect(
    replenishRecurrences(
      { ...initial, recurrences: [{ ...r, active: false }] },
      "2029-01-31",
    ).finance,
  ).toHaveLength(3);
});
