"use client";
import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import type { Contract, Deal } from "@/lib/types";
import type { useWorkspace } from "@/lib/use-workspace";
import { useJourney } from "@/lib/use-journey";
import { addDays, addMonths, schedule } from "@/lib/journey";
import { today, cents } from "@/lib/finance";
import { alive, money } from "@/lib/domain";
import { Modal, SectionTitle, Empty } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
export function Contracts({
  w,
  onCustomer,
  onFinance,
  initialDeal,
  onStarted,
}: {
  w: Work;
  onCustomer: (id: string) => void;
  onFinance: (id: string, supplier?: boolean) => void;
  initialDeal?: Deal;
  onStarted?: () => void;
}) {
  const s = w.state!;
  const j = useJourney(w);
  const [creating, setCreating] = useState(!!initialDeal);
  const [renew, setRenew] = useState<Contract>();
  const [change, setChange] = useState<{
    contract: Contract;
    action: "adjust" | "cancel";
  }>();
  const [value, setValue] = useState("");
  const [effective, setEffective] = useState(today());
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const rows = alive(s.contracts).filter((c) =>
    `${c.title} ${c.plan} ${c.supplier_id ? s.suppliers.find((p) => p.id === c.supplier_id)?.name : s.contacts.find((p) => p.id === c.contact_id)?.name}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <SectionTitle
        title="Contratos de clientes e fornecedores"
        subtitle="Organize seus contratos e acompanhe as contas a receber de clientes e a pagar a fornecedores."
        action={
          <button
            className="primary"
            onClick={() => {
              setRenew(undefined);
              setCreating(true);
            }}
          >
            <Plus size={18} /> Novo contrato
          </button>
        }
      />
      <div className="management-toolbar">
        <label>
          Buscar contrato
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cliente, fornecedor, plano ou descrição"
          />
        </label>
      </div>
      <div className="customer-grid">
        {rows.map((c) => {
          const renewed = s.contracts.some((x) => x.renews_id === c.id);
          return (
            <section className="card supplier-card" key={c.id}>
              <div className="customer-heading">
                <FileText size={23} />
                <div>
                  <h3>{c.title}</h3>
                  <small>
                    {c.plan || "Plano personalizado"} ·{" "}
                    {c.status === "cancelled"
                      ? "Cancelado"
                      : renewed
                        ? "Renovado"
                        : c.end_date < today()
                          ? "Encerrado"
                          : "Ativo"}
                  </small>
                </div>
              </div>
              <p>
                <span className="badge">
                  {c.supplier_id
                    ? "Fornecedor · A pagar"
                    : "Cliente · A receber"}
                </span>
              </p>
              <p>
                {c.supplier_id
                  ? s.suppliers.find((p) => p.id === c.supplier_id)?.name
                  : s.contacts.find((p) => p.id === c.contact_id)?.name}
              </p>
              <p>
                Vigência: {c.start_date.split("-").reverse().join("/")} a{" "}
                {c.end_date.split("-").reverse().join("/")}
              </p>
              <strong>
                {money(c.amount_cents / 100)}{" "}
                {c.mode === "monthly"
                  ? "/ mês"
                  : c.mode === "installments"
                    ? `em ${c.periods} parcelas`
                    : "à vista"}
              </strong>
              <div className="management-actions journey-buttons">
                {c.contact_id && (
                  <button
                    className="secondary"
                    onClick={() => onCustomer(c.contact_id!)}
                  >
                    Ficha do cliente
                  </button>
                )}
                <button
                  className="secondary"
                  onClick={() =>
                    onFinance(c.supplier_id || c.contact_id!, !!c.supplier_id)
                  }
                >
                  {c.supplier_id ? "Contas a pagar" : "Cobranças"}
                </button>
                {c.status === "active" && !renewed && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setRenew(c);
                      setCreating(true);
                    }}
                  >
                    Renovar
                  </button>
                )}
                {c.status === "active" && (
                  <>
                    <button
                      className="text-button"
                      disabled={c.mode !== "monthly"}
                      onClick={() => {
                        setChange({ contract: c, action: "adjust" });
                        setValue((c.amount_cents / 100).toFixed(2));
                        setEffective(today());
                        setError("");
                      }}
                    >
                      Reajustar
                    </button>
                    <button
                      disabled={w.state!.role !== "owner"}
                      className="text-button"
                      onClick={() => {
                        setChange({ contract: c, action: "cancel" });
                        setEffective(today());
                        setError("");
                      }}
                    >
                      Cancelar contrato
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!rows.length && (
        <Empty
          title="Do combinado ao acompanhamento"
          text="Escolha cliente ou fornecedor e crie um contrato à vista, parcelado ou mensal. Os lançamentos financeiros são gerados automaticamente."
        />
      )}
      {creating && (
        <ContractForm
          w={w}
          deal={renew ? undefined : initialDeal}
          renew={renew}
          busy={j.busy}
          onSave={j.create}
          onClose={() => {
            setCreating(false);
            setRenew(undefined);
            onStarted?.();
          }}
        />
      )}
      {change && (
        <Modal
          title={
            change.action === "adjust"
              ? "Reajustar mensalidade"
              : "Cancelar contrato"
          }
          onClose={() => setChange(undefined)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                const amount = change.action === "adjust" ? cents(value) : 0;
                const has = w.state!.finance.some(
                  (f) =>
                    f.contract_id === change.contract.id &&
                    !f.deleted_at &&
                    !f.settled_date &&
                    f.due_date >= effective,
                );
                if (change.action === "adjust" && !has)
                  throw new Error(
                    "Não há mensalidades futuras em aberto nesse período.",
                  );
                if (
                  await j.action(
                    change.contract,
                    change.action,
                    amount,
                    effective,
                  )
                )
                  setChange(undefined);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            <p>{change.contract.title}</p>
            {change.action === "adjust" ? (
              <>
                <label>
                  Nova mensalidade (R$)
                  <input
                    required
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </label>
                <label>
                  Aplicar nos vencimentos a partir de
                  <input
                    type="date"
                    min={today()}
                    required
                    value={effective}
                    onChange={(e) => setEffective(e.target.value)}
                  />
                </label>
                <p>
                  Somente mensalidades em aberto a partir dessa data serão
                  alteradas. Valores já recebidos ou pagos são preservados.
                </p>
              </>
            ) : (
              <p>
                O contrato será cancelado agora. Cobranças sem nenhuma baixa com
                vencimento de hoje em diante irão para a lixeira. Dívidas
                anteriores e pagamentos realizados permanecem no histórico.
              </p>
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
                onClick={() => setChange(undefined)}
              >
                Voltar
              </button>
              <button className="primary" disabled={j.busy}>
                Confirmar{" "}
                {change.action === "adjust" ? "reajuste" : "cancelamento"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
function ContractForm({
  w,
  deal,
  renew,
  busy,
  onSave,
  onClose,
}: {
  w: Work;
  deal?: Deal;
  renew?: Contract;
  busy: boolean;
  onSave: (c: Contract) => Promise<boolean>;
  onClose: () => void;
}) {
  const [data, setData] = useState<Contract>(() => {
    const start = renew ? addDays(renew.end_date, 1) : today();
    return {
      ...w.base(),
      contact_id: renew?.supplier_id
        ? null
        : renew?.contact_id || deal?.contact_id || "",
      supplier_id: renew?.supplier_id || null,
      deal_id: deal?.id || null,
      renews_id: renew?.id || null,
      title: renew?.title || deal?.title || "",
      plan: renew?.plan || "",
      mode: renew?.mode || "once",
      amount_cents: renew?.amount_cents || 0,
      periods: renew?.periods || 1,
      start_date: start,
      first_due_date: start,
      end_date: start,
      status: "active",
      notes: renew?.notes || "",
    };
  });
  const [amount, setAmount] = useState(
    renew
      ? (renew.amount_cents / 100).toFixed(2)
      : deal
        ? String(deal.value)
        : "",
  );
  const [partyType, setPartyType] = useState<"customer" | "supplier">(
    renew?.supplier_id ? "supplier" : "customer",
  );
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  function validate() {
    const c = {
      ...data,
      amount_cents: cents(amount),
      periods: data.mode === "once" ? 1 : data.periods,
      title: data.title.trim(),
    };
    if (
      !(partyType === "supplier" ? c.supplier_id : c.contact_id) ||
      !c.title ||
      !c.start_date ||
      !c.first_due_date ||
      c.first_due_date < c.start_date ||
      c.periods < 1 ||
      c.periods > 60
    )
      throw new Error(
        "Confira cliente ou fornecedor, datas e quantidade (1 a 60).",
      );
    if (c.mode === "installments" && c.amount_cents < c.periods)
      throw new Error(
        "O valor precisa permitir parcelas de pelo menos um centavo.",
      );
    return { ...c, end_date: addDays(addMonths(c.start_date, c.periods), -1) };
  }
  let planned: ReturnType<typeof schedule> = [];
  try {
    planned = schedule(validate());
  } catch {}
  return (
    <Modal
      title={
        renew
          ? "Renovar contrato"
          : deal
            ? "Continuar a jornada da venda"
            : "Novo contrato"
      }
      onClose={onClose}
      wide
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            const c = validate();
            if (!preview) setPreview(true);
            else if (await onSave(c)) onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        {!preview ? (
          <>
            <div className="form-grid">
              <label>
                Tipo de contrato
                <select
                  value={partyType}
                  disabled={!!deal || !!renew}
                  onChange={(e) => {
                    const type = e.target.value as "customer" | "supplier";
                    setPartyType(type);
                    setData({
                      ...data,
                      contact_id: type === "customer" ? "" : null,
                      supplier_id: null,
                    });
                  }}
                >
                  <option value="customer">Cliente — contas a receber</option>
                  <option value="supplier">Fornecedor — contas a pagar</option>
                </select>
              </label>
              <label>
                {partyType === "supplier" ? "Fornecedor" : "Cliente"}
                <select
                  required
                  disabled={!!deal || !!renew}
                  value={
                    (partyType === "supplier"
                      ? data.supplier_id
                      : data.contact_id) || ""
                  }
                  onChange={(e) =>
                    setData({
                      ...data,
                      ...(partyType === "supplier"
                        ? { supplier_id: e.target.value, contact_id: null }
                        : { contact_id: e.target.value, supplier_id: null }),
                    })
                  }
                >
                  <option value="">
                    {partyType === "supplier"
                      ? "Escolha um fornecedor"
                      : "Escolha uma pessoa"}
                  </option>
                  {(partyType === "supplier"
                    ? alive(w.state!.suppliers)
                    : alive(w.state!.contacts)
                  ).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {partyType === "supplier" &&
                  !alive(w.state!.suppliers).length && (
                    <small>
                      Cadastre o fornecedor em Fornecedores antes de criar o
                      contrato.
                    </small>
                  )}
              </label>
              <label>
                Descrição do contrato
                <input
                  required
                  maxLength={200}
                  value={data.title}
                  onChange={(e) => setData({ ...data, title: e.target.value })}
                />
              </label>
              <label>
                Plano / serviço
                <input
                  maxLength={160}
                  value={data.plan}
                  onChange={(e) => setData({ ...data, plan: e.target.value })}
                  placeholder="Ex.: Acompanhamento mensal"
                />
              </label>
              <label>
                Cobrança
                <select
                  value={data.mode}
                  onChange={(e) =>
                    setData({
                      ...data,
                      mode: e.target.value as Contract["mode"],
                    })
                  }
                >
                  <option value="once">Única</option>
                  <option value="installments">Parcelada</option>
                  <option value="monthly">Mensal recorrente</option>
                </select>
              </label>
              <label>
                {data.mode === "monthly"
                  ? "Mensalidade (R$)"
                  : "Valor total (R$)"}
                <input
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              {data.mode !== "once" && (
                <label>
                  {data.mode === "monthly"
                    ? "Vigência em meses"
                    : "Número de parcelas"}
                  <input
                    type="number"
                    required
                    min={1}
                    max={60}
                    value={data.periods}
                    onChange={(e) =>
                      setData({ ...data, periods: Number(e.target.value) })
                    }
                  />
                </label>
              )}
              <label>
                Início da vigência
                <input
                  required
                  type="date"
                  min={renew ? addDays(renew.end_date, 1) : undefined}
                  value={data.start_date}
                  onChange={(e) =>
                    setData({
                      ...data,
                      start_date: e.target.value,
                      first_due_date: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                Primeiro vencimento
                <input
                  required
                  type="date"
                  min={data.start_date}
                  value={data.first_due_date}
                  onChange={(e) =>
                    setData({ ...data, first_due_date: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Condições e anotações
              <textarea
                value={data.notes}
                onChange={(e) => setData({ ...data, notes: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <h3>Confira antes de confirmar</h3>
            <p>
              {partyType === "supplier"
                ? `Serão criadas ${planned.length} conta(s) a pagar para o fornecedor. Nenhum valor será marcado como pago.`
                : `O cliente ficará ativo, ${planned.length} conta(s) a receber serão criadas e uma tarefa de boas-vindas será agendada. Nenhum valor será marcado como recebido.`}
              {deal ? " A venda ficará marcada como ganha." : ""}
            </p>
            <p>
              Vigência até {validate().end_date.split("-").reverse().join("/")}.
              Total previsto:{" "}
              <strong>
                {money(planned.reduce((n, f) => n + f.amount_cents, 0) / 100)}
              </strong>
              .
            </p>
            <div className="contract-preview">
              {planned.map((f) => (
                <div key={f.id}>
                  <span>{f.title}</span>
                  <span>{f.due_date.split("-").reverse().join("/")}</span>
                  <strong>{money(f.amount_cents / 100)}</strong>
                </div>
              ))}
            </div>
            <p>
              As mensalidades deste período são geradas agora. A renovação exige
              sua confirmação e cria o próximo período, sem duplicar cobranças.
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
            onClick={() => (preview ? setPreview(false) : onClose())}
          >
            {preview ? "Revisar" : "Cancelar"}
          </button>
          <button className="primary" disabled={busy}>
            {preview ? "Confirmar contrato e cobranças" : "Ver prévia"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
