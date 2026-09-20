import type { State, Segment, Contact } from "./types";
import { remaining } from "./payments";
import { today } from "./finance";
import { addDays } from "./journey";
export function segmentContacts(
  s: State,
  segment: Pick<Segment, "rule" | "value">,
): Contact[] {
  return s.contacts.filter(
    (c) =>
      !c.deleted_at &&
      (
        {
          all: true,
          source: c.source.toLowerCase().includes(segment.value.toLowerCase()),
          tag: c.tags.some(
            (t) => t.toLowerCase() === segment.value.toLowerCase(),
          ),
          lifecycle: (c.lifecycle || "prospect") === segment.value,
          overdue: s.finance.some(
            (f) =>
              !f.deleted_at &&
              f.direction === "income" &&
              f.contact_id === c.id &&
              remaining(f) > 0 &&
              f.due_date < today(),
          ),
          renewals: s.contracts.some(
            (x) =>
              x.contact_id === c.id &&
              x.status === "active" &&
              x.end_date <= addDays(today(), 30) &&
              !s.contracts.some((r) => r.renews_id === x.id),
          ),
        } as Record<string, boolean>
      )[segment.rule],
  );
}
export function upcomingBirthdays(s: State) {
  return s.contacts
    .filter((c) => !c.deleted_at && c.birthday)
    .map((c) => ({ contact: c, date: nextBirthday(c.birthday!) }))
    .filter((x) => x.date <= addDays(today(), 7))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function nextBirthday(b: string) {
  const year = Number(today().slice(0, 4));
  const date = (y: number) =>
    `${y}-${b.slice(5) === "02-29" && new Date(Date.UTC(y, 2, 0)).getUTCDate() === 28 ? "02-28" : b.slice(5)}`;
  return date(year) < today() ? date(year + 1) : date(year);
}
