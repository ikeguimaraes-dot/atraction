import { describe, expect, it } from "vitest";
import {
  equalAllocations,
  sharedBalances,
} from "../../src/lib/shared-expenses";

describe("shared expenses", () => {
  it("distributes rounding cents without losing value", () => {
    expect(
      equalAllocations(100, ["a", "b", "c"]).map((x) => x.amount_cents),
    ).toEqual([34, 33, 33]);
  });
  it("credits payer and applies settlements", () => {
    const state = {
      finance: [
        {
          direction: "expense",
          deleted_at: null,
          payments: [
            {
              id: "p",
              date: "2026-01-01",
              account_id: null,
              amount_cents: 1000,
              payer_user_id: "a",
              allocations: [
                { user_id: "a", amount_cents: 500 },
                { user_id: "b", amount_cents: 500 },
              ],
            },
          ],
        },
      ],
      settlements: [
        {
          deleted_at: null,
          from_user_id: "b",
          to_user_id: "a",
          amount_cents: 200,
        },
      ],
    } as never;
    expect(Object.fromEntries(sharedBalances(state))).toEqual({
      a: 300,
      b: -300,
    });
  });
});
