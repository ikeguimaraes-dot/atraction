import { Wallet } from "lucide-react";
import { companyCash } from "@/lib/company-cash";
import { money } from "@/lib/domain";
import { financeReferenceDate } from "@/lib/finance";
import type { State } from "@/lib/types";

export function FinanceCashSummary({
  state,
  from,
  until,
}: {
  state: State;
  from: string;
  until: string;
}) {
  const cash = companyCash(state, until);
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
    <section className="card finance-cash-card" aria-label="Caixa da empresa">
      <header>
        <div>
          <h3>
            <Wallet size={20} aria-hidden="true" /> Caixa da empresa
          </h3>
          <p className="management-hint">
            Todo o histórico até {until.split("-").reverse().join("/")},
            incluindo os meses anteriores.
          </p>
        </div>
      </header>
      <div className="finance-cash-values">
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
            <div className="finance-cash-breakdown">
              <small>Resultado anterior: {money(previous / 100)}</small>
              <small>
                Resultado no período: {money((accumulated - previous) / 100)}
              </small>
            </div>
          )}
        </div>
        <div aria-label="Saldo em caixa">
          <span>
            {cash.unidentified
              ? "Saldo em caixa a conferir"
              : "Saldo em caixa registrado"}
          </span>
          <strong className={cash.balance < 0 ? "expense" : "income"}>
            {money(cash.balance / 100)}
          </strong>
          <small>Saldo inicial + entradas − saídas efetivas da empresa.</small>
          <div className="finance-cash-breakdown">
            <small>Saldo inicial: {money(cash.opening / 100)}</small>
            <small>
              Entradas: {money(cash.incoming / 100)} · Saídas:{" "}
              {money(cash.outgoing / 100)}
            </small>
          </div>
        </div>
      </div>
      <p className="management-hint">
        O resultado inclui valores em aberto. O caixa considera os saldos
        iniciais das contas da empresa e os movimentos registrados. Despesas
        pagas por sócios ou equipe só reduzem o caixa ao registrar o reembolso.
      </p>
      {!!cash.unidentified && (
        <p className="company-cash-warning" role="status">
          Há {money(cash.unidentified / 100)} em pagamentos sem pagador
          identificado, ainda não descontados do caixa. Identifique quem pagou
          para conferir o saldo.
        </p>
      )}
    </section>
  );
}
