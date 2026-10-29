"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/lib/supabase";
import { withPaymentPayer } from "@/lib/payment-payer";
import type { Payment, FinanceEntry } from "@/lib/types";
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
  const canSettle = w.state!.role === "owner";
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
        {remaining(f) > 0 && canSettle && (
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
            {f.direction === "expense" && canSettle && (
              <PaymentPayerEditor
                key={JSON.stringify(p)}
                w={w}
                entry={f}
                payment={p}
                participants={participants}
              />
            )}
            <button
              type="button"
              className="secondary"
              disabled={saving || !canSettle}
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

function PaymentPayerEditor({
  w,
  entry,
  payment,
  participants,
}: {
  w: ReturnType<typeof useWorkspace>;
  entry: FinanceEntry;
  payment: Payment;
  participants: { key: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [payer, setPayer] = useState(payment.payer_user_id || companyKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  if (!editing)
    return (
      <button
        type="button"
        className="secondary"
        disabled={w.busy}
        onClick={() => setEditing(true)}
      >
        Corrigir quem pagou
      </button>
    );
  return (
    <div className="form">
      <label>
        Quem pagou esta baixa
        <select
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          disabled={saving}
        >
          {!participants.some((p) => p.key === payer) && (
            <option value={payer} disabled>
              Membro indisponível — escolha outro pagador
            </option>
          )}
          {participants.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        O valor, a data e a conta da baixa serão mantidos. O saldo de reembolso
        será recalculado.
      </p>
      {!payment.allocations && (
        <p>
          Esta baixa ainda não tem responsável informado. A despesa será
          atribuída à empresa.
        </p>
      )}
      <button
        type="button"
        className="primary"
        disabled={saving || w.busy}
        onClick={async () => {
          setSaving(true);
          setError("");
          try {
            if (
              w.state?.role !== "owner" ||
              w.switching ||
              w.allSelected ||
              w.state.tenant.id !== entry.tenant_id
            )
              throw new Error("Somente donos podem corrigir o pagador.");
            if (!participants.some((p) => p.key === payer))
              throw new Error("Escolha um pagador desta empresa.");
            const corrected = withPaymentPayer(payment, participantId(payer));
            if (w.userId) {
              const { error } = await supabase().rpc(
                "atraction_correct_payment_payer",
                {
                  entry_id: entry.id,
                  payment_id: payment.id,
                  expected: payment,
                  payer: participantId(payer),
                },
              );
              if (error) throw error;
              await w.read(w.userId);
            } else {
              const current = w.state.finance.find((f) => f.id === entry.id);
              if (
                !current ||
                JSON.stringify(
                  payments(current).find((p) => p.id === payment.id),
                ) !== JSON.stringify(payment)
              )
                throw new Error(
                  "Esta baixa foi alterada. Feche e abra novamente.",
                );
              w.setState((s) =>
                s
                  ? {
                      ...s,
                      finance: s.finance.map((f) =>
                        f.id === entry.id
                          ? {
                              ...f,
                              payments: payments(f).map((p) =>
                                p.id === payment.id ? corrected : p,
                              ),
                            }
                          : f,
                      ),
                    }
                  : s,
              );
            }
            w.notify("Pagador corrigido. A baixa foi mantida.");
            setEditing(false);
          } catch (err) {
            setError(
              (err as Error).message || "Não foi possível corrigir o pagador.",
            );
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Salvando…" : "Salvar pagador"}
      </button>
      <button
        type="button"
        className="secondary"
        disabled={saving}
        onClick={() => setEditing(false)}
      >
        Cancelar correção
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </div>
  );
}
