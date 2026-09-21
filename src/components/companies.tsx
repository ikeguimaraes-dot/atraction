"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Collection } from "@/lib/types";
import { money, alive } from "@/lib/domain";
import { balance, today } from "@/lib/finance";
import {
  dre,
  remaining,
  accountBalance,
  financeInPeriod,
} from "@/lib/payments";
import { addDays } from "@/lib/journey";
import { SectionTitle, Empty } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
export function CompanySelector({
  w,
  onCreate,
  onSelect,
}: {
  w: Work;
  onCreate: () => void;
  onSelect: (id: string) => void;
}) {
  if (!w.userId) return null;
  return (
    <div className="company-switch">
      <label>
        Empresas
        <select
          aria-label="Selecionar empresa"
          value={w.selection}
          disabled={w.busy || w.switching}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="all">Todas</option>
          {w.companies.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="text-button"
        disabled={w.busy || w.switching}
        onClick={onCreate}
      >
        + Cadastrar empresa
      </button>
    </div>
  );
}
export function AllCompanies({
  w,
  view,
  onSelect,
}: {
  w: Work;
  view: string;
  onSelect: (id: string) => void;
}) {
  const s = w.allState!;
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const finance = balance(s.finance, from, to);
  const result = dre(s, from, to);
  const financiallyVisible = w.companies.filter((c) =>
    ["owner", "manager"].includes(c.role),
  );
  const metrics = [
    ["Pessoas", alive(s.contacts).length],
    [
      "Clientes",
      alive(s.contacts).filter((c) => c.lifecycle === "customer").length,
    ],
    [
      "Negócios abertos",
      alive(s.deals).filter((d) => d.stage >= 0 && d.stage < 4).length,
    ],
    ["Tarefas pendentes", alive(s.activities).filter((a) => !a.done).length],
  ];
  const companyName = (id: string) =>
    w.companies.find((c) => c.id === id)?.name || "Empresa";
  const tables: Record<string, Collection> = {
    contacts: "contacts",
    clients: "contacts",
    deals: "deals",
    calendar: "activities",
    finance: "finance",
    suppliers: "suppliers",
    contracts: "contracts",
    messages: "chat_sessions",
    automations: "automations",
    retention: "contacts",
    tools: "segments",
    trash: "contacts",
    cash: "accounts",
  };
  const collection = tables[view] || "contacts";
  const rows = s[collection]
    .filter((row) => (view === "trash" ? !!row.deleted_at : !row.deleted_at))
    .filter(
      (row) =>
        !["clients", "retention"].includes(view) ||
        ("lifecycle" in row && row.lifecycle === "customer"),
    )
    .filter(
      (row) =>
        collection !== "finance" ||
        financeInPeriod(row as (typeof s.finance)[number], from, to),
    )
    .filter(
      (row) =>
        JSON.stringify(row).toLowerCase().includes(query.toLowerCase()) ||
        companyName(row.tenant_id).toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      <SectionTitle
        title="Todas as empresas"
        subtitle={`${w.companies.length} empresas · visão consolidada dos dados que você pode acessar.`}
      />
      <p className="management-hint">
        Selecione uma empresa para cadastrar ou alterar informações. Cada
        registro permanece vinculado à sua empresa.
      </p>
      <div className="company-metrics">
        {metrics.map(([label, value]) => (
          <section className="card" key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </section>
        ))}
      </div>
      {financiallyVisible.length > 0 && (
        <section className="card attribution">
          <h2>Financeiro consolidado</h2>
          <div className="management-toolbar">
            <label>
              Desde
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Até
              <input
                type="date"
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </div>
          <p className="management-hint">
            Valores das {financiallyVisible.length} empresas em que você tem
            acesso financeiro. Baixas pela data do pagamento; valores em aberto
            pelo vencimento.
          </p>
          <div className="company-metrics">
            {[
              ["Recebido", finance.received],
              ["Pago", finance.paid],
              ["A receber", finance.receivable],
              ["A pagar", finance.payable],
              ["Custos diretos", result.cost],
              ["Resultado de caixa", result.net],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{money(Number(value) / 100)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="card attribution">
        <h2>Suas empresas</h2>
        <div className="company-list">
          {w.companies.map((c) => {
            const b = balance(
              s.finance.filter((f) => f.tenant_id === c.id),
              from,
              to,
            );
            return (
              <button key={c.id} onClick={() => onSelect(c.id)}>
                <strong>{c.name}</strong>
                <span>
                  {alive(s.contacts).filter((p) => p.tenant_id === c.id).length}{" "}
                  pessoas ·{" "}
                  {
                    alive(s.deals).filter(
                      (d) =>
                        d.tenant_id === c.id && d.stage >= 0 && d.stage < 4,
                    ).length
                  }{" "}
                  negócios abertos
                </span>
                {["owner", "manager"].includes(c.role) && (
                  <small>
                    Recebido: {money(b.received / 100)} · Pago:{" "}
                    {money(b.paid / 100)}
                  </small>
                )}
                <span>Abrir empresa →</span>
              </button>
            );
          })}
        </div>
      </section>
      {["capture", "settings"].includes(view) ? (
        <Empty
          title="Escolha uma empresa"
          text="As configurações, a equipe e a página de captação pertencem a cada empresa. Use o seletor ou abra uma empresa acima."
        />
      ) : (
        <section className="card attribution">
          <h2>
            {(
              {
                contacts: "Pessoas",
                clients: "Clientes",
                deals: "Negócios",
                calendar: "Agenda",
                finance: "Lançamentos financeiros",
                suppliers: "Fornecedores",
                contracts: "Contratos",
                messages: "Conversas do site",
                automations: "Robôs",
                retention: "Clientes para acompanhar",
                tools: "Segmentos",
                trash: "Pessoas arquivadas",
                cash: "Contas de caixa e banco",
              } as Record<string, string>
            )[view] || "Pessoas de todas as empresas"}
          </h2>
          <label className="form">
            Buscar nos registros
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, descrição ou empresa"
            />
          </label>
          <div className="consolidated-rows">
            {rows.slice(0, 200).map((row) => {
              const label =
                "name" in row
                  ? row.name
                  : "title" in row
                    ? row.title
                    : "visitor_name" in row
                      ? row.visitor_name
                      : "Registro";
              let detail =
                "phone" in row
                  ? row.phone
                  : "stage" in row
                    ? `${money(row.value)} · ${row.stage === 4 ? "Ganho" : row.stage === -1 ? "Perdido" : "Em andamento"}`
                    : "amount_cents" in row
                      ? `${money(row.amount_cents / 100)}${"payments" in row || "settled_date" in row ? " · Restante: " + money(remaining(row as (typeof s.finance)[number]) / 100) : ""}`
                      : "due_at" in row
                        ? new Date(row.due_at).toLocaleDateString("pt-BR")
                        : "closed" in row
                          ? row.closed
                            ? "Encerrada"
                            : "Aberta"
                          : "kind" in row && "initial_cents" in row
                            ? money(accountBalance(s, row, to) / 100)
                            : "";
              return (
                <article className="consolidated-row" key={row.id}>
                  <div>
                    <strong>{String(label)}</strong>
                    <small>{detail}</small>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => onSelect(row.tenant_id)}
                  >
                    {companyName(row.tenant_id)}
                  </button>
                </article>
              );
            })}
          </div>
          <p className="management-hint">
            {rows.length} registros
            {rows.length > 200
              ? " · Mostrando os primeiros 200. Use a busca para refinar."
              : ""}
          </p>
        </section>
      )}
    </>
  );
}
