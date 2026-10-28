import type { Collection, FinanceEntry, Row } from "./types";

export function managerCanWrite(
  collection: Collection,
  row: Row,
  previous?: Row,
) {
  if (collection === "transfers" || collection === "settlements") return false;
  if ((row.deleted_at || null) !== (previous?.deleted_at || null)) return false;
  if (collection === "finance") {
    const entry = row as FinanceEntry;
    const old = previous as FinanceEntry | undefined;
    if (
      JSON.stringify(entry.payments || []) !==
      JSON.stringify(old?.payments || [])
    )
      return false;
    if ((entry.settled_date || null) !== (old?.settled_date || null))
      return false;
  }
  return true;
}
