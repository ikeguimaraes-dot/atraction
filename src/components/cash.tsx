"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Account } from "@/lib/types";
import { accountBalance, dre, payments } from "@/lib/payments";
import { cents, today } from "@/lib/finance";
import { addDays } from "@/lib/journey";
import { money, alive } from "@/lib/domain";
import { exportCsv } from "@/lib/files";
import { SectionTitle, Modal, Empty } from "./ui";
export function Cash({ w }: { w: ReturnType<typeof useWorkspace> }) {
  const s = w.state!;
  const [modal, setModal] = useState<"account" | "transfer" | null>(null);
  const [editing, setEditing] = useState<Account>();
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const result = dre(s, from, to);
  return (
    <>
      <SectionTitle
        title="Caixa e resultado"
        subtitle="Contas, transferências registradas e DRE gerencial pelo regime de caixa."
        action={
          <div className="management-actions">
            <button
              className="secondary"
              onClick={() => {
                setError("");
                setModal("transfer");
              }}
            >
              Registrar transferência
            </button>
            <button
              className="primary"
              onClick={() => {
                setEditing(undefined);
                setError("");
                setModal("account");
              }}
            >
              Nova conta
            </button>
          </div>
        }
      />
      <div className="customer-grid">
        {s.accounts.map((a) => (
          <section className="card supplier-card" key={a.id}>
            <h3>
              {a.name}
              {a.deleted_at ? " (arquivada)" : ""}
            </h3>
            <p>
              {a.kind === "cash" ? "Caixa" : "Banco"} · Saldo inicial em{" "}
              {a.initial_date.split("-").reverse().join("/")}
            </p>
            <strong>{money(accountBalance(s, a, to) / 100)}</strong>
            <p>Saldo registrado até {to.split("-").reverse().join("/")}</p>
            <button
              className="text-button"
              onClick={() => {
                setEditing(a);
                setModal("account");
              }}
            >
              Editar saldo inicial
            </button>
            <button
              className="text-button"
              disabled={w.busy}
              onClick={() =>
                w.write("accounts", {
                  ...a,
                  deleted_at: a.deleted_at ? null : new Date().toISOString(),
                })
              }
            >
              {a.deleted_at ? "Reativar" : "Arquivar"}
            </button>
          </section>
        ))}
      </div>
      {!s.accounts.length && (
        <Empty
          title="Separe o caixa das contas bancárias"
          text="Cadastre uma conta e vincule-a às próximas baixas. Os saldos são registros internos, sem conexão com seu banco."
        />
      )}
      <section className="card attribution">
        <h3>DRE gerencial — caixa</h3>
        <div className="management-toolbar">
          <label>
            Resultado desde
            <input
              required
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              required
              type="date"
              min={from}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <p className="management-hint">
          Considera cada baixa, inclusive parcial, pela data em que ocorreu.
          Saldos iniciais e transferências não entram no resultado. Classifique
          custos, despesas e impostos ao editar cada lançamento.
        </p>
        <div className="dre-lines">
          {[
            ["Receitas recebidas", result.revenue],
            ["− Custos diretos", result.cost],
            ["Resultado bruto", result.gross],
            ["− Despesas operacionais", result.expense],
            ["− Impostos", result.tax],
            ["Resultado do período", result.net],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{money(Number(value) / 100)}</strong>
            </div>
          ))}
        </div>
        <button
          className="secondary"
          onClick={() =>
            exportCsv("dre-gerencial.csv", [
              {
                de: from,
                ate: to,
                regime: "Caixa",
                receitas: result.revenue / 100,
                custos: result.cost / 100,
                despesas: result.expense / 100,
                impostos: result.tax / 100,
                resultado: result.net / 100,
              },
            ])
          }
        >
          Exportar DRE
        </button>
        <p className="management-hint">
          Baixas sem conta vinculada:{" "}
          {money(
            s.finance
              .filter((f) => !f.deleted_at)
              .flatMap(payments)
              .filter((p) => !p.account_id && p.date >= from && p.date <= to)
              .reduce((n, p) => n + p.amount_cents, 0) / 100,
          )}
          . Elas entram na DRE, mas não no saldo de uma conta.
        </p>
      </section>
      <section className="card attribution">
        <h3>Transferências registradas</h3>
        {alive(s.transfers).map((t) => (
          <div className="document-row" key={t.id}>
            <span>
              {s.accounts.find((a) => a.id === t.from_account)?.name} →{" "}
              {s.accounts.find((a) => a.id === t.to_account)?.name}
              <small>
                {t.date} · {t.notes}
              </small>
            </span>
            <strong>{money(t.amount_cents / 100)}</strong>
            <button
              className="text-button"
              disabled={w.busy}
              onClick={() =>
                w.write("transfers", {
                  ...t,
                  deleted_at: new Date().toISOString(),
                })
              }
            >
              Desfazer transferência
            </button>
          </div>
        ))}
      </section>
      {modal && (
        <Modal
          title={
            modal === "account"
              ? "Conta e saldo inicial"
              : "Registrar transferência"
          }
          onClose={() => setModal(null)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                let ok = false;
                if (modal === "account") {
                  const raw = String(f.get("initial")).trim();
                  const amount =
                    raw === "0" || raw === "0,00" || raw === "0.00"
                      ? 0
                      : (raw.startsWith("-") ? -1 : 1) *
                        cents(raw.replace(/^[-+]/, ""));
                  ok = await w.write("accounts", {
                    ...(editing || w.base()),
                    name: String(f.get("name")).trim(),
                    kind: f.get("kind") as Account["kind"],
                    initial_date: String(f.get("date")),
                    initial_cents: amount,
                  });
                } else {
                  if (f.get("from") === f.get("to"))
                    throw new Error("Escolha contas diferentes.");
                  ok = await w.write("transfers", {
                    ...w.base(),
                    from_account: String(f.get("from")),
                    to_account: String(f.get("to")),
                    amount_cents: cents(String(f.get("amount"))),
                    date: String(f.get("date")),
                    notes: String(f.get("notes")),
                  });
                }
                if (ok) setModal(null);
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {modal === "account" ? (
              <>
                <label>
                  Nome da conta
                  <input
                    name="name"
                    required
                    maxLength={160}
                    defaultValue={editing?.name}
                  />
                </label>
                <label>
                  Tipo de conta
                  <select name="kind" defaultValue={editing?.kind || "bank"}>
                    <option value="bank">Banco</option>
                    <option value="cash">Caixa</option>
                  </select>
                </label>
                <label>
                  Saldo inicial (R$)
                  <input
                    name="initial"
                    required
                    inputMode="decimal"
                    defaultValue={
                      editing ? String(editing.initial_cents / 100) : "0"
                    }
                  />
                </label>
                <label>
                  Data do saldo inicial
                  <input
                    name="date"
                    required
                    type="date"
                    max={today()}
                    defaultValue={editing?.initial_date || today()}
                  />
                </label>
                <p>
                  Informe o saldo no início dessa data, antes das movimentações
                  do dia. Baixas anteriores não serão somadas a essa conta.
                </p>
              </>
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Da conta
                    <select name="from" required>
                      <option value="">Escolha</option>
                      {alive(s.accounts).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Para a conta
                    <select name="to" required>
                      <option value="">Escolha</option>
                      {alive(s.accounts).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Valor transferido (R$)
                    <input name="amount" required inputMode="decimal" />
                  </label>
                  <label>
                    Data da transferência
                    <input
                      name="date"
                      required
                      type="date"
                      max={today()}
                      defaultValue={today()}
                    />
                  </label>
                </div>
                <label>
                  Observação
                  <input name="notes" />
                </label>
                <p>
                  Registra uma transferência já feita. Não movimenta dinheiro no
                  banco.
                </p>
              </>
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
                onClick={() => setModal(null)}
              >
                Cancelar
              </button>
              <button className="primary" disabled={saving || w.busy}>
                Salvar {modal === "account" ? "conta" : "transferência"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
