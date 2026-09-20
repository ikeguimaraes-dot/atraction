import { describe, it, expect } from "vitest";
import {
  addMonths,
  addDays,
  schedule,
  sourceResults,
  pendingRetention,
} from "../../src/lib/journey";
import { base, demo } from "../../src/lib/demo";
import type { Contract } from "../../src/lib/types";
const contract = (patch: Partial<Contract> = {}): Contract => ({
  ...base(),
  contact_id: "c",
  deal_id: null,
  renews_id: null,
  title: "Plano",
  plan: "Mensal",
  mode: "installments",
  amount_cents: 10000,
  periods: 3,
  start_date: "2026-01-31",
  first_due_date: "2026-01-31",
  end_date: "2026-04-29",
  status: "active",
  notes: "",
  ...patch,
});
describe("connected customer journey", () => {
  it("preserves cents when dividing installments and anchors dates at month end", () => {
    const rows = schedule(contract());
    expect(rows.map((r) => r.amount_cents)).toEqual([3334, 3333, 3333]);
    expect(rows.map((r) => r.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(rows.every((r) => r.settled_date === null)).toBe(true);
  });
  it("handles leap years and recurring monthly prices", () => {
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(
      schedule(contract({ mode: "monthly" })).map((r) => r.amount_cents),
    ).toEqual([10000, 10000, 10000]);
  });
  it("attributes received cash separately from acquisition cohort", () => {
    const s = demo();
    const c = s.contacts[0];
    s.contacts = [
      {
        ...c,
        source: "Instagram",
        campaign: "Primavera",
        created_at: "2026-01-01",
        lifecycle: "customer",
      },
    ];
    s.deals = [];
    s.finance = schedule(
      contract({ contact_id: c.id, mode: "once", periods: 1 }),
    ).map((f) => ({ ...f, settled_date: "2026-09-20" }));
    expect(sourceResults(s, "2026-09-01", "2026-09-30")).toEqual([
      {
        source: "Instagram",
        campaign: "Primavera",
        leads: 0,
        customers: 0,
        received: 10000,
      },
    ]);
    s.finance[0].settled_date = null;
    expect(sourceResults(s, "2026-09-01", "2026-09-30")).toEqual([]);
  });
  it("does not count a future planned task as customer contact", () => {
    const s = demo();
    const c = s.contacts[0];
    s.contacts = [
      {
        ...c,
        lifecycle: "customer",
        created_at: "2020-01-01",
        retention_days: 30,
      },
    ];
    s.messages = [];
    s.activities = [
      {
        ...base(),
        contact_id: c.id,
        title: "Retorno",
        kind: "task",
        done: false,
        due_at: "2099-01-01",
        updated_at: new Date().toISOString(),
      },
    ];
    expect(pendingRetention(s)).toHaveLength(1);
    s.activities[0].done = true;
    expect(pendingRetention(s)).toHaveLength(0);
  });
});
