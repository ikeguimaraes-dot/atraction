"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { TeamMember } from "@/lib/use-team-members";
import { monthlyProfit, splitProfit } from "@/lib/profit-sharing";
import { today } from "@/lib/finance";
import { money } from "@/lib/domain";
import { Modal } from "./ui";

type Work = ReturnType<typeof useWorkspace>;
export function ProfitSharing({
  w,
  members,
}: {
  w: Work;
  members: TeamMember[];
}) {
  const s = w.state!;
  const [month, setMonth] = useState(today().slice(0, 7));
  const [editing, setEditing] = useState(false);
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const totals = valid
    ? monthlyProfit(s.finance, s.documents, month)
    : { revenue: 0, expense: 0, profit: 0 };
  const participants =
    s.tenant.settings?.profit_sharing?.[month]?.participants || [];
  const shares = splitProfit(totals.profit, participants);
  const label = (id: string) =>
    members.find((m) => m.user_id === id)?.email ||
    `Membro indisponível (${id.slice(-6)})`;
  return (
    <section className="profit-sharing" aria-label="Divisão dos lucros">
      <div className="management-toolbar">
        <label>
          Mês do lucro
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {s.role === "owner" && (
          <button
            type="button"
            className="secondary"
            disabled={!valid || w.busy}
            onClick={() => setEditing(true)}
          >
            Escolher participantes do lucro
          </button>
        )}
      </div>
      {!valid && (
        <p role="alert" className="error">
          Escolha um mês válido.
        </p>
      )}
      <div className="card profit-total" aria-label="Lucro mensal para divisão">
        <h3>{totals.profit < 0 ? "Prejuízo do mês" : "Lucro do mês"}</h3>
        <strong>{money(totals.profit / 100)}</strong>
        <p>
          Receitas cadastradas: {money(totals.revenue / 100)} · Despesas
          cadastradas: {money(totals.expense / 100)}
        </p>
      </div>
      <p>
        Mesmo cálculo do Financeiro: receitas menos despesas do mês, incluindo
        lançamentos ainda sem baixa. A divisão não representa um pagamento
        realizado nem o saldo disponível em caixa.
      </p>
      {shares.length ? (
        <>
          <p>
            Divisão igual entre {shares.length}{" "}
            {shares.length === 1 ? "participante" : "participantes"}. Os valores
            são recalculados se os lançamentos do mês mudarem.
          </p>
          <div className="customer-grid">
            {shares.map((share) => (
              <article
                key={share.user_id}
                className="card profit-participant"
                aria-label={`Lucro de ${label(share.user_id)}`}
              >
                <strong>{label(share.user_id)}</strong>
                <p>Lucro a receber da empresa</p>
                <strong>{money(share.amount_cents / 100)}</strong>
              </article>
            ))}
          </div>
          <small>
            Eventuais centavos restantes são distribuídos entre os participantes
            para fechar o total. Esta divisão é separada dos reembolsos abaixo.
          </small>
        </>
      ) : (
        <p>
          Nenhum participante escolhido para este mês.{" "}
          {s.role === "owner"
            ? "Escolha quem participa para calcular a divisão."
            : "Um dono da empresa pode configurar a divisão."}
        </p>
      )}
      {valid && totals.profit <= 0 && (
        <p>Não há lucro positivo para distribuir neste mês.</p>
      )}
      {editing && (
        <ProfitParticipants
          key={`${s.tenant.id}:${month}`}
          w={w}
          members={members}
          month={month}
          profit={totals.profit}
          initial={participants}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}

function ProfitParticipants({
  w,
  members,
  month,
  profit,
  initial,
  onClose,
}: {
  w: Work;
  members: TeamMember[];
  month: string;
  profit: number;
  initial: string[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState([...initial]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const shares = splitProfit(profit, selected);
  const unavailable = selected.filter(
    (id) => !members.some((m) => m.user_id === id),
  );
  const people = [
    ...members.map((m) => ({ id: m.user_id, label: m.email })),
    ...unavailable.map((id) => ({
      id,
      label: `Membro indisponível (${id.slice(-6)})`,
    })),
  ];
  return (
    <Modal
      title="Participantes da divisão de lucros"
      onClose={saving ? () => {} : onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSaving(true);
          try {
            if (w.state?.role !== "owner" || w.switching || w.allSelected)
              throw new Error(
                "Somente donos podem configurar a divisão de lucros.",
              );
            if (selected.some((id) => !members.some((m) => m.user_id === id)))
              throw new Error(
                "Remova os membros indisponíveis antes de salvar a divisão.",
              );
            const settings = w.state.tenant.settings || {};
            const ok = await w.updateTenant({
              settings: {
                ...settings,
                profit_sharing: {
                  ...settings.profit_sharing,
                  [month]: { participants: [...new Set(selected)].sort() },
                },
              },
            });
            if (!ok)
              throw new Error(
                "Não foi possível salvar a divisão. Tente novamente.",
              );
            onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <p>
          Mês: {month.split("-").reverse().join("/")} · Lucro a dividir:{" "}
          {money(Math.max(0, profit) / 100)}
        </p>
        <p>
          Escolha os membros que participarão igualmente. A escolha fica salva
          apenas para esta empresa e este mês.
        </p>
        {!members.length && (
          <p>
            Nenhum membro disponível. Confira a equipe da empresa ou recarregue
            a página.
          </p>
        )}
        {people.map((person) => (
          <label className="checkbox" key={person.id}>
            <input
              type="checkbox"
              disabled={saving}
              checked={selected.includes(person.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked
                    ? [...ids, person.id]
                    : ids.filter((id) => id !== person.id),
                )
              }
            />
            {person.label} ·{" "}
            {money(
              (shares.find((p) => p.user_id === person.id)?.amount_cents || 0) /
                100,
            )}
          </label>
        ))}
        {!selected.length && (
          <p>Sem participantes, o lucro ficará sem divisão neste mês.</p>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="primary" disabled={saving || w.busy}>
            {saving ? "Salvando…" : "Salvar divisão dos lucros"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
