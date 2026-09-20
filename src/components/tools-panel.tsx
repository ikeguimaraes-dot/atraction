"use client";
import { useState } from "react";
import type { useWorkspace } from "@/lib/use-workspace";
import type { Segment, Contact, DocumentTemplate } from "@/lib/types";
import { segmentContacts } from "@/lib/segments";
import { alive, money } from "@/lib/domain";
import { supabase } from "@/lib/supabase";
import { uuid } from "@/lib/demo";
import { today } from "@/lib/finance";
import { downloadFile, makePdf } from "@/lib/files";
import { accountPack } from "@/data/niches";
import { Modal, SectionTitle, Empty } from "./ui";
type Work = ReturnType<typeof useWorkspace>;
const defaultTemplates: DocumentTemplate[] = [
  {
    id: "proposal",
    name: "Proposta comercial",
    body: "PROPOSTA COMERCIAL\n\nEmpresa: {empresa}\nCliente: {cliente}\nDocumento: {documento}\nData: {data}\n\nServiço: {servico}\nValor: {valor}\n\nCondições:\n{condicoes}\n\nValidade e aprovação: preencher conforme o combinado.",
  },
  {
    id: "agreement",
    name: "Contrato de prestação de serviços",
    body: "REGISTRO DO CONTRATO\n\nContratante: {cliente}\nCPF/CNPJ: {documento}\nEndereço: {endereco}\nContratada: {empresa}\n\nObjeto: {servico}\nValor: {valor}\nCondições: {condicoes}\n\nData: {data}\n\nAssinaturas: __________________________________\n\nRevise as condições antes de utilizar este documento.",
  },
];
export function ToolsPanel({
  w,
  onCustomer,
}: {
  w: Work;
  onCustomer: (c: Contact) => void;
}) {
  const s = w.state!;
  const manage = ["owner", "manager"].includes(s.role);
  const owner = s.role === "owner";
  const [tab, setTab] = useState("segments");
  const [modal, setModal] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [templateId, setTemplateId] = useState("proposal");
  const [templateEdit, setTemplateEdit] = useState<DocumentTemplate>();
  const [person, setPerson] = useState("");
  const [service, setService] = useState("");
  const [value, setValue] = useState("");
  const [conditions, setConditions] = useState("");
  const templates = s.tenant.settings?.templates?.length
    ? s.tenant.settings.templates
    : defaultTemplates;
  const segment = alive(s.segments).find((x) => x.id === selected);
  const members = segment ? segmentContacts(s, segment) : [];
  async function merge() {
    setBusy(true);
    try {
      if (w.userId) {
        const { error } = await supabase().rpc("atraction_merge_contacts", {
          source_id: source,
          target_id: target,
        });
        if (error) throw error;
        await w.read(w.userId);
      } else
        w.setState((state) => {
          if (!state) return state;
          const src = state.contacts.find((c) => c.id === source)!;
          const dst = state.contacts.find((c) => c.id === target)!;
          return {
            ...state,
            contacts: state.contacts.map((c) =>
              c.id === source
                ? {
                    ...c,
                    deleted_at: new Date().toISOString(),
                    merged_into: target,
                  }
                : c.id === target
                  ? {
                      ...c,
                      tags: [...new Set([...c.tags, ...src.tags])],
                      notes:
                        c.notes +
                        "\nCadastro mesclado: " +
                        src.name +
                        " / " +
                        src.phone +
                        "\n" +
                        src.notes,
                      custom_data: { ...src.custom_data, ...c.custom_data },
                    }
                  : c,
            ),
            contracts: state.contracts.map((x) =>
              x.contact_id === source ? { ...x, contact_id: target } : x,
            ),
            finance: state.finance.map((x) =>
              x.contact_id === source ? { ...x, contact_id: target } : x,
            ),
            deals: state.deals.map((x) =>
              x.contact_id === source
                ? { ...x, contact_id: target, owner_id: dst.owner_id }
                : x,
            ),
            messages: state.messages.map((x) =>
              x.contact_id === source
                ? { ...x, contact_id: target, owner_id: dst.owner_id }
                : x,
            ),
            activities: state.activities.map((x) =>
              x.contact_id === source
                ? {
                    ...x,
                    contact_id: target,
                    owner_id: dst.owner_id,
                    done:
                      x.done ||
                      !!(
                        x.purpose &&
                        state.activities.some(
                          (a) =>
                            a.contact_id === target &&
                            a.purpose === x.purpose &&
                            !a.done &&
                            !a.deleted_at,
                        )
                      ),
                  }
                : x,
            ),
            documents: state.documents.map((x) =>
              x.contact_id === source ? { ...x, contact_id: target } : x,
            ),
            chat_sessions: state.chat_sessions.map((x) =>
              x.contact_id === source ? { ...x, contact_id: target } : x,
            ),
          };
        });
      w.notify("Cadastros mesclados. Histórico reunido no cadastro principal.");
      setModal(null);
      setSource("");
      setTarget("");
    } catch {
      setError("Não foi possível mesclar. Confira os cadastros e sua conexão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        title="Ferramentas do seu negócio"
        subtitle="Organize públicos, personalize cadastros e prepare seus documentos."
      />
      <div className="management-actions hub-tabs">
        {[
          ["segments", "Segmentos"],
          ["settings", "Funis e campos"],
          ["templates", "Modelos e PDFs"],
          ...(manage ? [["merge", "Mesclar pessoas"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "primary" : "secondary"}
            onClick={() => {
              setTab(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "segments" && (
        <>
          <div className="management-actions">
            <button
              className="primary"
              disabled={s.role === "viewer"}
              onClick={() => setModal("segment")}
            >
              Salvar novo segmento
            </button>
            {alive(s.segments).map((x) => (
              <button
                className={selected === x.id ? "primary" : "secondary"}
                key={x.id}
                onClick={() => setSelected(x.id)}
              >
                {x.name}
              </button>
            ))}
          </div>
          {segment ? (
            <section className="card attribution">
              <h3>
                {segment.name} · {members.length} pessoas
              </h3>
              <p className="management-hint">
                A lista é recalculada com os dados atuais e respeita seu acesso.
              </p>
              {members.map((c) => (
                <button
                  className="segment-person"
                  key={c.id}
                  onClick={() => onCustomer(c)}
                >
                  <strong>{c.name}</strong>
                  <span>
                    {c.phone} · {c.source}
                  </span>
                </button>
              ))}
              <button
                className="text-button"
                disabled={w.busy || s.role === "viewer"}
                onClick={() =>
                  w.write("segments", {
                    ...segment,
                    deleted_at: new Date().toISOString(),
                  })
                }
              >
                Excluir segmento
              </button>
            </section>
          ) : (
            <Empty
              title="Seus públicos, sempre atualizados"
              text="Salve filtros de origem, etiquetas, relacionamento, inadimplência e renovação."
            />
          )}
        </>
      )}
      {tab === "settings" && (
        <div className="care-grid">
          <section className="card supplier-card">
            <h3>Funis de venda</h3>
            <p>
              O funil principal do nicho é preservado. Cada novo funil tem cinco
              etapas: quatro abertas e a última ganha.
            </p>
            {(s.tenant.settings?.pipelines || []).map((p) => (
              <p key={p.id}>
                <strong>{p.name}</strong>
                <br />
                {p.stages.join(" → ")}
              </p>
            ))}
            <button
              className="primary"
              disabled={!owner}
              onClick={() => setModal("pipeline")}
            >
              Novo funil personalizado
            </button>
          </section>
          <section className="card supplier-card">
            <h3>Campos do cadastro</h3>
            {(s.tenant.settings?.fields || []).map((f) => (
              <p key={f.id}>
                {f.label} ·{" "}
                {f.type === "date"
                  ? "Data"
                  : f.type === "number"
                    ? "Número"
                    : "Texto"}
              </p>
            ))}
            <button
              className="primary"
              disabled={!owner}
              onClick={() => setModal("field")}
            >
              Novo campo
            </button>
            <p className="management-hint">
              Proprietários configuram; a equipe utiliza os campos no cadastro
              de pessoas.
            </p>
          </section>
        </div>
      )}
      {tab === "templates" && (
        <section className="card attribution">
          <h3>Prepare uma proposta ou contrato</h3>
          <div className="form">
            <div className="form-grid">
              <label>
                Modelo
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Pessoa do documento
                <select
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                >
                  <option value="">Escolha</option>
                  {alive(s.contacts).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Preencher a partir de contrato
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const c = s.contracts.find((c) => c.id === e.target.value);
                    if (c) {
                      setPerson(c.contact_id);
                      setService(c.plan || c.title);
                      setValue(
                        money(c.amount_cents / 100) +
                          (c.mode === "monthly" ? " por mês" : ""),
                      );
                      setConditions(
                        `Vigência: ${c.start_date} a ${c.end_date}. ${c.notes}`,
                      );
                    }
                  }}
                >
                  <option value="">Preenchimento manual</option>
                  {alive(s.contracts).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Serviço / objeto
                <input
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
              </label>
              <label>
                Valor e forma de pagamento
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            </div>
            <label>
              Condições
              <textarea
                rows={4}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
              />
            </label>
            <div className="management-actions">
              <button
                className="primary"
                disabled={!person || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const t =
                      templates.find((t) => t.id === templateId) ||
                      templates[0];
                    const c = s.contacts.find((c) => c.id === person)!;
                    const vals: Record<string, string> = {
                      empresa: s.tenant.name,
                      cliente: c.name,
                      documento: c.document || "",
                      endereco: c.address || "",
                      data: today().split("-").reverse().join("/"),
                      servico: service,
                      valor: value,
                      condicoes: conditions,
                    };
                    downloadFile(
                      t.name + ".pdf",
                      await makePdf(
                        t.name,
                        t.body.replace(
                          /\{(\w+)\}/g,
                          (_, key) => vals[key] ?? `{${key}}`,
                        ),
                      ),
                    );
                  } catch {
                    setError("Não foi possível gerar o PDF.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Gerar PDF
              </button>
              <button
                className="secondary"
                disabled={!owner}
                onClick={() => {
                  setTemplateEdit(
                    templates.find((t) => t.id === templateId) || templates[0],
                  );
                  setModal("template");
                }}
              >
                Editar modelo
              </button>
              <button
                className="secondary"
                disabled={!owner}
                onClick={() => {
                  setTemplateEdit({
                    id: uuid(),
                    name: "",
                    body: defaultTemplates[0].body,
                  });
                  setModal("template");
                }}
              >
                Novo modelo
              </button>
            </div>
            <p className="management-hint">
              O PDF é gerado no navegador. Revise o conteúdo antes de
              compartilhar; não inclui assinatura eletrônica.
            </p>
          </div>
        </section>
      )}
      {tab === "merge" && manage && (
        <section className="card attribution">
          <h3>Reunir dois cadastros da mesma pessoa</h3>
          <div className="form-grid">
            <label>
              Cadastro que será arquivado
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Escolha</option>
                {alive(s.contacts).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cadastro principal que será mantido
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Escolha</option>
                {alive(s.contacts)
                  .filter((c) => c.id !== source)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button
            className="primary"
            disabled={!source || !target || source === target}
            onClick={() => {
              setError("");
              setModal("merge");
            }}
          >
            Ver prévia da mesclagem
          </button>
        </section>
      )}
      {modal === "merge" && (
        <Modal title="Confira a mesclagem" onClose={() => setModal(null)}>
          <div className="form">
            <p>
              <strong>{s.contacts.find((c) => c.id === source)?.name}</strong>{" "}
              será reunido em{" "}
              <strong>{s.contacts.find((c) => c.id === target)?.name}</strong>.
            </p>
            <p>
              {s.deals.filter((x) => x.contact_id === source).length} negócios,{" "}
              {s.contracts.filter((x) => x.contact_id === source).length}{" "}
              contratos,{" "}
              {s.finance.filter((x) => x.contact_id === source).length}{" "}
              lançamentos e seus atendimentos/documentos serão transferidos.
            </p>
            <p>
              Telefone, origem, consentimento e dados principais do cadastro de
              destino permanecem. Etiquetas e anotações serão reunidas. O
              cadastro de origem será arquivado e não poderá ser restaurado
              isoladamente. Essa mesclagem não tem desfazer automático.
            </p>
            <button className="primary" disabled={busy} onClick={merge}>
              Confirmar mesclagem
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
      {modal && modal !== "merge" && (
        <Modal
          title={
            modal === "segment"
              ? "Salvar segmento"
              : modal === "pipeline"
                ? "Novo funil"
                : modal === "field"
                  ? "Campo personalizado"
                  : "Modelo de documento"
          }
          onClose={() => setModal(null)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              const name = String(f.get("name")).trim();
              try {
                if (modal === "segment") {
                  const row: Segment = {
                    ...w.base(),
                    name,
                    rule: String(f.get("rule")),
                    value: String(f.get("value")),
                  };
                  if (await w.write("segments", row)) {
                    setSelected(row.id);
                    setModal(null);
                  }
                } else {
                  const settings = { ...s.tenant.settings };
                  if (modal === "pipeline")
                    settings.pipelines = [
                      ...(settings.pipelines || []),
                      {
                        id: uuid(),
                        name,
                        stages: Array.from({ length: 5 }, (_, i) =>
                          String(f.get("stage" + i)).trim(),
                        ),
                      },
                    ];
                  if (modal === "field")
                    settings.fields = [
                      ...(settings.fields || []),
                      {
                        id: uuid(),
                        label: name,
                        type: f.get("type") as "text" | "number" | "date",
                      },
                    ];
                  if (modal === "template") {
                    const t = {
                      id: templateEdit!.id,
                      name,
                      body: String(f.get("body")),
                    };
                    settings.templates = [
                      ...templates.filter((x) => x.id !== t.id),
                      t,
                    ];
                    setTemplateId(t.id);
                  }
                  if (await w.updateTenant({ settings })) setModal(null);
                }
              } catch {
                setError("Não foi possível salvar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nome
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={modal === "template" ? templateEdit?.name : ""}
              />
            </label>
            {modal === "segment" && (
              <>
                <label>
                  Filtro
                  <select name="rule">
                    <option value="all">Todas as pessoas</option>
                    <option value="source">Origem contém</option>
                    <option value="tag">Possui etiqueta</option>
                    <option value="lifecycle">
                      Relacionamento (prospect, customer ou inactive)
                    </option>
                    {manage && (
                      <>
                        <option value="overdue">Clientes inadimplentes</option>
                        <option value="renewals">
                          Contratos encerrando em até 30 dias
                        </option>
                      </>
                    )}
                  </select>
                </label>
                <label>
                  Valor do filtro
                  <input
                    name="value"
                    maxLength={200}
                    placeholder="Ex.: Instagram, VIP ou customer"
                  />
                </label>
              </>
            )}
            {modal === "pipeline" &&
              accountPack(s.tenant).stages.map((stage, i) => (
                <label key={i}>
                  {i === 4 ? "Etapa final — venda ganha" : `Etapa ${i + 1}`}
                  <input
                    name={"stage" + i}
                    required
                    maxLength={60}
                    defaultValue={stage}
                  />
                </label>
              ))}
            {modal === "field" && (
              <label>
                Tipo do campo
                <select name="type">
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                </select>
              </label>
            )}
            {modal === "template" && (
              <>
                <label>
                  Conteúdo
                  <textarea
                    name="body"
                    required
                    rows={12}
                    maxLength={20000}
                    defaultValue={templateEdit?.body}
                  />
                </label>
                <p>
                  Variáveis:{" "}
                  {
                    "{empresa}, {cliente}, {documento}, {endereco}, {data}, {servico}, {valor}, {condicoes}"
                  }
                  .
                </p>
              </>
            )}
            <button className="primary" disabled={busy || w.busy}>
              Salvar
            </button>
          </form>
        </Modal>
      )}
      {error && !modal && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
