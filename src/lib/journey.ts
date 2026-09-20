import type { State, Contract, FinanceEntry, Contact } from "./types";
import { base } from "./demo";
import { today } from "./finance";
export function addMonths(date: string, months: number) {
  const [y, m, d] = date.split("-").map(Number);
  const end = new Date(Date.UTC(y, m + months, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, end)))
    .toISOString()
    .slice(0, 10);
}
export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function schedule(c: Contract): FinanceEntry[] {
  const n = c.mode === "once" ? 1 : c.periods;
  return Array.from({ length: n }, (_, i) => ({
    ...base(c.tenant_id, c.owner_id),
    contract_id: c.id,
    installment: i + 1,
    title: `${c.title} · ${i + 1}/${n}`,
    direction: "income" as const,
    amount_cents:
      c.mode === "installments"
        ? Math.floor(c.amount_cents / n) + (i < c.amount_cents % n ? 1 : 0)
        : c.amount_cents,
    category: c.mode === "monthly" ? "Mensalidades" : "Contratos",
    due_date: addMonths(c.first_due_date, i),
    settled_date: null,
    contact_id: c.contact_id,
    supplier_id: null,
    notes: "",
  }));
}
export function lastContact(s: State, c: Contact) {
  return [
    c.last_contact_at || c.customer_since || c.created_at,
    ...s.activities
      .filter((a) => !a.deleted_at && a.done && a.contact_id === c.id)
      .map((a) => a.updated_at),
    ...s.messages
      .filter(
        (m) =>
          !m.deleted_at &&
          m.contact_id === c.id &&
          (m.status === "sent" || m.status === "received"),
      )
      .map((m) => m.created_at),
  ]
    .filter(Boolean)
    .sort()
    .at(-1)!
    .slice(0, 10);
}
export function sourceResults(s: State, from: string, to: string) {
  const groups = new Map<
    string,
    {
      source: string;
      campaign: string;
      leads: number;
      customers: number;
      received: number;
    }
  >();
  for (const c of s.contacts) {
    const source = c.source || "Sem origem";
    const campaign = c.campaign || "Sem campanha";
    const key = JSON.stringify([source, campaign]);
    const g = groups.get(key) || {
      source,
      campaign,
      leads: 0,
      customers: 0,
      received: 0,
    };
    if (
      !c.deleted_at &&
      c.created_at.slice(0, 10) >= from &&
      c.created_at.slice(0, 10) <= to
    ) {
      g.leads++;
      if (
        c.lifecycle === "customer" ||
        c.lifecycle === "inactive" ||
        s.deals.some(
          (d) => !d.deleted_at && d.contact_id === c.id && d.stage === 4,
        )
      )
        g.customers++;
    }
    g.received += s.finance
      .filter(
        (f) =>
          !f.deleted_at &&
          f.contact_id === c.id &&
          f.direction === "income" &&
          f.settled_date &&
          f.settled_date >= from &&
          f.settled_date <= to,
      )
      .reduce((n, f) => n + f.amount_cents, 0);
    if (g.leads || g.received) groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) => b.received - a.received || b.leads - a.leads,
  );
}
export function pendingRetention(s: State) {
  const now = today();
  return s.contacts
    .filter((c) => !c.deleted_at && c.lifecycle === "customer")
    .map((c) => ({
      contact: c,
      last: lastContact(s, c),
      due: addDays(lastContact(s, c), c.retention_days || 30),
    }))
    .filter((x) => x.due <= now)
    .sort((a, b) => a.due.localeCompare(b.due));
}
