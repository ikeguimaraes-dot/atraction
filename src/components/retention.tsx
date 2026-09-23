"use client";
import { alive } from "@/lib/domain";
import { today } from "@/lib/finance";
import { addDays, pendingRetention } from "@/lib/journey";
import type { useWorkspace } from "@/lib/use-workspace";
import { careTask } from "./customer-hub";
import { SectionTitle } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
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
        subtitle="Retornos, satisfação e renovações no momento certo."
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
                  Agendar retorno
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
      </div>
    </>
  );
}
