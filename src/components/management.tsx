"use client";
import { FinanceCategory } from "./finance-category";
import {
  categoryGroup,
  dreLabels,
  effectiveDreGroup,
} from "@/lib/finance-categories";
import { Recurrences } from "./recurrences";
import { createRecurrence } from "@/lib/recurrences";
import { installmentPlan } from "@/lib/installments";
import { PaymentModal } from "./payment-modal";
import { payments, paid, remaining, inPeriod } from "@/lib/payments";
import { recordPayment } from "@/lib/operations";
import { exportCsv } from "@/lib/files";
import { uuid } from "@/lib/demo";
import { useState } from "react";
import {
  Plus,
  Wallet,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  Pencil,
  Trash2,
} from "lucide-react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Contact, Supplier, FinanceEntry } from "@/lib/types";
import { alive, money } from "@/lib/domain";
import { today, cents, balance, entryStatus } from "@/lib/finance";
import { SectionTitle, Empty, Modal, Avatar } from "./ui";
import { ContactForm } from "./forms";
type Work = ReturnType<typeof useWorkspace>;
const dateLabel = (date: string) => date.split("-").reverse().join("/");
export function FinancialSummary({
  rows,
  from = "",
  to = "",
}: {
  rows: FinanceEntry[];
  from?: string;
  to?: string;
}) {
  const b = balance(rows, from, to);
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
    ["customer", "inactive"].includes(c.lifecycle || ""),
  );
  const filtered = contacts.filter(
    (c) =>
      (!status || c.lifecycle === status) &&
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
            <option value="">Todos os clientes</option>
          </select>
        </label>
      </div>
      <p className="management-hint">
        Já está em Pessoas? Abra o cadastro e altere o relacionamento para
        Cliente ativo. A origem da captação e o histórico são preservados.
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
              <p>
                {c.phone} · {c.source}
              </p>
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
                disabled={w.busy}
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
  const from = month ? `${month}-01` : "";
  const to = month
    ? `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`
    : "";
  const monthlyRows = alive(s.finance).filter((r) =>
    inPeriod(r.due_date, from, to),
  );
  const revenue = monthlyRows
    .filter((r) => r.direction === "income")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const expense = monthlyRows
    .filter((r) => r.direction === "expense")
    .reduce((sum, r) => sum + r.amount_cents, 0);
  const [editing, setEditing] = useState<
    FinanceEntry | "income" | "expense" | null
  >(null);
  const [settling, setSettling] = useState<FinanceEntry | null>(null);
  const [settleDate, setSettleDate] = useState(today());
  const rows = alive(s.finance)
    .filter(
      (r) =>
        r.direction === direction &&
        (direction !== "income" || !contact || r.contact_id === contact) &&
        (direction !== "expense" || !supplier || r.supplier_id === supplier) &&
        inPeriod(r.due_date, from, to) &&
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
          Mês de referência
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() => setMonth(today().slice(0, 7))}
        >
          Mês atual
        </button>
        <button className="text-button" onClick={() => setMonth("")}>
          Todos os meses
        </button>
        {!month && <span>Exibindo todos os meses</span>}
      </div>
      <div
        className="finance-summary monthly-totals"
        aria-label="Totais cadastrados por vencimento"
      >
        <div className="card income" aria-label="Receita cadastrada">
          <small>Receita</small>
          <strong>{money(revenue / 100)}</strong>
          <small>
            Total cadastrado {month ? "no mês" : "em todos os meses"}
          </small>
        </div>
        <div className="card expense" aria-label="Despesa cadastrada">
          <small>Despesa</small>
          <strong>{money(expense / 100)}</strong>
          <small>
            Total cadastrado {month ? "no mês" : "em todos os meses"}
          </small>
        </div>
      </div>
      <p className="management-hint">
        Receita e Despesa somam o valor integral dos lançamentos por vencimento,
        incluindo os já baixados. Cada parcela ou recorrência entra no seu mês.
      </p>
      <FinancialSummary rows={s.finance} from={from} to={to} />
      <p className="management-hint">
        Resumo geral da empresa no período selecionado, incluindo receitas e
        despesas.
      </p>
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
          A lista e a exportação seguem o mês de vencimento, a aba e os filtros.
          Os cards independem da busca e da aba. Recebido e Pago usam a data da
          baixa; A receber e A pagar usam o vencimento.
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
                  disabled={w.busy}
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
                  disabled={w.busy}
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
function EntryForm({
  w,
  value,
  direction,
  contact,
  onClose,
}: {
  w: Work;
  value?: FinanceEntry;
  direction: "income" | "expense";
  contact: string;
  onClose: () => void;
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
              onChange={(e) => {
                setMonthly(e.target.checked);
                setCount("1");
                setData({ ...data, settled_date: null });
              }}
            />
            Repetir mensalmente
          </label>
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
          <label>
            {value
              ? "Valor (R$)"
              : monthly
                ? "Valor mensal (R$)"
                : "Valor total (R$)"}
            <input
              required
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
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
