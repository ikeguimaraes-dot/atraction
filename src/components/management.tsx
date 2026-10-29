"use client";
import { uuid } from "@/lib/demo";
import { alive, money } from "@/lib/domain";
import { exportCsv } from "@/lib/files";
import {
  balance,
  cents,
  entryStatus,
  financeReferenceDate,
  today,
} from "@/lib/finance";
import {
  categoryGroup,
  dreLabels,
  effectiveDreGroup,
} from "@/lib/finance-categories";
import { installmentPlan } from "@/lib/installments";
import { recordPayment } from "@/lib/operations";
import { inPeriod, paid, payments, remaining } from "@/lib/payments";
import { createRecurrence } from "@/lib/recurrences";
import type { Contact, FinanceEntry, Supplier } from "@/lib/types";
import type { useWorkspace } from "@/lib/use-workspace";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Pencil,
  Plus,
  Trash2,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { FinanceCategory } from "./finance-category";
import { ContactForm } from "./forms";
import { PaymentModal } from "./payment-modal";
import { Recurrences } from "./recurrences";
import { Avatar, Empty, Modal, SectionTitle } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
const dateLabel = (date: string) => date.split("-").reverse().join("/");
export function FinancialSummary({
  rows,
  from = "",
  to = "",
  explainDates = false,
}: {
  rows: FinanceEntry[];
  from?: string;
  to?: string;
  explainDates?: boolean;
}) {
  const b = balance(rows, from, to);
  if (explainDates)
    return (
      <>
        <section
          className="finance-basis-section"
          aria-label="Movimentações pela data da baixa"
        >
          <h3>Recebimentos e pagamentos</h3>
          <p className="management-hint">
            Pela data da baixa no período selecionado. Inclui recebimentos
            antecipados ou atrasados de receitas com vencimento fora do período.
          </p>
          <div className="finance-summary monthly-totals">
            <div className="card income">
              <small>Recebimentos pela data da baixa</small>
              <strong>{money(b.received / 100)}</strong>
              <small>Valores registrados como recebidos</small>
            </div>
            <div className="card expense">
              <small>Pagamentos pela data da baixa</small>
              <strong>{money(b.paid / 100)}</strong>
              <small>Valores registrados como pagos</small>
            </div>
            <div className="card">
              <small>Resultado das baixas</small>
              <strong>{money(b.net / 100)}</strong>
              <small>
                Recebimentos menos pagamentos; não é o lucro nem o saldo
                bancário
              </small>
            </div>
          </div>
        </section>
        <section
          className="finance-basis-section"
          aria-label="Pendências por vencimento"
        >
          <h3>Valores em aberto</h3>
          <p className="management-hint">
            Saldo ainda não baixado dos lançamentos com vencimento no período
            selecionado.
          </p>
          <div className="finance-summary finance-pending">
            <div className="card">
              <small>A receber por vencimento</small>
              <strong>{money(b.receivable / 100)}</strong>
            </div>
            <div className="card">
              <small>A pagar por vencimento</small>
              <strong>{money(b.payable / 100)}</strong>
            </div>
          </div>
        </section>
      </>
    );
  return (
    <div className="finance-summary">
      {[
        ["Recebido", b.received, "income"],
        ["Pago", b.paid, "expense"],
        ["Saldo dos lançamentos", b.net, ""],
        ["A receber", b.receivable, ""],
        ["A pagar", b.payable, ""],
      ].map(([title, value, color]) => (
        <div className={`card ${color}`} key={title}>
          <small>{title}</small>
          <strong>{money(Number(value) / 100)}</strong>
        </div>
      ))}
    </div>
  );
}
export function Clients({
  w,
  onDetail,
}: {
  w: Work;
  onDetail: (c: Contact) => void;
}) {
  const s = w.state!;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("customer");
  const [creating, setCreating] = useState(false);
  const contacts = alive(s.contacts).filter((c) =>
    ["customer", "inactive", "prospect"].includes(c.lifecycle || "prospect"),
  );
  const filtered = contacts.filter(
    (c) =>
      (!status || (c.lifecycle || "prospect") === status) &&
      `${c.name} ${c.phone} ${c.document || ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const manage = ["owner", "manager"].includes(s.role);
  return (
    <>
      <SectionTitle
        title="Clientes, de perto"
        subtitle="Quem já confia no seu negócio, com relacionamento e financeiro no mesmo lugar."
        action={
          <button
            className="primary"
            disabled={s.role === "viewer"}
            onClick={() => setCreating(true)}
          >
            <Plus size={18} /> Novo cliente
          </button>
        }
      />
      <div className="management-toolbar">
        <label>
          Buscar cliente
          <input
            id="client-search"
            placeholder="Nome, telefone ou documento"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="customer">Ativos</option>
            <option value="inactive">Inativos</option>
            <option value="">Todos os cadastros</option>
            <option value="prospect">Cadastros anteriores</option>
          </select>
        </label>
      </div>
      <p className="management-hint">
        Cadastre clientes manualmente e acompanhe contratos, atendimentos e
        finanças pela ficha de cada cliente.
      </p>
      <div className="customer-grid">
        {filtered.map((c) => {
          const b = balance(s.finance.filter((f) => f.contact_id === c.id));
          return (
            <button
              className="card customer-card"
              key={c.id}
              onClick={() => onDetail(c)}
            >
              <div className="customer-heading">
                <Avatar name={c.name} />
                <div>
                  <h3>{c.name}</h3>
                  <small>
                    {c.lifecycle === "inactive"
                      ? "Cliente inativo"
                      : "Cliente ativo"}
                    {c.customer_since
                      ? ` · desde ${dateLabel(c.customer_since)}`
                      : ""}
                  </small>
                </div>
                <ArrowUpRight size={18} />
              </div>
              <p>{c.phone}</p>
              {manage && (
                <div className="customer-amounts">
                  <span>
                    Recebido<strong>{money(b.received / 100)}</strong>
                  </span>
                  <span>
                    A receber<strong>{money(b.receivable / 100)}</strong>
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="Seu próximo capítulo começa aqui"
          text="Cadastre quem já é cliente ou atualize o relacionamento de uma pessoa existente."
          action={<Users size={24} />}
        />
      )}
      {creating && (
        <ContactForm
          tenant={s.tenant}
          customer
          base={w.base}
          onSave={(r) => w.write("contacts", r)}
          onClose={() => setCreating(false)}
        />
      )}
    </>
  );
}
export function Suppliers({ w }: { w: Work }) {
  const s = w.state!;
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  const rows = alive(s.suppliers).filter((r) =>
    `${r.name} ${r.document} ${r.category}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title="Parceiros do seu negócio"
        subtitle="Fornecedores organizados e suas contas sempre por perto."
        action={
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus size={18} /> Novo fornecedor
          </button>
        }
      />
      <div className="management-toolbar">
        <label>
          Buscar fornecedor
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, documento ou categoria"
          />
        </label>
      </div>
      <div className="customer-grid">
        {rows.map((r) => {
          const b = balance(s.finance.filter((f) => f.supplier_id === r.id));
          return (
            <section className="card supplier-card" key={r.id}>
              <div className="customer-heading">
                <Truck size={24} />
                <div>
                  <h3>{r.name}</h3>
                  <small>
                    {r.category} · {r.document || "Sem documento"}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Editar ${r.name}`}
                  onClick={() => setEditing(r)}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <p>{r.email || r.phone || "Sem contato informado"}</p>
              <div className="customer-amounts">
                <span>
                  Pago<strong>{money(b.paid / 100)}</strong>
                </span>
                <span>
                  A pagar<strong>{money(b.payable / 100)}</strong>
                </span>
              </div>
              <button
                className="text-button"
                disabled={w.busy || w.state!.role === "manager"}
                onClick={() =>
                  w.write("suppliers", {
                    ...r,
                    deleted_at: new Date().toISOString(),
                  })
                }
              >
                Arquivar fornecedor
              </button>
            </section>
          );
        })}
      </div>
      {!rows.length && (
        <Empty
          title="Quem ajuda seu negócio a acontecer?"
          text="Cadastre fornecedores de materiais, serviços, aluguel e outros custos."
        />
      )}
      {editing && (
        <SupplierForm
          w={w}
          value={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function SupplierForm({
  w,
  value,
  onClose,
}: {
  w: Work;
  value?: Supplier;
  onClose: () => void;
}) {
  const [data, setData] = useState<Supplier>(
    value || {
      ...w.base(),
      name: "",
      document: "",
      phone: "",
      email: "",
      category: "Serviços",
      address: "",
      notes: "",
    },
  );
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title={value ? "Editar fornecedor" : "Cadastrar fornecedor"}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            if (await w.write("suppliers", { ...data, name: data.name.trim() }))
              onClose();
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="form-grid">
          {(
            [
              ["name", "Nome do fornecedor"],
              ["document", "CPF / CNPJ"],
              ["email", "E-mail"],
              ["phone", "Telefone"],
              ["category", "Categoria"],
              ["address", "Endereço"],
            ] as const
          ).map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                autoFocus={field === "name"}
                required={field === "name" || field === "category"}
                maxLength={
                  field === "document" ? 30 : field === "name" ? 160 : 500
                }
                type={field === "email" ? "email" : "text"}
                value={data[field]}
                onChange={(e) => setData({ ...data, [field]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label>
          Anotações
          <textarea
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
          />
        </label>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || w.busy}>
            Salvar fornecedor
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function Finance({
  w,
  initialContact = "",
}: {
  w: Work;
  initialContact?: string;
}) {
  const s = w.state!;
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [status, setStatus] = useState("");
  const [contact, setContact] = useState(initialContact);
  const [supplier, setSupplier] = useState("");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [dateMode, setDateMode] = useState<"month" | "period" | "all">("month");
  const [periodFrom, setPeriodFrom] = useState(
    () => `${today().slice(0, 7)}-01`,
  );
  const [periodTo, setPeriodTo] = useState(today);
  const from =
    dateMode === "period"
      ? periodFrom
      : dateMode === "month" && month
        ? `${month}-01`
        : "";
  const to =
    dateMode === "period"
      ? periodTo
      : dateMode === "month" && month
        ? `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`
        : "";
  const validPeriod = !from || !to || from <= to;
  const periodLabel =
    dateMode === "period"
      ? "do período"
      : dateMode === "month" && month
        ? "do mês"
        : "total";
  const monthlyRows = alive(s.finance).filter(
    (r) =>
      validPeriod && inPeriod(financeReferenceDate(r, s.documents), from, to),
  );
  const revenue = monthlyRows
    .filter((r) => r.direction === "income")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const expense = monthlyRows
    .filter((r) => r.direction === "expense")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const profit = revenue - expense;
  const [editing, setEditing] = useState<
    FinanceEntry | "income" | "expense" | null
  >(null);
  const [settling, setSettling] = useState<FinanceEntry | null>(null);
  const [settleDate, setSettleDate] = useState(today());
  const rows = alive(s.finance)
    .filter(
      (r) =>
        validPeriod &&
        r.direction === direction &&
        (direction !== "income" || !contact || r.contact_id === contact) &&
        (direction !== "expense" || !supplier || r.supplier_id === supplier) &&
        inPeriod(financeReferenceDate(r, s.documents), from, to) &&
        (!status ||
          (status === "open"
            ? !r.settled_date
            : status === "settled"
              ? !!r.settled_date
              : !r.settled_date && r.due_date < today())) &&
        `${r.title} ${r.category}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const party = (r: FinanceEntry) =>
    r.contact_id
      ? s.contacts.find((c) => c.id === r.contact_id)?.name || "Cliente"
      : r.supplier_id
        ? s.suppliers.find((c) => c.id === r.supplier_id)?.name || "Fornecedor"
        : "Sem vínculo";
  return (
    <>
      <SectionTitle
        title="Seu financeiro, com clareza"
        subtitle="Receitas, custos e despesas. Acompanhe o previsto e registre o que já aconteceu."
        action={
          <div className="management-actions">
            <button
              className="secondary"
              onClick={() => {
                setDirection("expense");
                setEditing("expense");
              }}
            >
              <ArrowDownLeft size={17} /> Nova despesa
            </button>
            <button
              className="primary"
              onClick={() => {
                setDirection("income");
                setEditing("income");
              }}
            >
              <Plus size={17} /> Nova receita
            </button>
          </div>
        }
      />
      <div className="management-toolbar">
        <label>
          Filtro de datas
          <select
            value={dateMode}
            onChange={(event) =>
              setDateMode(event.target.value as typeof dateMode)
            }
          >
            <option value="month">Por mês</option>
            <option value="period">Por período</option>
            <option value="all">Todos os meses</option>
          </select>
        </label>
        {dateMode === "month" && (
          <label>
            Mês de referência
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        )}
        {dateMode === "period" && (
          <>
            <label>
              Data inicial
              <input
                type="date"
                value={periodFrom}
                max={periodTo || undefined}
                onChange={(event) => setPeriodFrom(event.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                type="date"
                value={periodTo}
                min={periodFrom || undefined}
                onChange={(event) => setPeriodTo(event.target.value)}
              />
            </label>
          </>
        )}
        <button
          className="secondary"
          onClick={() => {
            setMonth(today().slice(0, 7));
            setDateMode("month");
          }}
        >
          Mês atual
        </button>
        <button
          className="text-button"
          onClick={() => {
            setMonth("");
            setDateMode("all");
          }}
        >
          Todos os meses
        </button>
        {dateMode === "all" && <span>Exibindo todos os meses</span>}
      </div>
      {!validPeriod && (
        <p className="error" role="alert">
          A data final deve ser igual ou posterior à data inicial.
        </p>
      )}
      <div className="finance-basis-heading">
        <h3>Receitas, despesas e lucro {periodLabel}</h3>
        <p className="management-hint">
          Valores integrais dos lançamentos, recebidos/pagos ou ainda em aberto.
        </p>
      </div>
      <div
        className="finance-summary monthly-totals"
        aria-label="Receita, despesa e lucro"
      >
        <div className="card income" aria-label="Receita cadastrada">
          <small>Receitas por vencimento</small>
          <strong>{money(revenue / 100)}</strong>
          <small>Vencimento dentro do período selecionado</small>
        </div>
        <div className="card expense" aria-label="Despesa cadastrada">
          <small>Despesas por emissão ou vencimento</small>
          <strong>{money(expense / 100)}</strong>
          <small>Conforme a data de referência de cada despesa</small>
        </div>
        <div
          className={`card ${profit < 0 ? "expense" : "income"}`}
          aria-label="Lucro calculado"
        >
          <small>Lucro {periodLabel}</small>
          <strong>{money(profit / 100)}</strong>
          <small>
            {profit < 0
              ? "Prejuízo: despesas maiores que receitas"
              : "Receitas menos despesas"}
          </small>
        </div>
      </div>
      <p className="management-hint">
        Despesas à vista com nota ou recibo entram no mês de emissão. Compras
        parceladas e os demais lançamentos entram pelo vencimento de cada
        parcela. Os totais incluem o valor integral, inclusive dos lançamentos
        já baixados.
      </p>
      <FinancialSummary
        rows={validPeriod ? s.finance : []}
        from={from}
        to={to}
        explainDates
      />
      <div
        className="management-actions hub-tabs"
        role="tablist"
        aria-label="Tipo de lançamento"
      >
        {(["income", "expense"] as const).map((tab) => (
          <button
            key={tab}
            id={`finance-tab-${tab}`}
            role="tab"
            aria-selected={direction === tab}
            aria-controls="finance-panel"
            tabIndex={direction === tab ? 0 : -1}
            className={direction === tab ? "primary" : "secondary"}
            onClick={() => setDirection(tab)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? "income"
                  : e.key === "End"
                    ? "expense"
                    : tab === "income"
                      ? "expense"
                      : "income";
              setDirection(next);
              document.getElementById(`finance-tab-${next}`)?.focus();
            }}
          >
            {tab === "income" ? "Receitas" : "Despesas"}
          </button>
        ))}
      </div>
      <div
        id="finance-panel"
        role="tabpanel"
        aria-labelledby={`finance-tab-${direction}`}
      >
        <Recurrences w={w} direction={direction} />
        <div className="management-toolbar finance-filters">
          <label>
            Buscar lançamento
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descrição ou categoria"
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="open">Em aberto</option>
              <option value="overdue">Atrasados</option>
              <option value="settled">
                {direction === "income" ? "Recebidos" : "Pagos"}
              </option>
            </select>
          </label>
          {direction === "income" && (
            <label>
              Cliente
              <select
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              >
                <option value="">Todos</option>
                {s.contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.deleted_at ? " (arquivado)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {direction === "expense" && (
            <label>
              Fornecedor
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option value="">Todos</option>
                {s.suppliers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.deleted_at ? " (arquivado)" : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setStatus("");
              setContact("");
              setSupplier("");
            }}
          >
            Limpar filtros
          </button>
        </div>
        <button
          className="secondary"
          disabled={!validPeriod}
          onClick={() =>
            exportCsv(
              direction === "income" ? "receitas.csv" : "despesas.csv",
              rows.map((r) => ({
                descricao: r.title,
                tipo: r.direction === "income" ? "Receita" : "Despesa",
                categoria: r.category,
                grupo_dre: dreLabels[effectiveDreGroup(r)],
                vencimento: r.due_date,
                valor: (r.amount_cents / 100).toFixed(2),
                baixado: (paid(r) / 100).toFixed(2),
                restante: (remaining(r) / 100).toFixed(2),
                pessoa: party(r),
                status: entryStatus(r),
              })),
            )
          }
        >
          Exportar financeiro (CSV)
        </button>
        <p className="management-hint">
          A lista e a exportação seguem as datas selecionadas, a aba e os
          filtros. Os cards independem da busca e da aba. Recebido e Pago usam a
          data da baixa; A receber e A pagar usam o vencimento.
        </p>
        <section className="card ledger" aria-label="Lançamentos financeiros">
          {rows.map((r) => (
            <article className="ledger-row" key={r.id}>
              <span className={`ledger-icon ${r.direction}`}>
                {r.direction === "income" ? (
                  <ArrowUpRight size={20} />
                ) : (
                  <ArrowDownLeft size={20} />
                )}
              </span>
              <div className="ledger-description">
                <strong>{r.title}</strong>
                {r.recurrence_id && <small>Recorrência mensal</small>}
                <small>
                  {r.category} · {party(r)}
                </small>
                {r.quantity && r.unit_amount_cents && (
                  <small>
                    {Number(r.quantity).toLocaleString("pt-BR", {
                      maximumFractionDigits: 3,
                    })}{" "}
                    × {money(r.unit_amount_cents / 100)}
                  </small>
                )}
                <small>
                  Baixado: {money(paid(r) / 100)} · Restante:{" "}
                  {money(remaining(r) / 100)}
                </small>
                <small>
                  Vence {dateLabel(r.due_date)}
                  {r.settled_date
                    ? ` · Baixa ${dateLabel(r.settled_date)}`
                    : ""}
                </small>
              </div>
              <div className={`ledger-value ${r.direction}`}>
                <strong>
                  {r.direction === "expense" ? "− " : ""}
                  {money(r.amount_cents / 100)}
                </strong>
                <span
                  className={
                    !r.settled_date && r.due_date < today() ? "overdue" : ""
                  }
                >
                  {entryStatus(r)}
                </span>
              </div>
              <div className="ledger-actions">
                {payments(r).length > 0 && (
                  <button
                    className="text-button"
                    onClick={() => setSettling(r)}
                  >
                    Ver baixas
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={w.busy || s.role !== "owner"}
                  onClick={() => {
                    if (r.settled_date)
                      void recordPayment(
                        w,
                        r,
                        {
                          id: uuid(),
                          date: today(),
                          amount_cents: 0,
                          account_id: null,
                        },
                        "00000000-0000-0000-0000-000000000000",
                      );
                    else {
                      setSettleDate(today());
                      setSettling(r);
                    }
                  }}
                >
                  {r.settled_date
                    ? "Reabrir"
                    : r.direction === "income"
                      ? "Receber"
                      : "Pagar"}
                </button>
                <button
                  className="icon-button"
                  aria-label={`Editar ${r.title}`}
                  onClick={() => setEditing(r)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Excluir ${r.title}`}
                  disabled={w.busy || w.state!.role === "manager"}
                  onClick={() =>
                    w.write("finance", {
                      ...r,
                      deleted_at: new Date().toISOString(),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <Empty
              title={
                direction === "income"
                  ? "Nenhuma receita encontrada"
                  : "Nenhuma despesa encontrada"
              }
              text="Revise os filtros ou cadastre um lançamento nesta aba."
              action={<Wallet size={24} />}
            />
          )}
        </section>
      </div>
      {editing && (
        <EntryForm
          w={w}
          value={typeof editing === "object" ? editing : undefined}
          direction={typeof editing === "string" ? editing : editing.direction}
          contact={contact}
          onClose={() => setEditing(null)}
          onPayments={
            typeof editing === "object"
              ? () => {
                  setSettling(editing);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
      {settling && (
        <PaymentModal
          w={w}
          entry={settling}
          onClose={() => setSettling(null)}
        />
      )}
    </>
  );
}
export function EntryForm({
  w,
  value,
  direction,
  contact,
  onClose,
  onPayments,
}: {
  w: Work;
  value?: FinanceEntry;
  direction: "income" | "expense";
  contact: string;
  onClose: () => void;
  onPayments?: () => void;
}) {
  const s = w.state!;
  const [data, setData] = useState<FinanceEntry>(
    value || {
      ...w.base(),
      title: "",
      direction,
      amount_cents: 0,
      category: "",
      dre_group: direction === "income" ? "revenue" : "expense",
      due_date: today(),
      settled_date: null,
      contact_id: direction === "income" ? contact || null : null,
      supplier_id: null,
      notes: "",
    },
  );
  const [amount, setAmount] = useState(
    value ? (value.amount_cents / 100).toFixed(2) : "",
  );
  const [itemPricing, setItemPricing] = useState(
    direction === "income" && !!value?.quantity && !!value?.unit_amount_cents,
  );
  const [quantity, setQuantity] = useState(
    value?.quantity ? String(value.quantity) : "1",
  );
  const [unitAmount, setUnitAmount] = useState(
    value?.unit_amount_cents ? (value.unit_amount_cents / 100).toFixed(2) : "",
  );
  const calculateItemTotal = (nextQuantity: string, nextUnit: string) => {
    const parsedQuantity = Number(nextQuantity.replace(",", "."));
    try {
      const unit = cents(nextUnit);
      if (parsedQuantity > 0 && Number.isFinite(parsedQuantity))
        setAmount((Math.round(parsedQuantity * unit) / 100).toFixed(2));
    } catch {
      setAmount("");
    }
  };
  const [count, setCount] = useState("1");
  const [monthly, setMonthly] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [ids] = useState(() => Array.from({ length: 60 }, () => uuid()));
  let preview: ReturnType<typeof installmentPlan> = [];
  try {
    preview = installmentPlan(cents(amount), Number(count), data.due_date);
  } catch {
    /* incomplete form */
  }
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      title={
        value
          ? "Editar lançamento"
          : direction === "income"
            ? "Nova receita"
            : "Nova despesa"
      }
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setSaving(true);
          try {
            if (!data.category.trim())
              throw new Error("Selecione uma categoria.");
            if (itemPricing) {
              const parsed = Number(quantity.replace(",", "."));
              if (
                !Number.isFinite(parsed) ||
                parsed <= 0 ||
                Math.round(parsed * 1000) !== parsed * 1000
              )
                throw new Error(
                  "Informe uma quantidade positiva com até 3 casas decimais.",
                );
            }
            if (!value && monthly) {
              if (
                await createRecurrence(
                  w,
                  {
                    ...data,
                    title: data.title.trim(),
                    category: data.category.trim(),
                    dre_group:
                      categoryGroup(direction, data.category) ||
                      effectiveDreGroup(data),
                    amount_cents: cents(amount),
                    quantity: itemPricing
                      ? Number(quantity.replace(",", "."))
                      : null,
                    unit_amount_cents: itemPricing ? cents(unitAmount) : null,
                    settled_date: null,
                    payments: [],
                  },
                  endDate || null,
                )
              )
                onClose();
              return;
            }
            if (!value && Number(count) > 1) {
              const rows = installmentPlan(
                cents(amount),
                Number(count),
                data.due_date,
              ).map((part, i) => ({
                ...data,
                ...part,
                id: ids[i],
                category: data.category.trim(),
                dre_group:
                  categoryGroup(direction, data.category) ||
                  effectiveDreGroup(data),
                title: `${data.title.trim().slice(0, 190)} · ${i + 1}/${count}`,
                settled_date: null,
                payments: [],
                quantity: null,
                unit_amount_cents: null,
              }));
              if (await w.createFinanceInstallments(rows)) onClose();
              return;
            }
            if (!value)
              installmentPlan(cents(amount), Number(count), data.due_date);
            if (
              await w.write("finance", {
                ...data,
                title: data.title.trim(),
                category: data.category.trim(),
                dre_group:
                  categoryGroup(direction, data.category) ||
                  effectiveDreGroup(data),
                amount_cents: cents(amount),
                quantity: itemPricing
                  ? Number(quantity.replace(",", "."))
                  : null,
                unit_amount_cents: itemPricing ? cents(unitAmount) : null,
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
        <label>
          Descrição
          <input
            autoFocus
            required
            maxLength={monthly ? 180 : 200}
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
            placeholder={
              direction === "income"
                ? "Ex.: Mensalidade de setembro"
                : "Ex.: Materiais de atendimento"
            }
          />
        </label>
        {!value && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={monthly}
              disabled={itemPricing}
              onChange={(e) => {
                setMonthly(e.target.checked);
                setCount("1");
                setData({ ...data, settled_date: null });
              }}
            />
            Repetir mensalmente
          </label>
        )}
        {direction === "income" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={itemPricing}
              onChange={(e) => {
                setItemPricing(e.target.checked);
                if (e.target.checked) {
                  setMonthly(false);
                  setCount("1");
                  calculateItemTotal(quantity, unitAmount);
                } else {
                  setQuantity("1");
                  setUnitAmount("");
                  setAmount(value ? (value.amount_cents / 100).toFixed(2) : "");
                }
              }}
            />
            Calcular pela quantidade e pelo valor unitário
          </label>
        )}
        {direction === "income" && itemPricing && (
          <div className="form-grid">
            <label>
              Quantidade total
              <input
                type="text"
                inputMode="decimal"
                required
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  calculateItemTotal(e.target.value, unitAmount);
                }}
              />
            </label>
            <label>
              Valor por item (R$)
              <input
                inputMode="decimal"
                required
                value={unitAmount}
                onChange={(e) => {
                  setUnitAmount(e.target.value);
                  calculateItemTotal(quantity, e.target.value);
                }}
                placeholder="0,00"
              />
            </label>
            <label>
              Valor total atualizado (R$)
              <input value={amount} readOnly aria-live="polite" />
            </label>
          </div>
        )}
        {!value && monthly && (
          <p className="management-hint">
            O valor se repete por inteiro a cada mês. O sistema mantém os
            próximos 12 meses previstos e continua gerando automaticamente até
            você encerrar ou chegar à data final. Cada lançamento fica em aberto
            para baixa individual.
          </p>
        )}
        <div className="form-grid">
          {!itemPricing && (
            <label>
              {value
                ? "Valor (R$)"
                : monthly
                  ? "Valor mensal (R$)"
                  : "Valor total (R$)"}
              <input
                required
                inputMode="decimal"
                readOnly={itemPricing}
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          <label>
            {!value && (monthly || Number(count) > 1)
              ? "Primeiro vencimento"
              : "Vencimento"}
            <input
              type="date"
              required
              value={data.due_date}
              onChange={(e) => setData({ ...data, due_date: e.target.value })}
            />
          </label>
          {!value && !monthly && (
            <label>
              Quantidade de parcelas
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                required
                value={count}
                onChange={(e) => {
                  setCount(e.target.value);
                  if (Number(e.target.value) > 1)
                    setData({ ...data, settled_date: null });
                }}
              />
            </label>
          )}
          {!value && monthly && (
            <label>
              Repetir até (opcional)
              <input
                type="date"
                min={data.due_date}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
          )}
          <FinanceCategory
            value={data}
            onChange={(patch) => setData({ ...data, ...patch })}
          />
          {direction === "income" ? (
            <label>
              Cliente ou pessoa
              <select
                value={data.contact_id || ""}
                disabled={!!data.contract_id}
                onChange={(e) =>
                  setData({ ...data, contact_id: e.target.value || null })
                }
              >
                <option value="">Sem vínculo</option>
                {s.contacts
                  .filter((c) => !c.deleted_at || c.id === data.contact_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              Fornecedor
              <select
                value={data.supplier_id || ""}
                onChange={(e) =>
                  setData({ ...data, supplier_id: e.target.value || null })
                }
              >
                <option value="">Sem vínculo</option>
                {s.suppliers
                  .filter((c) => !c.deleted_at || c.id === data.supplier_id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
        {!value && Number(count) > 1 && (
          <section aria-label="Prévia das parcelas">
            <p>
              Parcelas mensais. Cada parcela fica em aberto e pode ser paga ou
              recebida separadamente.
            </p>
            {preview.length > 0 && (
              <details open>
                <summary>
                  {preview.length} parcelas · Total {money(cents(amount) / 100)}
                </summary>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {preview.map((part, i) => (
                    <p key={i}>
                      {i + 1}/{count} · {dateLabel(part.due_date)} ·{" "}
                      {money(part.amount_cents / 100)}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </section>
        )}
        {value &&
          direction === "expense" &&
          payments(value).length > 0 &&
          onPayments && (
            <button type="button" className="secondary" onClick={onPayments}>
              {s.role === "owner" ? "Corrigir quem pagou" : "Consultar baixas"}
            </button>
          )}
        {value && (
          <p className="management-hint">
            As alterações e baixas afetam somente este lançamento.
          </p>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!data.settled_date}
            disabled={!!value || monthly || Number(count) > 1}
            onChange={(e) =>
              setData({
                ...data,
                settled_date: e.target.checked ? today() : null,
              })
            }
          />
          {direction === "income"
            ? "Já recebi esse valor"
            : "Já paguei esse valor"}
        </label>
        {data.settled_date && (
          <label>
            Data da baixa
            <input
              type="date"
              required
              max={today()}
              value={data.settled_date}
              disabled={!!value}
              onChange={(e) =>
                setData({ ...data, settled_date: e.target.value || null })
              }
            />
          </label>
        )}
        <label>
          Anotações
          <textarea
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" disabled={saving || w.busy}>
            {monthly ? "Salvar recorrência" : "Salvar lançamento"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
