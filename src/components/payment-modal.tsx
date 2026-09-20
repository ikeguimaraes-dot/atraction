"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { FinanceEntry } from "@/lib/types";
import { remaining, payments } from "@/lib/payments";
import { recordPayment } from "@/lib/operations";
import { cents, today } from "@/lib/finance";
import { money, alive } from "@/lib/domain";
import { uuid } from "@/lib/demo";
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
            if (
              await recordPayment(w, f, {
                id: requestId,
                date,
                amount_cents: value,
                account_id: account || null,
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
                  onChange={(e) => setAccount(e.target.value)}
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
