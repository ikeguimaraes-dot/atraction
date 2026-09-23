"use client";
import { uuid } from "@/lib/demo";
import { alive, money } from "@/lib/domain";
import { downloadFile, makePdf } from "@/lib/files";
import { today } from "@/lib/finance";
import type { DocumentTemplate } from "@/lib/types";
import type { useWorkspace } from "@/lib/use-workspace";
import { useState } from "react";
import { Modal, SectionTitle } from "./ui";
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
export function ToolsPanel({ w }: { w: Work }) {
  const s = w.state!;
  const owner = s.role === "owner";
  const [tab, setTab] = useState("templates");
  const [modal, setModal] = useState<string | null>(null);
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
  return (
    <>
      <SectionTitle
        title="Ferramentas do seu negócio"
        subtitle="Personalize cadastros e prepare seus documentos."
      />
      <div className="management-actions hub-tabs">
        {[
          ["settings", "Campos do cadastro"],
          ["templates", "Modelos e PDFs"],
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

      {tab === "settings" && (
        <div className="care-grid">
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
              de clientes.
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
                Cliente do documento
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

      {modal && (
        <Modal
          title={
            modal === "field" ? "Campo personalizado" : "Modelo de documento"
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
                const settings = { ...s.tenant.settings };
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
