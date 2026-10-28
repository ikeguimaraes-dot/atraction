import { expect, it } from "vitest";
import { managerCanWrite } from "../../src/lib/permissions";
import type { FinanceEntry } from "../../src/lib/types";
const entry = {
  id: "expense",
  title: "Apple Developer",
  amount_cents: 55000,
  payments: [],
  settled_date: null,
  deleted_at: null,
} as unknown as FinanceEntry;
it("allows managers to add expenses and edit their information", () => {
  expect(managerCanWrite("finance", entry)).toBe(true);
  expect(managerCanWrite("finance", { ...entry, title: "Edited" }, entry)).toBe(
    true,
  );
});
it("blocks deletion and restoration across collections", () => {
  expect(
    managerCanWrite("finance", { ...entry, deleted_at: "2026-10-28" }, entry),
  ).toBe(false);
  expect(
    managerCanWrite("finance", entry, { ...entry, deleted_at: "2026-10-28" }),
  ).toBe(false);
  expect(
    managerCanWrite("documents", { ...entry, deleted_at: "2026-10-28" }),
  ).toBe(false);
});
it("blocks payment insertion, reversal, legacy settlement and cash movements", () => {
  const paid = {
    ...entry,
    payments: [
      { id: "p", date: "2026-10-28", amount_cents: 100, account_id: null },
    ],
  };
  expect(managerCanWrite("finance", paid, entry)).toBe(false);
  expect(managerCanWrite("finance", entry, paid)).toBe(false);
  expect(
    managerCanWrite("finance", {
      ...entry,
      payments: undefined,
      settled_date: "2026-10-28",
    }),
  ).toBe(false);
  expect(managerCanWrite("settlements", entry)).toBe(false);
  expect(managerCanWrite("transfers", entry)).toBe(false);
  expect(managerCanWrite("finance", { ...paid, title: "Edited" }, paid)).toBe(
    true,
  );
});
