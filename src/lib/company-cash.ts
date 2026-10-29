import type { State } from "./types";
import { payments } from "./payments";

// A snapshot starts at each account's opening balance. Unlinked movements
// have no opening snapshot and therefore use their full recorded history.
export function companyCash(state: State, until: string) {
  const accounts = new Map(state.accounts.map((a) => [a.id, a]));
  const eligible = (id: string | null, date: string) => {
    const account = id ? accounts.get(id) : undefined;
    return date <= until && (!account || date >= account.initial_date);
  };
  const companyAccount = (id: string) => {
    const account = accounts.get(id);
    return !!account && !account.holder_user_id;
  };
  let opening = 0,
    incoming = 0,
    outgoing = 0,
    reimbursements = 0,
    unidentified = 0;
  // Archived accounts retain their historical cash; archiving is not a withdrawal.
  for (const account of state.accounts)
    if (!account.holder_user_id && account.initial_date <= until)
      opening += account.initial_cents;
  for (const entry of state.finance) {
    if (entry.deleted_at) continue;
    for (const payment of payments(entry)) {
      if (!eligible(payment.account_id, payment.date)) continue;
      if (entry.direction === "income") {
        if (!payment.account_id || companyAccount(payment.account_id))
          incoming += payment.amount_cents;
      } else if (payment.payer_user_id === null) {
        outgoing += payment.amount_cents;
      } else if (payment.payer_user_id === undefined) {
        unidentified += payment.amount_cents;
      }
    }
  }
  for (const settlement of state.settlements) {
    if (settlement.deleted_at) continue;
    if (
      settlement.from_user_id === null &&
      eligible(settlement.from_account_id, settlement.date)
    ) {
      outgoing += settlement.amount_cents;
      reimbursements += settlement.amount_cents;
    }
    if (
      settlement.to_user_id === null &&
      eligible(settlement.to_account_id, settlement.date)
    )
      incoming += settlement.amount_cents;
  }
  for (const transfer of state.transfers) {
    if (transfer.deleted_at) continue;
    // Both sides are included, so transfers between company accounts cancel
    // unless one side is already incorporated into a newer opening snapshot.
    const from =
      companyAccount(transfer.from_account) &&
      eligible(transfer.from_account, transfer.date);
    const to =
      companyAccount(transfer.to_account) &&
      eligible(transfer.to_account, transfer.date);
    if (from && !to) outgoing += transfer.amount_cents;
    if (to && !from) incoming += transfer.amount_cents;
  }
  return {
    opening,
    incoming,
    outgoing,
    reimbursements,
    unidentified,
    balance: opening + incoming - outgoing,
  };
}
