import { TrendingUp } from "lucide-react";
import { money } from "@/lib/domain";
import { financeReferenceDate } from "@/lib/finance";
import type { State } from "@/lib/types";

export function FinanceAccumulatedSummary({
  state,
  from,
  until,
}: {
  state: State;
  from: string;
  until: string;
}) {
  let accumulated = 0;
  let previous = 0;
  for (const entry of state.finance) {
    const date = financeReferenceDate(entry, state.documents);
    if (entry.deleted_at || !date || date > until) continue;
    const amount = entry.amount_cents * (entry.direction === "income" ? 1 : -1);
    accumulated += amount;
    if (from && date < from) previous += amount;
  }
  return (
    <section
      className="card finance-accumulated-card"
      aria-label="Lucro acumulado da empresa"
    >
      <header>
        <div>
          <h3>
            <TrendingUp size={20} aria-hidden="true" /> Resultado acumulado da
            empresa
          </h3>
          <p className="management-hint">
            Todo o histórico até {until.split("-").reverse().join("/")},
            incluindo os meses anteriores.
          </p>
        </div>
      </header>
      <div className="finance-accumulated-values">
        <div aria-label="Resultado acumulado">
          <span>
            {accumulated < 0 ? "Prejuízo acumulado" : "Lucro acumulado"}
          </span>
          <strong className={accumulated < 0 ? "expense" : "income"}>
            {money(accumulated / 100)}
          </strong>
          <small>
            Receitas menos despesas, compensando lucros e prejuízos de todos os
            meses.
          </small>
          {from && (
            <div className="finance-accumulated-breakdown">
              <small>Resultado anterior: {money(previous / 100)}</small>
              <small>
                Resultado no período: {money((accumulated - previous) / 100)}
              </small>
            </div>
          )}
        </div>
      </div>
      <p className="management-hint">
        O resultado inclui valores recebidos, pagos e ainda em aberto.
      </p>
    </section>
  );
}
