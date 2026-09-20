"use client";
import { useState } from "react";
import { ArrowRight, Heart, Copy } from "lucide-react";
import type { useWorkspace } from "@/lib/use-workspace";
import { alive, money } from "@/lib/domain";
import { today } from "@/lib/finance";
import { addDays, pendingRetention, sourceResults } from "@/lib/journey";
import { careTask } from "./customer-hub";
import { SectionTitle, Empty } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
export function Priorities({
  w,
  onCustomer,
  onFinance,
  onContracts,
  onDeals,
  onAgenda,
}: {
  w: Work;
  onCustomer: (id: string) => void;
  onFinance: () => void;
  onContracts: () => void;
  onDeals: () => void;
  onAgenda: () => void;
}) {
  const s = w.state!;
  const manage = ["owner", "manager"].includes(s.role);
  const overdue = alive(s.finance).filter(
    (f) => !f.settled_date && f.due_date < today(),
  );
  const dueSoon = alive(s.finance).filter(
    (f) =>
      !f.settled_date &&
      f.due_date >= today() &&
      f.due_date <= addDays(today(), 7),
  );
  const renewals = alive(s.contracts).filter(
    (c) =>
      c.status === "active" &&
      c.end_date <= addDays(today(), 30) &&
      !s.contracts.some((x) => x.renews_id === c.id),
  );
  const stalled = alive(s.deals).filter(
    (d) =>
      d.stage >= 0 &&
      d.stage < 4 &&
      d.updated_at.slice(0, 10) <= addDays(today(), -7),
  );
  const care = pendingRetention(s);
  const missed = alive(s.activities).filter(
    (a) => !a.done && a.due_at < new Date().toISOString(),
  );
  const items = [
    ...(manage
      ? overdue.slice(0, 3).map((f) => ({
          id: f.id,
          title: `${f.direction === "income" ? "Recebimento" : "Pagamento"} atrasado: ${f.title}`,
          detail: money(f.amount_cents / 100),
          action: f.contact_id ? () => onCustomer(f.contact_id!) : onFinance,
        }))
      : []),
    ...missed.slice(0, 2).map((a) => ({
      id: a.id,
      title: `Retorno pendente: ${a.title}`,
      detail: a.contact_id
        ? s.contacts.find((c) => c.id === a.contact_id)?.name || "Cliente"
        : "Agenda",
      action: a.contact_id ? () => onCustomer(a.contact_id!) : onAgenda,
    })),
    ...renewals.slice(0, 2).map((c) => ({
      id: c.id,
      title: `${c.end_date < today() ? "Contrato encerrado" : "Renovação próxima"}: ${c.title}`,
      detail: s.contacts.find((p) => p.id === c.contact_id)?.name || "Cliente",
      action: onContracts,
    })),
    ...stalled.slice(0, 2).map((d) => ({
      id: d.id,
      title: `Proposta parada: ${d.title}`,
      detail: "Sem avanço há 7 dias ou mais",
      action: onDeals,
    })),
    ...care.slice(0, 2).map(({ contact: c }) => ({
      id: c.id,
      title: `Hora de acompanhar ${c.name}`,
      detail: "Intervalo de relacionamento vencido",
      action: () => onCustomer(c.id),
    })),
    ...(manage
      ? dueSoon.slice(0, 2).map((f) => ({
          id: f.id,
          title: `Vence nesta semana: ${f.title}`,
          detail: money(f.amount_cents / 100),
          action: onFinance,
        }))
      : []),
  ];
  return (
    <section className="card priorities">
      <div className="customer-heading">
        <Heart size={22} />
        <div>
          <h3>O que merece sua atenção</h3>
          <small>
            Próximos passos do relacionamento, das vendas e do financeiro.
          </small>
        </div>
      </div>
      {items.length ? (
        <div className="priority-list">
          {items.map((item) => (
            <button key={item.id} onClick={item.action}>
              <span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      ) : (
        <p className="management-hint">
          Nenhum alerta agora. As prioridades aparecem conforme sua operação
          acontece.
        </p>
      )}
    </section>
  );
}
export function Retention({
  w,
  onCustomer,
  onContracts,
}: {
  w: Work;
  onCustomer: (id: string) => void;
  onContracts: () => void;
}) {
  const s = w.state!;
  const canWrite = s.role !== "viewer";
  const care = pendingRetention(s);
  const renewal = alive(s.contracts).filter(
    (c) =>
      c.status === "active" &&
      c.end_date <= addDays(today(), 30) &&
      !s.contracts.some((r) => r.renews_id === c.id),
  );
  const happy = alive(s.contacts).filter(
    (c) =>
      c.lifecycle === "customer" &&
      (c.satisfaction ?? -1) >= 9 &&
      !s.activities.some(
        (a) =>
          !a.deleted_at &&
          a.contact_id === c.id &&
          a.purpose === "referral" &&
          (!a.done || a.updated_at.slice(0, 10) >= addDays(today(), -90)),
      ),
  );
  const dissatisfied = alive(s.contacts).filter(
    (c) =>
      c.lifecycle === "customer" &&
      c.satisfaction != null &&
      c.satisfaction <= 6,
  );
  return (
    <>
      <SectionTitle
        title="Cuidar de quem já chegou"
        subtitle="Retornos, satisfação, renovações e indicações no momento certo."
      />
      <div className="care-grid">
        <section className="card supplier-card">
          <h3>Clientes para acompanhar · {care.length}</h3>
          <p className="management-hint">
            O prazo usa a última interação registrada e o intervalo configurado
            no cadastro de cada cliente.
          </p>
          {care.map(({ contact: c, last }) => (
            <div className="care-row" key={c.id}>
              <button className="text-button" onClick={() => onCustomer(c.id)}>
                {c.name}
              </button>
              <small>
                Último contato: {last.split("-").reverse().join("/")}
              </small>
              <button
                className="secondary"
                disabled={!canWrite || w.busy}
                onClick={() => careTask(w, c, "followup")}
              >
                Agendar retorno
              </button>
            </div>
          ))}
          {!care.length && <p>Nenhum retorno atrasado.</p>}
        </section>
        <section className="card supplier-card">
          <h3>Renovações · {renewal.length}</h3>
          <p className="management-hint">
            Contratos encerrados ou que terminam nos próximos 30 dias, sem
            renovação cadastrada.
          </p>
          {renewal.map((c) => (
            <div className="care-row" key={c.id}>
              <strong>{c.title}</strong>
              <small>
                {s.contacts.find((p) => p.id === c.contact_id)?.name} ·{" "}
                {c.end_date.split("-").reverse().join("/")}
              </small>
              <div className="management-actions">
                <button className="secondary" onClick={onContracts}>
                  Ver contrato
                </button>
                <button
                  className="text-button"
                  disabled={w.busy}
                  onClick={() =>
                    careTask(
                      w,
                      s.contacts.find((p) => p.id === c.contact_id)!,
                      "renewal",
                    )
                  }
                >
                  Agendar conversa
                </button>
              </div>
            </div>
          ))}
          {!renewal.length && <p>Nenhuma renovação pendente.</p>}
        </section>
        <section className="card supplier-card">
          <h3>Satisfação pede atenção · {dissatisfied.length}</h3>
          {dissatisfied.map((c) => (
            <div className="care-row" key={c.id}>
              <button className="text-button" onClick={() => onCustomer(c.id)}>
                {c.name} · {c.satisfaction}/10
              </button>
              <button
                className="secondary"
                disabled={!canWrite || w.busy}
                onClick={() => careTask(w, c, "followup")}
              >
                Agendar acolhimento
              </button>
            </div>
          ))}
          {!dissatisfied.length && <p>Nenhuma avaliação baixa registrada.</p>}
        </section>
        <section className="card supplier-card">
          <h3>Boas experiências viram indicações · {happy.length}</h3>
          <p className="management-hint">
            Clientes com nota 9 ou 10 e sem pedido pendente ou concluído nos
            últimos 90 dias.
          </p>
          {happy.map((c) => (
            <div className="care-row" key={c.id}>
              <button className="text-button" onClick={() => onCustomer(c.id)}>
                {c.name} · {c.satisfaction}/10
              </button>
              <button
                className="secondary"
                disabled={!canWrite || w.busy}
                onClick={() => careTask(w, c, "referral")}
              >
                Agendar indicação
              </button>
            </div>
          ))}
          {!happy.length && (
            <p>
              Registre a satisfação na ficha do cliente para identificar
              oportunidades.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function Attribution({ w }: { w: Work }) {
  const [from, setFrom] = useState(addDays(today(), -30));
  const [to, setTo] = useState(today());
  const rows = sourceResults(w.state!, from, to);
  const manage = ["owner", "manager"].includes(w.state!.role);
  return (
    <section className="card attribution">
      <h3>Do primeiro contato ao dinheiro recebido</h3>
      <div className="management-toolbar">
        <label>
          Captação e recebimentos desde
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
        Contatos são os cadastrados no período; clientes são os que já
        converteram entre esses contatos. Recebimentos são baixas no período,
        inclusive de clientes antigos. A atribuição usa a origem e a campanha do
        primeiro cadastro; não representa ROI nem rastreamento entre
        dispositivos.
      </p>
      <div className="table-scroll">
        <table className="attribution-table">
          <thead>
            <tr>
              <th>Origem</th>
              <th>Campanha</th>
              <th>Contatos</th>
              <th>Clientes</th>
              <th>Conversão</th>
              {manage && <th>Recebido</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={JSON.stringify([r.source, r.campaign])}>
                <td>{r.source}</td>
                <td>{r.campaign}</td>
                <td>{r.leads}</td>
                <td>{r.customers}</td>
                <td>
                  {r.leads
                    ? Math.round((r.customers / r.leads) * 100) + "%"
                    : "—"}
                </td>
                {manage && <td>{money(r.received / 100)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          title="Acompanhe suas próximas campanhas"
          text="Use links com origem e campanha para conectar a captação ao resultado."
        />
      )}
    </section>
  );
}
export function CampaignLink({ url, w }: { url: string; w: Work }) {
  const [source, setSource] = useState("instagram");
  const [campaign, setCampaign] = useState("");
  const [medium, setMedium] = useState("social");
  const [ref, setRef] = useState("");
  const params = new URLSearchParams({
    utm_source: source,
    utm_campaign: campaign,
    utm_medium: medium,
    ...(ref ? { ref } : {}),
  });
  const link = url ? `${url}?${params}` : "";
  return (
    <section className="card campaign-builder">
      <h3>Cada campanha com seu próprio link</h3>
      <p className="management-hint">
        O formulário guarda a origem, a campanha e a indicação no primeiro
        cadastro. Ative a página de captação para receber contatos.
      </p>
      <div className="management-toolbar">
        <label>
          Origem
          <input
            maxLength={100}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="instagram, google, indicação"
          />
        </label>
        <label>
          Campanha
          <input
            maxLength={160}
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="primavera-2026"
          />
        </label>
        <label>
          Meio
          <input
            maxLength={100}
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            placeholder="social, email, anúncio"
          />
        </label>
        <label>
          Indicado por (opcional)
          <input
            maxLength={160}
            value={ref}
            onChange={(e) => setRef(e.target.value)}
          />
        </label>
      </div>
      <label className="campaign-output">
        Link da campanha
        <input readOnly value={link} />
      </label>
      <button
        className="secondary"
        disabled={!source || !campaign || !url}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            w.notify("Link da campanha copiado.");
          } catch {
            w.notify("Selecione e copie o link no campo acima.");
          }
        }}
      >
        <Copy size={16} /> Copiar link da campanha
      </button>
    </section>
  );
}
