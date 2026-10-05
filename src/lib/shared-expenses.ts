import type { State } from "./types";
import { payments } from "./payments";

export const companyKey = "company";
export const participantKey = (userId: string | null) => userId || companyKey;
export const participantId = (key: string) => (key === companyKey ? null : key);

export function equalAllocations(amount: number, keys: string[]) {
  if (!keys.length) return [];
  const base = Math.floor(amount / keys.length);
  let remainder = amount - base * keys.length;
  return keys.map((key) => ({
    user_id: participantId(key),
    amount_cents: base + (remainder-- > 0 ? 1 : 0),
  }));
}

export function sharedBalances(state: State) {
  const balances = new Map<string, number>();
  const add = (userId: string | null, value: number) =>
    balances.set(
      participantKey(userId),
      (balances.get(participantKey(userId)) || 0) + value,
    );
  for (const entry of state.finance.filter(
    (entry) => !entry.deleted_at && entry.direction === "expense",
  )) {
    for (const payment of payments(entry)) {
      if (!payment.allocations?.length) continue;
      add(payment.payer_user_id ?? null, payment.amount_cents);
      payment.allocations.forEach((allocation) =>
        add(allocation.user_id, -allocation.amount_cents),
      );
    }
  }
  for (const settlement of state.settlements.filter(
    (item) => !item.deleted_at,
  )) {
    add(settlement.from_user_id, settlement.amount_cents);
    add(settlement.to_user_id, -settlement.amount_cents);
  }
  return balances;
}
