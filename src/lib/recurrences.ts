import type { FinanceEntry, Recurrence, State } from "./types";
import type { useWorkspace } from "./use-workspace";
import { supabase } from "./supabase";
import { base } from "./demo";
import { addMonths } from "./journey";
import { today } from "./finance";
import { installmentPlan } from "./installments";
import { paid } from "./payments";
export function replenishRecurrences(s: State, asOf = today()): State {
  const added: FinanceEntry[] = [];
  const recurrences = (s.recurrences || []).map((r) => {
    if (!r.active) return r;
    const horizon = addMonths(
      r.first_due_date > asOf ? r.first_due_date : asOf,
      11,
    );
    let n = r.next_index;
    for (; n < 1200; n++) {
      const due = addMonths(r.first_due_date, n);
      if (due > horizon || (r.end_date && due > r.end_date)) break;
      if (
        !s.finance.some(
          (f) => f.recurrence_id === r.id && f.recurrence_index === n,
        )
      )
        added.push({
          ...base(r.tenant_id, r.owner_id),
          title: `${r.title} · ${due.slice(5, 7)}/${due.slice(0, 4)}`,
          direction: r.direction,
          amount_cents: r.amount_cents,
          category: r.category,
          due_date: due,
          settled_date: null,
          payments: [],
          contact_id: r.contact_id,
          supplier_id: r.supplier_id,
          notes: r.notes,
          dre_group: r.dre_group,
          recurrence_id: r.id,
          recurrence_index: n,
        });
    }
    return { ...r, next_index: n };
  });
  return { ...s, recurrences, finance: [...added, ...s.finance] };
}
type Work = ReturnType<typeof useWorkspace>;
export async function createRecurrence(
  w: Work,
  entry: FinanceEntry,
  endDate: string | null,
) {
  if (
    !w.state ||
    w.allSelected ||
    w.switching ||
    !["owner", "manager"].includes(w.state.role) ||
    entry.tenant_id !== w.state.tenant.id
  )
    return false;
  installmentPlan(entry.amount_cents, 1, entry.due_date);
  if (endDate && endDate < entry.due_date)
    throw new Error(
      "A data final deve ser igual ou posterior ao primeiro vencimento.",
    );
  try {
    if (w.userId) {
      const { error } = await supabase().rpc("atraction_create_recurrence", {
        t: entry.tenant_id,
        request_id: entry.id,
        entry,
        ends_on: endDate,
      });
      if (error) throw error;
      await w.read(w.userId);
    } else {
      const r: Recurrence = {
        id: entry.id,
        tenant_id: entry.tenant_id,
        owner_id: entry.owner_id,
        title: entry.title,
        direction: entry.direction,
        amount_cents: entry.amount_cents,
        category: entry.category,
        first_due_date: entry.due_date,
        end_date: endDate,
        active: true,
        next_index: 0,
        contact_id: entry.contact_id,
        supplier_id: entry.supplier_id,
        notes: entry.notes,
        dre_group: entry.dre_group,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      };
      w.setState((s) =>
        s
          ? replenishRecurrences({
              ...s,
              recurrences: (s.recurrences || []).some((x) => x.id === r.id)
                ? s.recurrences
                : [...(s.recurrences || []), r],
            })
          : s,
      );
    }
    w.notify("Recorrência mensal criada.");
    return true;
  } catch {
    throw new Error(
      "Não foi possível criar a recorrência. Confira os dados e tente novamente.",
    );
  }
}
export async function stopRecurrence(w: Work, id: string) {
  if (
    !w.state ||
    w.allSelected ||
    w.switching ||
    !["owner", "manager"].includes(w.state.role) ||
    !w.state.recurrences?.some(
      (r) => r.id === id && r.tenant_id === w.state!.tenant.id,
    )
  )
    return false;
  try {
    if (w.userId) {
      const { error } = await supabase().rpc("atraction_stop_recurrence", {
        series: id,
      });
      if (error) throw error;
      await w.read(w.userId);
    } else
      w.setState((s) =>
        s
          ? {
              ...s,
              recurrences: s.recurrences?.map((r) =>
                r.id === id ? { ...r, active: false } : r,
              ),
              finance: s.finance.map((f) =>
                f.recurrence_id === id &&
                !f.deleted_at &&
                f.due_date > today() &&
                paid(f) === 0
                  ? { ...f, deleted_at: new Date().toISOString() }
                  : f,
              ),
            }
          : s,
      );
    w.notify(
      "Recorrência encerrada. Baixas e vencimentos até hoje foram preservados.",
    );
    return true;
  } catch {
    w.notify("Não foi possível encerrar a recorrência. Tente novamente.");
    return false;
  }
}
