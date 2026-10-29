"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import { companyCash } from "@/lib/company-cash";
import { ProfitSharing } from "./profit-sharing";
import { PaymentModal } from "./payment-modal";
import type { Account, FinanceEntry } from "@/lib/types";
import { accountBalance, dre, dreLines, payments } from "@/lib/payments";
import { categoryGroup, dreLabels } from "@/lib/finance-categories";
import { cents, today } from "@/lib/finance";
import { addDays } from "@/lib/journey";
import { money, alive } from "@/lib/domain";
import { exportCsv } from "@/lib/files";
import { SectionTitle, Modal, Empty } from "./ui";
import {
  companyKey,
  participantId,
  participantKey,
  sharedBalances,
  expensePaymentDetails,
} from "@/lib/shared-expenses";
import { useTeamMembers } from "@/lib/use-team-members";
export function Cash({ w }: { w: ReturnType<typeof useWorkspace> }) {
  const s = w.state!;
  const [modal, setModal] = useState<
    "account" | "transfer" | "settlement" | null
  >(null);
  const members = useTeamMembers(s.tenant.id);
  const details = expensePaymentDetails(s.finance);
  const unidentified = details.filter((d) => d.missingPayer || d.missingOwner);
  const unidentifiedExpenses = new Set(unidentified.map((d) => d.entry.id))
    .size;
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<FinanceEntry | null>(
    null,
  );
  const historicalIds = new Set(
    [
      ...details.flatMap((d) => [
        d.payment.payer_user_id,
        ...(d.payment.allocations || []).map((a) => a.user_id),
      ]),
      ...alive(s.settlements).flatMap((item) => [
        item.from_user_id,
        item.to_user_id,
      ]),
    ].filter((id): id is string => !!id),
  );
  const people = [
    { key: companyKey, label: "Empresa" },
    ...members.map((m) => ({ key: m.user_id, label: m.email })),
    ...[...historicalIds]
      .filter((id) => !members.some((m) => m.user_id === id))
      .map((id) => ({
        key: id,
        label: `Membro indisponível (${id.slice(-6)})`,
      })),
  ];
  const personLabel = (id: string | null) =>
    people.find((p) => p.key === participantKey(id))?.label ||
    "Membro removido";
  const balances = sharedBalances(s);
  const cash = companyCash(s, today());
  const [editing, setEditing] = useState<Account>();
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const result = dre(s, from, to);
  const paidBy = details.filter(
    (d) =>
      !d.missingPayer &&
      participantKey(d.payment.payer_user_id!) === selectedPerson,
  );
  const ownedBy = details.filter((d) =>
    d.payment.allocations?.some(
      (a) => participantKey(a.user_id) === selectedPerson,
    ),
  );
  const personSettlements = alive(s.settlements).filter(
    (item) =>
      participantKey(item.from_user_id) === selectedPerson ||
      participantKey(item.to_user_id) === selectedPerson,
  );
  const renderPayments = (items: typeof details) =>
    items.map(({ entry, payment, missingPayer, missingOwner }) => (
      <article
        className="attribution-payment"
        key={`${entry.id}:${payment.id}`}
      >
        <div className="payment-detail-heading">
          <div>
            <strong>{entry.title}</strong>
            <small>
              Baixa em {payment.date.split("-").reverse().join("/")}
            </small>
          </div>
          <b>{money(payment.amount_cents / 100)}</b>
        </div>
        <div className="payment-detail-meta">
          <p>
            Quem pagou:{" "}
            {missingPayer
              ? "Não identificado"
              : personLabel(payment.payer_user_id ?? null)}
          </p>
          <p>
            De quem é a despesa:{" "}
            {missingOwner
              ? "Não identificado"
              : payment
                  .allocations!.map(
                    (a) =>
                      `${personLabel(a.user_id)} (${money(a.amount_cents / 100)})`,
                  )
                  .join("; ")}
          </p>
          <p>
            Conta da baixa:{" "}
            {s.accounts.find((a) => a.id === payment.account_id)?.name ||
              "Sem conta vinculada"}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setSelectedPayment(entry)}
        >
          {s.role === "owner" ? "Identificar / corrigir baixa" : "Ver baixa"}
        </button>
      </article>
    ));

  return (
    <>
      <SectionTitle
        title="Caixa e resultado"
        subtitle="Contas, transferências registradas e DRE gerencial pelo regime de caixa."
        action={
          <div className="management-actions">
            <button
              className="secondary"
              disabled={s.role !== "owner"}
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
            <p>Titular: {personLabel(a.holder_user_id ?? null)}</p>
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
              disabled={w.busy || w.state!.role === "manager"}
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
          Considera cada baixa, inclusive parcial, pela data em que ocorreu. As
          categorias definem a classificação automaticamente. Saldos iniciais,
          transferências e movimentos patrimoniais não entram no resultado. Este
          relatório por caixa não apura ajustes contábeis sem baixa, como
          depreciação e provisões.
        </p>
        <div className="dre-lines">
          {dreLines(result).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{money(Number(value) / 100)}</strong>
            </div>
          ))}
        </div>
        <button
          className="secondary"
          onClick={() =>
            exportCsv(
              "dre-gerencial.csv",
              dreLines(result).map(([linha, valor]) => ({
                de: from,
                ate: to,
                regime: "Caixa",
                linha,
                valor: (valor / 100).toFixed(2),
              })),
            )
          }
        >
          Exportar DRE
        </button>
        <details style={{ marginTop: 16 }}>
          <summary>Detalhar por categoria</summary>
          {result.categories
            .filter((c) => c.group !== "non_dre")
            .map((c) => (
              <div
                className="setting-line"
                key={`${c.group}-${c.direction}-${c.category}`}
              >
                <span>
                  {c.category}
                  <small style={{ display: "block" }}>
                    {dreLabels[c.group]}
                  </small>
                </span>
                <strong>{money(c.amount / 100)}</strong>
              </div>
            ))}
          {!result.categories.some((c) => c.group !== "non_dre") && (
            <p>Sem baixas classificadas no período.</p>
          )}
        </details>
        <details style={{ marginTop: 16 }}>
          <summary>Movimentos fora da DRE</summary>
          <p>
            Entradas: {money(result.excludedIncome / 100)} · Saídas:{" "}
            {money(result.excludedExpense / 100)}
          </p>
          {result.categories
            .filter((c) => c.group === "non_dre")
            .map((c) => (
              <p key={`${c.direction}-${c.category}`}>
                {c.category} · {c.direction === "income" ? "Entrada" : "Saída"}:{" "}
                {money(c.amount / 100)}
              </p>
            ))}
        </details>
        {s.finance.some(
          (f) => !f.deleted_at && !categoryGroup(f.direction, f.category),
        ) && (
          <p className="management-hint">
            Existem categorias anteriores ou personalizadas. A classificação
            salva foi preservada. Revise lançamentos genéricos, como “Impostos”,
            para detalhar a DRE.
          </p>
        )}
        <p className="management-hint">
          Baixas sem conta vinculada:{" "}
          {money(
            s.finance
              .filter((f) => !f.deleted_at)
              .flatMap(payments)
              .filter((p) => !p.account_id && p.date >= from && p.date <= to)
              .reduce((n, p) => n + p.amount_cents, 0) / 100,
          )}
          . Essas baixas não compõem o saldo de uma conta. Sua participação na
          DRE depende da categoria.
        </p>
      </section>
      <section className="card attribution team-settlements">
        <SectionTitle
          title="Acertos da equipe"
          subtitle="Acompanhe o lucro, confira os reembolsos e mantenha as contas da equipe em dia."
          action={
            <button
              className="primary"
              disabled={s.role !== "owner"}
              onClick={() => setModal("settlement")}
            >
              Registrar acerto
            </button>
          }
        />
        <section className="company-cash-summary" aria-label="Caixa da empresa">
          <div className="reimbursement-heading">
            <span className="finance-eyebrow">DINHEIRO DA EMPRESA</span>
            <h3>Entradas, saídas e caixa</h3>
          </div>
          <p className="management-hint">
            Acumulado até {today().split("-").reverse().join("/")}, independente
            do mês do lucro e do filtro da DRE.
          </p>
          <div className="company-cash-grid">
            <article className="card">
              <span>Total que entrou</span>
              <strong>{money(cash.incoming / 100)}</strong>
              <small>Recebimentos e outras entradas da empresa</small>
            </article>
            <article className="card">
              <span>Total que saiu</span>
              <strong>{money(cash.outgoing / 100)}</strong>
              <small>Pagamentos da empresa, acertos e outras saídas</small>
              <small>Acertos pagos: {money(cash.reimbursements / 100)}</small>
            </article>
            <article className="card company-cash-balance">
              <span>
                {cash.unidentified
                  ? "Saldo em caixa a conferir"
                  : "Saldo em caixa registrado"}
              </span>
              <strong>{money(cash.balance / 100)}</strong>
              <small>Saldo inicial + entradas − saídas</small>
              <small>Saldo inicial: {money(cash.opening / 100)}</small>
            </article>
          </div>
          <p className="management-hint">
            Inclui os saldos iniciais das contas da empresa e seus movimentos a
            partir dessas datas. Movimentos sem conta vinculada usam todo o
            histórico. Contas pessoais não compõem o caixa. Despesas pagas pela
            equipe só reduzem o caixa quando a empresa registra o reembolso.
            Transferências entre contas da empresa não são novas entradas ou
            saídas.
          </p>
          {!!cash.unidentified && (
            <p className="company-cash-warning" role="status">
              Há {money(cash.unidentified / 100)} em pagamentos sem pagador
              identificado, ainda não descontados deste saldo. Identifique quem
              pagou para conferir o caixa.
            </p>
          )}
        </section>
        <ProfitSharing w={w} members={members} />
        <div className="reimbursement-heading">
          <span className="finance-eyebrow">SALDOS DA EQUIPE</span>
          <h3>Reembolsos e acertos</h3>
        </div>
        <p className="management-hint">
          Acertos acumulados de todo o histórico. Despesas sem identificação
          completa não entram no saldo dos cards até serem identificadas.
        </p>
        <div
          className={`attribution-identification ${unidentified.length ? "needs-attention" : "all-identified"}`}
          role="status"
        >
          {unidentified.length ? (
            <>
              <p>
                <strong>
                  {unidentifiedExpenses}{" "}
                  {unidentifiedExpenses === 1 ? "despesa" : "despesas"} com{" "}
                  {unidentified.length}{" "}
                  {unidentified.length === 1 ? "baixa" : "baixas"} sem
                  identificação completa
                </strong>{" "}
                ·{" "}
                {money(
                  unidentified.reduce(
                    (sum, d) => sum + d.payment.amount_cents,
                    0,
                  ) / 100,
                )}
              </p>
              <p>Falta informar quem pagou ou de quem é a despesa.</p>
              <button
                type="button"
                className="secondary"
                onClick={() => setSelectedPerson("unidentified")}
              >
                Ver pagamentos sem identificação
              </button>
            </>
          ) : (
            <p>Todas as despesas pagas estão identificadas.</p>
          )}
        </div>
        <div className="customer-grid">
          {people.map((person) => {
            const balance = balances.get(person.key) || 0;
            return (
              <button
                type="button"
                className={`card customer-card settlement-card ${balance > 0 ? "receivable" : balance < 0 ? "payable" : "settled"}`}
                key={person.key}
                aria-label={`Ver acertos de ${person.label}`}
                onClick={() => setSelectedPerson(person.key)}
              >
                <span className="settlement-avatar" aria-hidden="true">
                  {person.key === companyKey
                    ? "E"
                    : person.label.slice(0, 2).toUpperCase()}
                </span>
                <strong className="settlement-name">{person.label}</strong>
                <p>
                  {balance > 0
                    ? "Tem a receber"
                    : balance < 0
                      ? "Tem a pagar"
                      : "Está acertado"}
                </p>
                <strong className="settlement-amount">
                  {money(Math.abs(balance) / 100)}
                </strong>
                <small>
                  Ver despesas e acertos <span aria-hidden="true">↗</span>
                </small>
              </button>
            );
          })}
        </div>
        {alive(s.settlements).map((x) => (
          <div className="document-row" key={x.id}>
            <span>
              {personLabel(x.from_user_id)} → {personLabel(x.to_user_id)}
              <small>
                {x.date.split("-").reverse().join("/")} ·{" "}
                {x.notes || "Acerto registrado"}
              </small>
            </span>
            <strong>{money(x.amount_cents / 100)}</strong>
            <button
              className="text-button"
              disabled={w.busy || w.state!.role === "manager"}
              onClick={() =>
                w.write("settlements", {
                  ...x,
                  deleted_at: new Date().toISOString(),
                })
              }
            >
              Desfazer
            </button>
          </div>
        ))}
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
              disabled={w.busy || w.state!.role === "manager"}
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
              : modal === "transfer"
                ? "Registrar transferência"
                : "Registrar acerto"
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
                    holder_user_id: participantId(
                      String(f.get("holder") || companyKey),
                    ),
                  });
                } else if (modal === "transfer") {
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
                } else {
                  if (f.get("from_person") === f.get("to_person"))
                    throw new Error("Escolha pessoas diferentes.");
                  ok = await w.write("settlements", {
                    ...w.base(),
                    from_user_id: participantId(String(f.get("from_person"))),
                    to_user_id: participantId(String(f.get("to_person"))),
                    amount_cents: cents(String(f.get("amount"))),
                    date: String(f.get("date")),
                    from_account_id:
                      String(f.get("from_account") || "") || null,
                    to_account_id: String(f.get("to_account") || "") || null,
                    notes: String(f.get("notes") || ""),
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
                  Titular da conta
                  <select
                    name="holder"
                    defaultValue={participantKey(
                      editing?.holder_user_id ?? null,
                    )}
                  >
                    {people.map((person) => (
                      <option key={person.key} value={person.key}>
                        {person.label}
                      </option>
                    ))}
                  </select>
                </label>
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
            ) : modal === "transfer" ? (
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
            ) : (
              <>
                <div className="form-grid">
                  <label>
                    Quem pagou
                    <select name="from_person" required>
                      <option value="">Escolha</option>
                      {people.map((person) => (
                        <option key={person.key} value={person.key}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quem recebeu
                    <select name="to_person" required>
                      <option value="">Escolha</option>
                      {people.map((person) => (
                        <option key={person.key} value={person.key}>
                          {person.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Valor (R$)
                    <input name="amount" required inputMode="decimal" />
                  </label>
                  <label>
                    Data
                    <input
                      name="date"
                      required
                      type="date"
                      max={today()}
                      defaultValue={today()}
                    />
                  </label>
                  <label>
                    Conta de saída (opcional)
                    <select name="from_account">
                      <option value="">Sem conta</option>
                      {alive(s.accounts).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Conta de entrada (opcional)
                    <select name="to_account">
                      <option value="">Sem conta</option>
                      {alive(s.accounts).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Observação
                  <input name="notes" maxLength={500} />
                </label>
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
                Salvar{" "}
                {modal === "account"
                  ? "conta"
                  : modal === "transfer"
                    ? "transferência"
                    : "acerto"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {selectedPerson !== null && !selectedPayment && (
        <Modal
          title={
            selectedPerson === "unidentified"
              ? "Pagamentos sem identificação"
              : `Acertos de ${people.find((p) => p.key === selectedPerson)?.label || "membro"}`
          }
          onClose={() => setSelectedPerson(null)}
          wide
        >
          <div className="settlement-details">
            {selectedPerson === "unidentified" ? (
              <>
                {renderPayments(unidentified)}
                {!unidentified.length && (
                  <p>Todos os pagamentos já foram identificados.</p>
                )}
              </>
            ) : (
              <>
                <p className="settlement-detail-balance">
                  Saldo atual:{" "}
                  {money(Math.abs(balances.get(selectedPerson) || 0) / 100)} ·{" "}
                  {(balances.get(selectedPerson) || 0) > 0
                    ? "A receber"
                    : (balances.get(selectedPerson) || 0) < 0
                      ? "A pagar"
                      : "Acertado"}
                </p>
                <h3>
                  Despesas pagas por{" "}
                  {people.find((p) => p.key === selectedPerson)?.label}
                </h3>
                {renderPayments(paidBy)}
                {!paidBy.length && (
                  <p>Nenhuma despesa paga por este participante.</p>
                )}
                <h3>Despesas de responsabilidade deste participante</h3>
                {renderPayments(ownedBy)}
                {!ownedBy.length && (
                  <p>Nenhuma despesa atribuída a este participante.</p>
                )}
                <h3>Acertos registrados</h3>
                {personSettlements.map((item) => (
                  <p key={item.id}>
                    {item.date.split("-").reverse().join("/")} ·{" "}
                    {personLabel(item.from_user_id)} →{" "}
                    {personLabel(item.to_user_id)} ·{" "}
                    {money(item.amount_cents / 100)}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                ))}
                {!personSettlements.length && <p>Nenhum acerto registrado.</p>}
              </>
            )}
          </div>
        </Modal>
      )}
      {selectedPayment && (
        <PaymentModal
          w={w}
          entry={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </>
  );
}
