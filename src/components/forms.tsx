"use client";
import { ui } from "@/lib/pt-ui";
import { useState } from "react";
import { Upload, Check, FileSpreadsheet } from "lucide-react";
import { Modal, Avatar } from "./ui";
import { phone, parseContacts, alive, money } from "@/lib/domain";
import type {
  Contact,
  Deal,
  Activity,
  State,
  Base,
  Automation,
} from "@/lib/types";
import { today } from "@/lib/finance";
import { niches, accountPack } from "@/data/niches";
export function ContactForm({
  customer = false,
  contact,
  base,
  onSave,
  onClose,
}: {
  contact?: Contact;
  customer?: boolean;
  base: () => Base;
  onSave: (r: Contact) => Promise<boolean>;
  onClose: () => void;
}) {
  const [data, setData] = useState<Contact>(
    contact || {
      ...base(),
      lifecycle: customer ? "customer" : "prospect",
      customer_since: customer ? today() : null,
      document: "",
      address: "",
      name: "",
      phone: "",
      email: "",
      source: ui.cadastro,
      tags: [],
      notes: "",
      consent: false,
      consent_proof: "",
    },
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        contact
          ? ui.editar_pessoa
          : customer
            ? "Cadastrar cliente"
            : ui.vamos_conhecer_alguem
      }
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            if (await onSave({ ...data, phone: phone(data.phone) })) onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{ui.so_precisamos_de_nome_e_telefone_o_resto_pode_ficar_par}</p>
        <div className="form-grid">
          <label>
            {ui.nome}
            <input
              autoFocus
              required
              maxLength={160}
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
            />
          </label>
          <label>
            {ui.telefone_com_ddd}
            <input
              type="tel"
              required
              placeholder={ui["11_99999_9999"]}
              value={data.phone}
              onChange={(e) => setData({ ...data, phone: e.target.value })}
            />
          </label>
          <label>
            {ui.e_mail_2}
            <span>{ui.opcional}</span>
            <input
              type="email"
              value={data.email}
              onChange={(e) => setData({ ...data, email: e.target.value })}
            />
          </label>
          <label>
            {ui.como_chegou}
            <select
              value={data.source}
              onChange={(e) => setData({ ...data, source: e.target.value })}
            >
              {data.source &&
                ![
                  ui.cadastro,
                  ui.instagram,
                  ui.whatsapp,
                  ui.indicacao,
                  ui.site,
                  ui.planilha,
                  ui.pagina,
                ].some((source) => source === data.source) && (
                  <option>{data.source}</option>
                )}
              {[
                ui.cadastro,
                ui.instagram,
                ui.whatsapp,
                ui.indicacao,
                ui.site,
                ui.planilha,
                ui.pagina,
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Relacionamento
            <select
              value={data.lifecycle || "prospect"}
              onChange={(e) =>
                setData({
                  ...data,
                  lifecycle: e.target.value as Contact["lifecycle"],
                  customer_since:
                    e.target.value === "customer"
                      ? data.customer_since || today()
                      : data.customer_since,
                })
              }
            >
              <option value="prospect">Interessado</option>
              <option value="customer">Cliente ativo</option>
              <option value="inactive">Cliente inativo</option>
            </select>
          </label>
          <label>
            Cliente desde
            <input
              type="date"
              value={data.customer_since || ""}
              onChange={(e) =>
                setData({ ...data, customer_since: e.target.value || null })
              }
            />
          </label>
          <label>
            CPF / CNPJ
            <input
              maxLength={30}
              value={data.document || ""}
              onChange={(e) => setData({ ...data, document: e.target.value })}
            />
          </label>
          <label>
            Endereço
            <input
              maxLength={500}
              value={data.address || ""}
              onChange={(e) => setData({ ...data, address: e.target.value })}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Campanha
            <input
              maxLength={160}
              value={data.campaign || ""}
              onChange={(e) => setData({ ...data, campaign: e.target.value })}
            />
          </label>
          <label>
            Meio de captação
            <input
              maxLength={100}
              value={data.medium || ""}
              onChange={(e) => setData({ ...data, medium: e.target.value })}
            />
          </label>
          <label>
            Indicado por
            <input
              maxLength={160}
              value={data.referred_by || ""}
              onChange={(e) =>
                setData({ ...data, referred_by: e.target.value })
              }
            />
          </label>
          <label>
            Acompanhar a cada (dias)
            <input
              type="number"
              required
              min={1}
              max={365}
              value={data.retention_days || 30}
              onChange={(e) =>
                setData({ ...data, retention_days: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Último atendimento conhecido
          <input
            type="date"
            max={today()}
            value={data.last_contact_at?.slice(0, 10) || ""}
            onChange={(e) =>
              setData({
                ...data,
                last_contact_at: e.target.value
                  ? e.target.value + "T12:00:00Z"
                  : null,
              })
            }
          />
          <span>
            Opcional, para trazer o histórico de clientes que já eram atendidos
            antes do Atraction.
          </span>
        </label>
        <label>
          {ui.etiquetas}
          <span>{ui.separe_por_virgula}</span>
          <input
            value={data.tags.join(", ")}
            onChange={(e) =>
              setData({
                ...data,
                tags: e.target.value.split(",").map((t) => t.trim()),
              })
            }
          />
        </label>
        <label>
          {ui.anotacoes}
          <textarea
            rows={3}
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={data.consent}
            onChange={(e) => setData({ ...data, consent: e.target.checked })}
          />
          {ui.autorizou_receber_mensagens_pelo_whatsapp}
        </label>
        {data.consent && (
          <label>
            {ui.como_a_autorizacao_foi_recebida}
            <input
              required
              placeholder={ui.ex_formulario_preenchido_em_19_09}
              value={data.consent_proof}
              onChange={(e) =>
                setData({ ...data, consent_proof: e.target.value })
              }
            />
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            {ui.cancelar}
          </button>
          <button className="primary" disabled={busy}>
            {ui.salvar_pessoa}
            <Check size={16} />
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function DealForm({
  deal,
  state,
  base,
  onSave,
  onClose,
}: {
  deal?: Deal;
  state: State;
  base: () => Base;
  onSave: (r: Deal) => Promise<boolean>;
  onClose: () => void;
}) {
  const [data, setData] = useState(
    deal || {
      ...base(),
      contact_id: alive(state.contacts)[0]?.id || "",
      title: accountPack(state.tenant).service,
      value: 0,
      stage: 0,
      loss_reason: "",
    },
  );
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={deal ? ui.cuidar_deste_negocio : ui.uma_nova_oportunidade}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await onSave(data)) onClose();
          setBusy(false);
        }}
      >
        <label>
          {ui.pessoa}
          <select
            required
            value={data.contact_id}
            onChange={(e) => setData({ ...data, contact_id: e.target.value })}
          >
            <option value="">{ui.escolha_uma_pessoa}</option>
            {alive(state.contacts).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {ui.o_que_voce_esta_oferecendo}
          <input
            required
            value={data.title}
            onChange={(e) => setData({ ...data, title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            {ui.valor_em_reais}
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={data.value}
              onChange={(e) =>
                setData({ ...data, value: Number(e.target.value) })
              }
            />
          </label>
          <label>
            {ui.em_que_momento_esta}
            <select
              value={data.stage}
              onChange={(e) =>
                setData({ ...data, stage: Number(e.target.value) })
              }
            >
              {accountPack(state.tenant).stages.map((s, i) => (
                <option value={i} key={s}>
                  {s}
                </option>
              ))}
              <option value={-1}>{ui.nao_foi_desta_vez}</option>
            </select>
          </label>
        </div>
        {data.stage === -1 && (
          <label>
            {ui.o_que_aconteceu}
            <input
              required
              value={data.loss_reason}
              onChange={(e) =>
                setData({ ...data, loss_reason: e.target.value })
              }
            />
          </label>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            {ui.cancelar}
          </button>
          <button className="primary" disabled={busy || !data.contact_id}>
            {ui.salvar_negocio}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function TaskForm({
  state,
  base,
  onSave,
  onClose,
}: {
  state: State;
  base: () => Base;
  onSave: (r: Activity) => Promise<boolean>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={ui.tire_da_cabeca_deixe_com_a_gente} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          if (
            await onSave({
              ...base(),
              title: String(f.get("title")),
              contact_id: String(f.get("contact")) || null,
              kind: f.get("kind") as Activity["kind"],
              due_at: new Date(String(f.get("due"))).toISOString(),
              done: false,
            })
          )
            onClose();
          setBusy(false);
        }}
      >
        <label>
          {ui.o_que_precisa_fazer}
          <input
            name="title"
            required
            autoFocus
            placeholder={ui.ex_confirmar_a_avaliacao_da_mariana}
          />
        </label>
        <label>
          {ui.quando}
          <input
            name="due"
            type="datetime-local"
            required
            defaultValue={new Date(
              Date.now() - new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
          />
        </label>
        <div className="form-grid">
          <label>
            {ui.pessoa}
            <select name="contact">
              <option value="">{ui.sem_pessoa_vinculada}</option>
              {alive(state.contacts).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {ui.tipo}
            <select name="kind">
              <option value="task">{ui.tarefa}</option>
              <option value="appointment">{ui.compromisso}</option>
            </select>
          </label>
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            {ui.cancelar}
          </button>
          <button className="primary" disabled={busy}>
            {ui.guardar_na_agenda}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
export function ImportForm({
  state,
  base,
  onSave,
  onClose,
}: {
  state: State;
  base: () => Base;
  onSave: (r: Contact[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ReturnType<
    typeof parseContacts
  > | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={ui.suas_pessoas_todas_aqui} onClose={onClose} wide>
      <div className="form">
        <p>
          {ui.importe_um_arquivo_csv_da_sua_planilha_com_as_colunas}
          <strong>{ui.nome_2}</strong> {ui.e}
          <strong>{ui.telefone}</strong>
          {ui.e_mail_e_origem_sao_opcionais}
        </p>
        <label className="upload-zone">
          <Upload />
          <strong>{ui.escolher_planilha_csv}</strong>
          <span>{ui.ate_10_000_pessoas_maximo_de_5_mb}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 5 * 1024 * 1024) {
                  setPreview({
                    rows: [],
                    errors: [ui.escolha_um_arquivo_de_ate_5_mb],
                  });
                  return;
                }
                setPreview(parseContacts(await f.text(), state.contacts));
              }
            }}
          />
        </label>
        <a
          className="text-button"
          download="modelo-contatos.csv"
          href={
            "data:text/csv;charset=utf-8," +
            encodeURIComponent(
              ui.nome_telefone_email_origem_maria_exemplo_11999999999_in,
            )
          }
        >
          <FileSpreadsheet size={16} />
          {ui.baixar_planilha_de_exemplo}
        </a>
        {preview && (
          <>
            <div className="inline-notice">
              {preview.rows.length} {ui.pessoas_prontas_para_importar}
              {preview.errors.length} {ui.avisos}
            </div>
            {preview.errors.length > 0 && (
              <div className="import-errors">
                {preview.errors.slice(0, 30).map((x, i) => (
                  <p key={i}>{x}</p>
                ))}
              </div>
            )}
            <div className="preview-list">
              {preview.rows.slice(0, 5).map((r) => (
                <div key={r.phone}>
                  <Avatar name={r.name} small />
                  <strong>{r.name}</strong>
                  <span>{r.phone}</span>
                </div>
              ))}
            </div>
            <p className="muted">
              {ui.a_importacao_nao_registra_autorizacao_de_envio_registre}
            </p>
          </>
        )}
        <footer>
          <button className="secondary" onClick={onClose}>
            {ui.cancelar}
          </button>
          <button
            className="primary"
            disabled={!preview?.rows.length || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave(
                preview!.rows.map((r) => ({
                  ...base(),
                  ...r,
                  tags: [],
                  notes: "",
                  consent: false,
                  consent_proof: "",
                })),
              );
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {ui.importar}
            {preview?.rows.length || ""} {ui.pessoas}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
export function RobotForm({
  robot,
  state,
  base,
  onSave,
  onClose,
}: {
  robot?: Automation;
  state: State;
  base: () => Base;
  onSave: (r: Automation) => Promise<boolean>;
  onClose: () => void;
}) {
  const [data, setData] = useState(
    robot || {
      ...base(),
      name: ui.meu_lembrete,
      trigger: "contact_created" as const,
      delay_hours: 24,
      action: "create_task" as const,
      enabled: false,
    },
  );
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={ui.um_ajudante_do_seu_jeito} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await onSave({ ...data, enabled: false })) onClose();
          setBusy(false);
        }}
      >
        <label>
          {ui.nome_do_robo}
          <input
            value={data.name}
            required
            onChange={(e) => setData({ ...data, name: e.target.value })}
          />
        </label>
        <div className="robot-block">
          <span>{ui["1"]}</span>
          <label>
            {ui.quando_acontecer}
            <select
              value={data.trigger}
              onChange={(e) =>
                setData({
                  ...data,
                  trigger: e.target.value as Automation["trigger"],
                })
              }
            >
              <option value="contact_created">
                {ui.uma_pessoa_nova_chegar}
              </option>
              <option value="deal_stale">{ui.um_negocio_ficar_parado}</option>
            </select>
          </label>
        </div>
        <div className="robot-block">
          <span>{ui["2"]}</span>
          <label>
            {ui.esperar_quantas_horas}
            <input
              type="number"
              min={0}
              max={8760}
              required
              value={data.delay_hours}
              onChange={(e) =>
                setData({ ...data, delay_hours: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <div className="robot-block">
          <span>{ui["3"]}</span>
          <label>
            {ui.fazer_isto}
            <select>
              <option>{ui.criar_uma_tarefa_de_retorno}</option>
            </select>
          </label>
        </div>
        <div className="inline-notice">
          {ui.previa}
          {data.trigger === "contact_created"
            ? "quando uma nova pessoa chegar"
            : ui.quando_um_negocio_ficar_parado}
          {ui.criar_a_tarefa}
          {data.name}
          {ui.apos}
          {data.delay_hours}
          {ui.h_nenhuma_mensagem_sera_enviada}
        </div>
        <p className="muted">
          {ui.o_robo_e_salvo_desligado_voce_decide_quando_ativar}
        </p>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            {ui.cancelar}
          </button>
          <button className="primary" disabled={busy}>
            {ui.salvar_robo}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
