"use client";
import { useState } from "react";
import type { Contact, CustomerDocument, Activity } from "@/lib/types";
import type { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/lib/supabase";
import { alive, money } from "@/lib/domain";
import { today } from "@/lib/finance";
import { lastContact, addDays } from "@/lib/journey";
import { accountPack } from "@/data/niches";
type Work = ReturnType<typeof useWorkspace>;
export async function careTask(
  w: Work,
  c: Contact,
  purpose: NonNullable<Activity["purpose"]>,
  date = today(),
) {
  if (
    w.state!.activities.some(
      (a) =>
        a.contact_id === c.id &&
        a.purpose === purpose &&
        !a.done &&
        !a.deleted_at,
    )
  ) {
    w.notify("Esse acompanhamento já está na agenda.");
    return false;
  }
  const titles = {
    followup: "Retomar contato e acompanhar satisfação",
    referral: "Pedir indicação após um bom atendimento",
    renewal: "Conversar sobre renovação",
    onboarding: "Dar boas-vindas e combinar próximos passos",
  };
  return w.write("activities", {
    ...w.base(),
    owner_id: c.owner_id,
    contact_id: c.id,
    purpose,
    title: titles[purpose],
    due_at: date + "T15:00:00Z",
    done: false,
    kind: "task",
  });
}
export function CustomerHub({ w, id }: { w: Work; id: string }) {
  const s = w.state!;
  const c = s.contacts.find((p) => p.id === id)!;
  const manage = ["owner", "manager"].includes(s.role);
  const canWrite = s.role !== "viewer";
  const [tab, setTab] = useState("history");
  const [note, setNote] = useState("");
  const [followDate, setFollowDate] = useState(today());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const entries: {
    id: string;
    date: string;
    title: string;
    body: string;
    action?: () => void;
  }[] = [
    {
      id: "created",
      date: c.created_at,
      title: "Primeiro cadastro",
      body: `${c.source}${c.campaign ? ` · Campanha: ${c.campaign}` : ""}${c.referred_by ? ` · Indicação: ${c.referred_by}` : ""}`,
    },
    ...alive(s.messages)
      .filter((m) => m.contact_id === id)
      .map((m) => ({
        id: m.id,
        date: m.created_at,
        title:
          m.direction === "note"
            ? "Nota da equipe"
            : m.status === "draft"
              ? "Rascunho"
              : m.direction === "in"
                ? "Mensagem recebida"
                : "Mensagem enviada",
        body: m.body,
      })),
    ...alive(s.deals)
      .filter((d) => d.contact_id === id)
      .map((d) => ({
        id: d.id,
        date: d.updated_at,
        title: `Negócio: ${d.title}`,
        body: `${money(d.value)} · ${d.stage === -1 ? "Perdido" : accountPack(s.tenant).stages[d.stage]}`,
      })),
    ...alive(s.activities)
      .filter((a) => a.contact_id === id)
      .map((a) => ({
        id: a.id,
        date: a.done ? a.updated_at : a.created_at,
        title: a.title,
        action:
          !a.done && canWrite
            ? () => {
                void w.write("activities", { ...a, done: true });
              }
            : undefined,
        body: `${a.done ? "Concluída" : "Agendada"} · ${new Date(a.due_at).toLocaleDateString("pt-BR")}`,
      })),
    ...(manage
      ? alive(s.contracts)
          .filter((x) => x.contact_id === id)
          .map((x) => ({
            id: x.id,
            date: x.created_at,
            title: `Contrato: ${x.title}`,
            body: `${x.plan} · ${money(x.amount_cents / 100)} · ${x.mode === "monthly" ? "Mensal" : x.mode === "installments" ? "Parcelado" : "Único"} · ${x.status === "cancelled" ? "Cancelado" : x.end_date < today() ? "Encerrado" : "Ativo"}`,
          }))
      : []),
    ...(manage
      ? alive(s.finance)
          .filter((x) => x.contact_id === id)
          .map((x) => ({
            id: x.id,
            date: x.settled_date ? x.settled_date + "T12:00:00Z" : x.created_at,
            title: `${x.settled_date ? "Recebimento" : "Conta a receber"}: ${x.title}`,
            body: `${money(x.amount_cents / 100)} · ${x.settled_date ? "Recebido" : "Vence " + x.due_date.split("-").reverse().join("/")}`,
          }))
      : []),
    ...(manage
      ? alive(s.documents)
          .filter((x) => x.contact_id === id)
          .map((x) => ({
            id: x.id,
            date: x.created_at,
            title: "Documento anexado",
            body: x.name,
          }))
      : []),
    ...(manage
      ? s.events
          .filter(
            (e) =>
              ["contracts", "finance"].includes(e.entity) &&
              e.kind !== "INSERT" &&
              (s.contracts.some(
                (x) => x.contact_id === id && x.id === e.entity_id,
              ) ||
                s.finance.some(
                  (x) => x.contact_id === id && x.id === e.entity_id,
                )),
          )
          .map((e) => ({
            id: e.id,
            date: e.created_at,
            title:
              e.entity === "contracts"
                ? "Alteração no contrato"
                : "Alteração financeira",
            body:
              e.kind === "cancel"
                ? "Contrato cancelado"
                : e.kind === "adjust"
                  ? "Reajuste aplicado"
                  : "Histórico de atualização registrado",
          }))
      : []),
  ].sort((a, b) => b.date.localeCompare(a.date));
  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      if (
        !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
        file.size > 5 * 1024 * 1024 ||
        file.size < 1
      )
        throw new Error("Escolha PDF, PNG ou JPEG de até 5 MB.");
      if (s.documents.length >= 20)
        throw new Error("Limite de 20 documentos por espaço atingido.");
      const row: CustomerDocument = {
        ...w.base(),
        contact_id: id,
        name: file.name.slice(0, 200),
        path: "",
        mime_type: file.type,
        size: file.size,
      };
      row.path = `${s.tenant.id}/${row.id}`;
      if (s.tenant.id === "demo") {
        if (file.size > 1024 * 1024)
          throw new Error("Na demonstração, use um arquivo de até 1 MB.");
        row.demo_data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        if (!(await w.write("documents", row)))
          throw new Error("Não foi possível guardar o arquivo.");
      } else {
        if (!(await w.write("documents", row)))
          throw new Error("Não foi possível cadastrar o documento.");
        const { error } = await supabase()
          .storage.from("atraction-documents")
          .upload(row.path, file, { contentType: file.type, upsert: false });
        if (error) {
          await supabase()
            .from("atraction_documents")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("tenant_id", s.tenant.id);
          await w.read(w.userId!);
          throw new Error(
            "Falha no envio. Confira a conexão e tente novamente.",
          );
        }
        w.notify("Documento anexado com acesso privado.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function download(d: CustomerDocument) {
    try {
      let blob: Blob;
      if (d.demo_data) {
        const response = await fetch(d.demo_data);
        blob = await response.blob();
      } else {
        const { data, error } = await supabase()
          .storage.from("atraction-documents")
          .download(d.path);
        if (error) throw error;
        blob = data;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Não foi possível baixar esse documento.");
    }
  }
  return (
    <section className="customer-hub">
      <div className="management-actions hub-tabs">
        <button
          className={tab === "history" ? "primary" : "secondary"}
          onClick={() => setTab("history")}
        >
          Histórico completo
        </button>
        <button
          className={tab === "care" ? "primary" : "secondary"}
          onClick={() => setTab("care")}
        >
          Acompanhamento
        </button>
        {manage && (
          <button
            className={tab === "documents" ? "primary" : "secondary"}
            onClick={() => setTab("documents")}
          >
            Documentos
          </button>
        )}
      </div>
      {tab === "history" && (
        <div className="timeline journey-timeline">
          {entries.map((e) => (
            <div key={e.id}>
              <span className="timeline-dot" />
              <div>
                <strong>{e.title}</strong>
                <p>{e.body}</p>
                {e.action && (
                  <button
                    className="secondary"
                    disabled={w.busy}
                    onClick={e.action}
                  >
                    Concluir tarefa
                  </button>
                )}
                <small>{new Date(e.date).toLocaleString("pt-BR")}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "care" && (
        <div className="form">
          <p>
            Última interação registrada:{" "}
            {lastContact(s, c).split("-").reverse().join("/")}. Próximo
            acompanhamento sugerido:{" "}
            {addDays(lastContact(s, c), c.retention_days || 30)
              .split("-")
              .reverse()
              .join("/")}
            .
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await w.write("activities", {
                  ...w.base(),
                  owner_id: c.owner_id,
                  contact_id: id,
                  title: `Atendimento: ${note.trim()}`,
                  due_at: new Date().toISOString(),
                  done: true,
                  kind: "task",
                })
              )
                setNote("");
            }}
          >
            <label>
              Como foi o atendimento?
              <textarea
                required
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Registre o que combinaram e o próximo passo."
              />
            </label>
            <button className="primary" disabled={!canWrite || w.busy}>
              Registrar atendimento
            </button>
          </form>
          <div className="form-grid">
            <label>
              Data do próximo retorno
              <input
                type="date"
                required
                value={followDate}
                onChange={(e) => setFollowDate(e.target.value)}
              />
            </label>
            <label>
              Satisfação informada pelo cliente
              <select
                value={c.satisfaction ?? ""}
                disabled={!canWrite || w.busy}
                onChange={(e) =>
                  w.write("contacts", {
                    ...c,
                    satisfaction:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">Ainda não perguntei</option>
                {Array.from({ length: 11 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} / 10
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="management-actions">
            <button
              className="secondary"
              disabled={!canWrite || w.busy || !followDate}
              onClick={() => careTask(w, c, "followup", followDate)}
            >
              Agendar retorno
            </button>
            <button
              className="secondary"
              disabled={!canWrite || w.busy}
              onClick={() => careTask(w, c, "referral")}
            >
              Agendar pedido de indicação
            </button>
          </div>
          <p>
            Essas ações organizam tarefas internas. O pedido de indicação e o
            contato com o cliente são feitos pela sua equipe.
          </p>
        </div>
      )}
      {tab === "documents" && manage && (
        <div className="form">
          <p>
            PDF, PNG ou JPEG, até 5 MB. Máximo de 20 documentos por espaço,
            incluindo arquivados. Acesso reservado ao proprietário e aos
            gestores.
          </p>
          <label>
            Anexar documento
            <input
              aria-label="Anexar documento"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              disabled={uploading || w.busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
          </label>
          {uploading && <p role="status">Enviando documento…</p>}
          {alive(s.documents)
            .filter((d) => d.contact_id === id)
            .map((d) => (
              <div className="document-row" key={d.id}>
                <span>
                  {d.name}
                  <small>{Math.ceil(d.size / 1024)} KB</small>
                </span>
                <button className="secondary" onClick={() => download(d)}>
                  Baixar
                </button>
                <button
                  className="text-button"
                  disabled={w.busy || uploading}
                  onClick={() =>
                    w.write("documents", {
                      ...d,
                      deleted_at: new Date().toISOString(),
                    })
                  }
                >
                  Arquivar
                </button>
              </div>
            ))}
        </div>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
