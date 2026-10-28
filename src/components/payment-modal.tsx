"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { FinanceEntry } from "@/lib/types";
import { remaining, payments } from "@/lib/payments";
import { recordPayment } from "@/lib/operations";
import { cents, today } from "@/lib/finance";
import { money, alive } from "@/lib/domain";
import { uuid } from "@/lib/demo";
import { companyKey, participantId } from "@/lib/shared-expenses";
import { useTeamMembers } from "@/lib/use-team-members";
import { Modal } from "./ui";
export function PaymentModal({
  w,
  entry,
  onClose,
}: {
  w: ReturnType<typeof useWorkspace>;
  entry: FinanceEntry;
  onClose: () => void;
}) {
  const f = w.state!.finance.find((x) => x.id === entry.id) || entry;
  const [amount, setAmount] = useState((remaining(f) / 100).toFixed(2));
  const [date, setDate] = useState(today());
  const [account, setAccount] = useState("");
  const members = useTeamMembers(w.state!.tenant.id);
  const participants = [
    { key: companyKey, label: "Empresa" },
    ...members.map((m) => ({ key: m.user_id, label: m.email })),
  ];
  const [payer, setPayer] = useState(f.purchase_payer || companyKey);
  const [expenseOwner, setExpenseOwner] = useState(companyKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(uuid());
  return (
    <Modal
      title={
        f.direction === "income"
          ? "Registrar recebimento"
          : "Registrar pagamento"
      }
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          try {
            const value = cents(amount);
            if (value > remaining(f))
              throw new Error("O valor excede o saldo restante.");
            const allocations =
              f.direction === "expense"
                ? [
                    {
                      user_id: participantId(expenseOwner),
                      amount_cents: value,
                    },
                  ]
                : undefined;
            if (
              await recordPayment(w, f, {
                id: requestId,
                date,
                amount_cents: value,
                account_id: account || null,
                payer_user_id:
                  f.direction === "expense" ? participantId(payer) : undefined,
                allocations,
              })
            )
              onClose();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <p>
          {f.title} · Falta {money(remaining(f) / 100)}
        </p>
        <p>
          Registre valores já recebidos ou pagos, inclusive parciais. Nenhuma
          transferência bancária é executada.
        </p>
        {remaining(f) > 0 && (
          <>
            <div className="form-grid">
              <label>
                Valor da baixa (R$)
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label>
                Data da baixa
                <input
                  required
                  type="date"
                  max={today()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                Conta da baixa
                <select
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    const owner = w.state!.accounts.find(
                      (a) => a.id === e.target.value,
                    )?.holder_user_id;
                    setPayer(owner || companyKey);
                  }}
                >
                  <option value="">Sem conta vinculada</option>
                  {alive(w.state!.accounts).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {f.direction === "expense" && (
              <section className="card" style={{ marginTop: 16 }}>
                <h3>Divisão da despesa</h3>
                <div className="form-grid">
                  <label>
                    Quem pagou
                    <select
                      value={payer}
                      onChange={(e) => setPayer(e.target.value)}
                    >
                      {!participants.some((person) => person.key === payer) && (
                        <option value={payer} disabled>
                          Membro indisponível — escolha outro pagador
                        </option>
                      )}
                      {participants.map((person) => (
                        <option key={person.key} value={person.key}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    De quem é a despesa
                    <select
                      value={expenseOwner}
                      onChange={(e) => setExpenseOwner(e.target.value)}
                    >
                      {participants.map((person) => (
                        <option key={person.key} value={person.key}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="management-hint">
                  Quem pagou informa de onde saiu o dinheiro. De quem é a
                  despesa define quem deve arcar com o valor.
                </p>
                <p role="status">
                  {payer === expenseOwner
                    ? "Quem pagou é o responsável pela despesa. Não há reembolso."
                    : `${participants.find((person) => person.key === expenseOwner)?.label || "Membro"} deve reembolsar ${participants.find((person) => person.key === payer)?.label || "o pagador"} pelo valor desta baixa.`}
                </p>
              </section>
            )}
            <button className="primary" disabled={saving || w.busy}>
              Confirmar baixa
            </button>
          </>
        )}
        {payments(f).map((p) => (
          <div className="document-row" key={p.id}>
            <span>
              {money(p.amount_cents / 100)} ·{" "}
              {p.date.split("-").reverse().join("/")}
              <small>
                {w.state!.accounts.find((a) => a.id === p.account_id)?.name ||
                  "Sem conta vinculada"}
                {p.allocations?.length
                  ? ` · Pago por ${participants.find((x) => x.key === (p.payer_user_id || companyKey))?.label || "membro"}`
                  : ""}
                {p.allocations?.map((allocation, index) => (
                  <span key={index}>
                    {" · Despesa de "}
                    {participants.find(
                      (person) =>
                        person.key === (allocation.user_id || companyKey),
                    )?.label || "membro"}
                    {": "}
                    {money(allocation.amount_cents / 100)}
                  </span>
                ))}
              </small>
            </span>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await recordPayment(w, f, p, p.id);
                setSaving(false);
              }}
            >
              Estornar baixa
            </button>
          </div>
        ))}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
