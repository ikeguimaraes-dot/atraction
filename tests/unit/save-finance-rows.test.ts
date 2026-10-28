import { expect, it, vi } from "vitest";
import {
  financeSaveMessage,
  saveFinanceRows,
} from "../../src/lib/save-finance-rows";
import type { FinanceEntry } from "../../src/lib/types";
const rows: FinanceEntry[] = [
  {
    id: "fixed-request",
    tenant_id: "company",
    owner_id: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    is_example: false,
    title: "Compra",
    direction: "expense",
    amount_cents: 162911,
    category: "Materiais",
    due_date: "2026-10-28",
    settled_date: null,
    contact_id: null,
    supplier_id: null,
    notes: "",
    payments: [],
  },
];
it("retries a gateway 520 once with identical IDs after checking whether the expense exists", async () => {
  const insert = vi
    .fn()
    .mockResolvedValueOnce({
      error: { message: "<html>520</html>" },
      status: 520,
    })
    .mockResolvedValueOnce({ error: null, status: 201 });
  const find = vi.fn().mockResolvedValue({ data: [], error: null });
  await saveFinanceRows(rows, { insert, find });
  expect(insert).toHaveBeenCalledTimes(2);
  expect(insert.mock.calls[0][0]).toBe(rows);
  expect(insert.mock.calls[1][0]).toBe(rows);
  expect(find).toHaveBeenCalledWith(["fixed-request"]);
});
it("recognizes a committed insert with a lost response without inserting again", async () => {
  const insert = vi
    .fn()
    .mockResolvedValue({ error: { message: "timeout" }, status: 520 });
  const find = vi
    .fn()
    .mockResolvedValue({ data: [{ id: "fixed-request" }], error: null });
  await saveFinanceRows(rows, { insert, find });
  expect(insert).toHaveBeenCalledTimes(1);
});
it("does not retry validation or permission failures", async () => {
  const error = { code: "23514", message: "invalid purchase" };
  const insert = vi.fn().mockResolvedValue({ error, status: 400 });
  const find = vi.fn();
  await expect(saveFinanceRows(rows, { insert, find })).rejects.toBe(error);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(find).not.toHaveBeenCalled();
  expect(financeSaveMessage(error)).toContain("quantidade de parcelas");
});
it("stops after two failures and never exposes the gateway HTML to the user", async () => {
  const error = { message: "<html>520 gateway</html>" };
  const insert = vi.fn().mockResolvedValue({ error, status: 520 });
  const find = vi
    .fn()
    .mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(saveFinanceRows(rows, { insert, find })).rejects.toBe(error);
  expect(insert).toHaveBeenCalledTimes(2);
  expect(financeSaveMessage(error)).not.toContain("<html>");
});
it("recovers a duplicate response only if every requested row is present", async () => {
  const error = { code: "23505", message: "duplicate" };
  const insert = vi.fn().mockResolvedValue({ error, status: 409 });
  const find = vi
    .fn()
    .mockResolvedValue({ data: [{ id: "different-request" }], error: null });
  await expect(saveFinanceRows(rows, { insert, find })).rejects.toBe(error);
  expect(insert).toHaveBeenCalledTimes(1);
});
