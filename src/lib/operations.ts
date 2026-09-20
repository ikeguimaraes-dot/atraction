import type { useWorkspace } from "./use-workspace";
import type { FinanceEntry, Payment } from "./types";
import { supabase } from "./supabase";
import { payments } from "./payments";
export async function recordPayment(
  w: ReturnType<typeof useWorkspace>,
  f: FinanceEntry,
  p: Payment,
  reverse?: string,
) {
  try {
    if (w.userId) {
      const { error } = await supabase().rpc("atraction_record_payment", {
        entry: f.id,
        amount: p.amount_cents,
        paid_on: p.date,
        account: p.account_id,
        request_id: p.id,
        reverse_id: reverse || null,
      });
      if (error) throw error;
      await w.read(w.userId);
    } else {
      const current = w.state!.finance.find((x) => x.id === f.id)!;
      const list =
        reverse === "00000000-0000-0000-0000-000000000000"
          ? []
          : reverse
            ? payments(current).filter((x) => x.id !== reverse)
            : [...payments(current), p];
      if (list.reduce((n, p) => n + p.amount_cents, 0) > current.amount_cents)
        throw new Error("exceeds");
      w.setState((s) =>
        s
          ? {
              ...s,
              finance: s.finance.map((x) =>
                x.id === f.id
                  ? {
                      ...x,
                      payments: list,
                      settled_date:
                        list.reduce((n, p) => n + p.amount_cents, 0) ===
                        x.amount_cents
                          ? list
                              .map((x) => x.date)
                              .sort()
                              .at(-1)!
                          : null,
                    }
                  : x,
              ),
            }
          : s,
      );
    }
    w.notify(reverse ? "Baixa estornada." : "Baixa registrada.");
    return true;
  } catch {
    w.notify(
      "Não foi possível registrar. Confira o valor restante, a conta e a conexão.",
    );
    return false;
  }
}
