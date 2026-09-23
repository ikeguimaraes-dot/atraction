"use client";
import { alive, phone } from "@/lib/domain";
import { today } from "@/lib/finance";
import { ui } from "@/lib/pt-ui";
import type { Activity, Base, Contact, State, Tenant } from "@/lib/types";
import { Check } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui";
export function ContactForm({
  tenant,
  customer = false,
  contact,
  base,
  onSave,
  onClose,
}: {
  tenant?: Tenant;
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
          ? "Editar cliente"
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
        <label>
          Aniversário
          <input
            type="date"
            max={today()}
            value={data.birthday || ""}
            onChange={(e) =>
              setData({ ...data, birthday: e.target.value || null })
            }
          />
        </label>
        {(tenant?.settings?.fields || []).map((field) => (
          <label key={field.id}>
            {field.label}
            <input
              type={field.type}
              value={data.custom_data?.[field.id] || ""}
              maxLength={1000}
              onChange={(e) =>
                setData({
                  ...data,
                  custom_data: {
                    ...data.custom_data,
                    [field.id]: e.target.value,
                  },
                })
              }
            />
          </label>
        ))}
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
              <option value="prospect">Cadastro anterior</option>
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
            Salvar cliente
            <Check size={16} />
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
