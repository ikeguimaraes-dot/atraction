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

describe("company reimbursements", () => {
  function state(payer: string | null, owner: string | null) {
    return {
      finance: [
        {
          direction: "expense",
          deleted_at: null,
          payments: [
            {
              id: "payment",
              date: "2026-10-28",
              account_id: null,
              amount_cents: 162911,
              payer_user_id: payer,
              allocations: [{ user_id: owner, amount_cents: 162911 }],
            },
          ],
        },
      ],
      settlements: [],
    } as unknown as Parameters<typeof sharedBalances>[0];
  }

  it("company owes the full payment to the member, regardless of revenue", () => {
    const s = state("member", null);
    s.finance.push({ ...s.finance[0], direction: "income" });
    expect(Object.fromEntries(sharedBalances(s))).toEqual({
      member: 162911,
      company: -162911,
    });
    s.settlements.push({
      from_user_id: null,
      to_user_id: "member",
      amount_cents: 62911,
      deleted_at: null,
    } as (typeof s.settlements)[number]);
    expect(Object.fromEntries(sharedBalances(s))).toEqual({
      member: 100000,
      company: -100000,
    });
    s.settlements.push({
      from_user_id: null,
      to_user_id: "member",
      amount_cents: 100000,
      deleted_at: null,
    } as (typeof s.settlements)[number]);
    expect(Object.fromEntries(sharedBalances(s))).toEqual({
      member: 0,
      company: 0,
    });
  });

  it("does not create a reimbursement when payer owns the expense", () => {
    expect(Object.fromEntries(sharedBalances(state(null, null)))).toEqual({
      company: 0,
    });
    expect(
      Object.fromEntries(sharedBalances(state("member", "member"))),
    ).toEqual({ member: 0 });
  });

  it("member owes company when company pays the member's expense", () => {
    expect(Object.fromEntries(sharedBalances(state(null, "member")))).toEqual({
      company: 162911,
      member: -162911,
    });
  });

  it("reversing the payment removes the reimbursement", () => {
    const s = state("member", null);
    s.finance[0].payments = [];
    expect(Object.fromEntries(sharedBalances(s))).toEqual({});
  });
});
