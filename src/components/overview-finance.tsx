"use client";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Clock3,
  ReceiptText,
  CalendarDays,
} from "lucide-react";
import type { State, FinanceEntry } from "@/lib/types";
import { alive, money } from "@/lib/domain";
import { financeReferenceDate, today } from "@/lib/finance";
import { remaining } from "@/lib/payments";
import { Modal } from "./ui";

export function OverviewFinance({
  state,
  onFinance,
}: {
  state: State;
  onFinance: () => void;
}) {
  const month = today().slice(0, 7);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" },
  );
  const entries = alive(state.finance);
  const monthly = entries.filter(
    (f) => financeReferenceDate(f, state.documents).slice(0, 7) === month,
  );
  const income = monthly.filter((f) => f.direction === "income");
  const expense = monthly.filter((f) => f.direction === "expense");
  const open = entries.filter(
    (f) => f.direction === "expense" && remaining(f) > 0,
  );
  const payable = open.filter((f) => f.due_date.slice(0, 7) === month);
  const receivable = entries.filter(
    (f) =>
      f.direction === "income" &&
      f.due_date.slice(0, 7) === month &&
      remaining(f) > 0,
  );
  const sum = (rows: FinanceEntry[], pending = false) =>
    rows.reduce((n, f) => n + (pending ? remaining(f) : f.amount_cents), 0);
  const profit = sum(income) - sum(expense);
  const cards = [
    {
      id: "income",
      title: "Receitas do mês",
      value: sum(income),
      hint: "Receitas com vencimento neste mês",
      color: "positive",
      icon: ArrowDownLeft,
      rows: income,
      pending: false,
    },
    {
      id: "expense",
      title: "Despesas do mês",
      value: sum(expense),
      hint: "Total do mês, pago ou ainda em aberto",
      color: "negative",
      icon: ArrowUpRight,
      rows: expense,
      pending: false,
    },
    {
      id: "profit",
      title: profit < 0 ? "Prejuízo do mês" : "Lucro do mês",
      value: profit,
      hint: "Receitas menos despesas cadastradas",
      color: profit < 0 ? "negative featured" : "positive featured",
      icon: profit < 0 ? TrendingDown : TrendingUp,
      rows: monthly,
      pending: false,
    },
    {
      id: "receivable",
      title: "A receber no mês",
      value: sum(receivable, true),
      hint: "Saldo a receber com vencimento neste mês",
      color: "positive",
      icon: CalendarDays,
      rows: receivable,
      pending: true,
    },
    {
      id: "open",
      title: "Contas em aberto",
      value: sum(open, true),
      hint: "Despesas não pagas, de todos os meses",
      color: "negative",
      icon: Clock3,
      rows: open,
      pending: true,
    },
    {
      id: "payable",
      title: "Contas a pagar no mês",
      value: sum(payable, true),
      hint: "Parte das contas em aberto que vence neste mês",
      color: "negative",
      icon: ReceiptText,
      rows: payable,
      pending: true,
    },
  ];
  const [selected, setSelected] = useState<string | null>(null);
  const detail = cards.find((c) => c.id === selected);
  const renderCard = (c: (typeof cards)[number]) => {
    const Icon = c.icon;
    return (
      <button
        type="button"
        key={c.id}
        className={`overview-money-card ${c.color}`}
        aria-label={c.title}
        onClick={() => setSelected(c.id)}
      >
        <span className="overview-money-heading">
          <span>{c.title}</span>
          <span className="overview-money-icon">
            <Icon size={20} aria-hidden="true" />
          </span>
        </span>
        <strong>{money(c.value / 100)}</strong>
        <span className="overview-money-hint">{c.hint}</span>
        <span className="overview-money-footer">
          Ver lançamentos <ArrowUpRight size={15} aria-hidden="true" />
        </span>
      </button>
    );
  };
  return (
    <section
      className="overview-finance"
      aria-label="Resumo financeiro da visão geral"
    >
      <header className="overview-finance-header">
        <div>
          <span className="finance-eyebrow">SEU MÊS EM NÚMEROS</span>
          <h2>Como está a empresa?</h2>
        </div>
        <span className="overview-month">
          <CalendarDays size={16} aria-hidden="true" />
          {monthLabel}
        </span>
      </header>
      <div className="overview-money-grid">
        {cards.slice(0, 3).map(renderCard)}
      </div>
      <p className="overview-finance-note">
        Resultado por vencimento ou emissão da nota, incluindo valores ainda sem
        baixa.
      </p>
      <div className="overview-pending-heading">
        <h3>O que ainda precisa ser resolvido</h3>
        <span>Recebimentos e pagamentos pendentes</span>
      </div>
      <div className="overview-money-grid pending">
        {cards.slice(3).map(renderCard)}
      </div>
      <p className="overview-finance-note">
        As contas a pagar no mês já fazem parte das contas em aberto. Não some
        os dois cards.
      </p>
      {detail && (
        <Modal title={detail.title} onClose={() => setSelected(null)} wide>
          <div className="overview-details">
            <div
              className={`overview-detail-total ${detail.value < 0 || detail.color.includes("negative") ? "negative" : "positive"}`}
            >
              <span>{detail.hint}</span>
              <strong>{money(detail.value / 100)}</strong>
            </div>
            {!detail.rows.length && (
              <p className="overview-empty">Nenhum lançamento nesta seleção.</p>
            )}
            {detail.rows
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((f) => (
                <article className="overview-detail-row" key={f.id}>
                  <div>
                    <strong>{f.title}</strong>
                    <small>
                      {f.direction === "income" ? "Receita" : "Despesa"} ·
                      Vencimento {f.due_date.split("-").reverse().join("/")}
                      {detail.pending ? " · Saldo em aberto" : ""}
                    </small>
                  </div>
                  <b
                    className={
                      f.direction === "income" ? "positive" : "negative"
                    }
                  >
                    {money(
                      (detail.pending ? remaining(f) : f.amount_cents) / 100,
                    )}
                  </b>
                </article>
              ))}
            <button className="primary" onClick={onFinance}>
              Abrir Financeiro
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
