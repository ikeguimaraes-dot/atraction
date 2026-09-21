import { expect, it } from "vitest";
import { installmentPlan } from "../../src/lib/installments";
it("divides the total exactly and anchors monthly dates across leap years", () => {
  const rows = installmentPlan(10000, 12, "2028-01-31");
  expect(rows).toHaveLength(12);
  expect(rows.reduce((s, r) => s + r.amount_cents, 0)).toBe(10000);
  expect(rows.slice(0, 3).map((r) => r.due_date)).toEqual([
    "2028-01-31",
    "2028-02-29",
    "2028-03-31",
  ]);
  expect(rows.filter((r) => r.amount_cents === 834)).toHaveLength(4);
  expect(
    installmentPlan(120000, 12, "2026-09-21").every(
      (r) => r.amount_cents === 10000,
    ),
  ).toBe(true);
});
it("rejects invalid counts, sub-cent installments and invalid dates", () => {
  for (const count of [0, -1, 1.5, 61, NaN])
    expect(() => installmentPlan(10000, count, "2026-01-01")).toThrow();
  expect(() => installmentPlan(2, 3, "2026-01-01")).toThrow();
  expect(() => installmentPlan(100, 3, "2026-02-30")).toThrow();
});
