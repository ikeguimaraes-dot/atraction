"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { FinanceEntry } from "@/lib/types";
import { remaining, payments } from "@/lib/payments";
import { recordPayment } from "@/lib/operations";
import { cents, today } from "@/lib/finance";
import { money, alive } from "@/lib/domain";
import { uuid } from "@/lib/demo";
import {
  companyKey,
  equalAllocations,
  participantId,
} from "@/lib/shared-expenses";
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
  const [payer, setPayer] = useState(companyKey);
  const [mode, setMode] = useState<"equal" | "percent" | "amount">("equal");
  const [selected, setSelected] = useState<string[]>([companyKey]);
  const [shares, setShares] = useState<Record<string, string>>({
    company: "100",
  });
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
            let allocations;
            if (f.direction === "expense") {
              if (!selected.length)
                throw new Error("Escolha quem participa da despesa.");
              if (mode === "equal")
                allocations = equalAllocations(value, selected);
              else if (mode === "percent") {
                const values = selected.map((key) =>
                  Number((shares[key] || "0").replace(",", ".")),
                );
                if (Math.abs(values.reduce((n, x) => n + x, 0) - 100) > 0.001)
                  throw new Error("Os percentuais precisam somar 100%.");
                let used = 0;
                allocations = selected.map((key, index) => {
                  const amount_cents =
                    index === selected.length - 1
                      ? value - used
                      : Math.round((value * values[index]) / 100);
                  used += amount_cents;
                  return { user_id: participantId(key), amount_cents };
                });
              } else {
                allocations = selected.map((key) => ({
                  user_id: participantId(key),
                  amount_cents: cents(shares[key] || "0"),
                }));
                if (
                  allocations.reduce((n, x) => n + x.amount_cents, 0) !== value
                )
                  throw new Error(
                    "Os valores da divisão precisam somar o valor da baixa.",
                  );
              }
            }
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
                      {participants.map((person) => (
                        <option key={person.key} value={person.key}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Como dividir
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as typeof mode)}
                    >
                      <option value="equal">Igualmente</option>
                      <option value="percent">Por percentual</option>
                      <option value="amount">Por valor</option>
                    </select>
                  </label>
                </div>
                {participants.map((person) => {
                  const checked = selected.includes(person.key);
                  return (
                    <div className="document-row" key={person.key}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelected((current) =>
                              e.target.checked
                                ? [...current, person.key]
                                : current.filter((key) => key !== person.key),
                            );
                          }}
                        />{" "}
                        {person.label}
                      </label>
                      {checked && mode !== "equal" && (
                        <input
                          aria-label={`${mode === "percent" ? "Percentual" : "Valor"} de ${person.label}`}
                          inputMode="decimal"
                          value={shares[person.key] || ""}
                          onChange={(e) =>
                            setShares((current) => ({
                              ...current,
                              [person.key]: e.target.value,
                            }))
                          }
                          placeholder={mode === "percent" ? "%" : "R$"}
                        />
                      )}
                    </div>
                  );
                })}
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
