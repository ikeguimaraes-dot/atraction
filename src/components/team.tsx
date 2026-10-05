"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useState } from "react";
import { Users, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { State } from "@/lib/types";
import { Avatar, Modal } from "./ui";
export type TeamMember = { user_id: string; role: string; email: string };
const labels: Record<string, string> = {
  owner: ui.dono,
  manager: ui.gerente,
  agent: ui.assistente,
  viewer: ui.somente_leitura,
};
const access: Record<string, string> = {
  owner: "Acesso total, inclusive equipe e configurações da empresa.",
  manager: "Clientes, operação, contratos, fornecedores e financeiro.",
  agent: "Clientes e tarefas atribuídos, sem financeiro ou configurações.",
  viewer: "Consulta dos dados permitidos, sem fazer alterações.",
};
export function Team({
  state,
  userId,
  notify,
}: {
  state: State;
  userId: string | null;
  notify: (s: string) => void;
}) {
  const [change, setChange] = useState<{
    member: TeamMember;
    role: string;
  } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const isDemo = state.tenant.id === "demo";
  useEffect(() => {
    if (isDemo) return;
    supabase()
      .rpc("atraction_team", { p_tenant: state.tenant.id })
      .then(({ data, error }) => {
        if (!error) setMembers(data || []);
      });
  }, [state.tenant.id, isDemo]);
  return (
    <section className="card settings-card">
      <h2>{ui.sua_equipe_mais_proxima}</h2>
      <p>{ui.adicione_quem_trabalha_com_voce_ate_10_pessoas}</p>
      {isDemo ? (
        <div className="inline-notice">
          {ui.entre_em_uma_conta_real_para_adicionar_sua_equipe}
        </div>
      ) : (
        <>
          {members.map((m) => (
            <div className="team-row" key={m.user_id}>
              <Avatar name={m.email} small />
              <span>
                <strong>{m.email}</strong>
                <small>
                  {labels[m.role]} — {access[m.role]}
                </small>
              </span>
              {state.role === "owner" && m.user_id !== userId ? (
                <select
                  aria-label={"Permissão de " + m.email}
                  value={m.role}
                  onChange={(e) =>
                    setChange({ member: m, role: e.target.value })
                  }
                >
                  <option value="owner">Dono</option>
                  <option value="manager">Gerente</option>
                  <option value="agent">Assistente</option>
                  <option value="viewer">Somente leitura</option>
                  <option value="remove">Remover acesso</option>
                </select>
              ) : (
                <ShieldCheck size={16} />
              )}
            </div>
          ))}
          {state.role === "owner" && (
            <button
              className="secondary"
              onClick={() => {
                setOpen(true);
              }}
            >
              <Plus size={16} />
              {ui.adicionar_pessoa}
            </button>
          )}
        </>
      )}
      {change && (
        <Modal title="Alterar acesso da equipe" onClose={() => setChange(null)}>
          <div className="form">
            <p>
              {change.member.email}:{" "}
              {change.role === "remove"
                ? "remover acesso"
                : labels[change.role]}
              .
            </p>
            <p>
              Ao remover ou limitar à leitura, os clientes e tarefas atribuídos
              passam ao dono principal. A empresa sempre deve manter pelo menos
              um dono.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await supabase().rpc(
                  "atraction_member_role",
                  {
                    tenant: state.tenant.id,
                    member: change.member.user_id,
                    new_role: change.role,
                  },
                );
                if (error) notify("Não foi possível alterar o acesso.");
                else {
                  setMembers((ms) =>
                    change.role === "remove"
                      ? ms.filter((m) => m.user_id !== change.member.user_id)
                      : ms.map((m) =>
                          m.user_id === change.member.user_id
                            ? { ...m, role: change.role }
                            : m,
                        ),
                  );
                  setChange(null);
                  notify("Acesso atualizado.");
                }
                setBusy(false);
              }}
            >
              Confirmar alteração
            </button>
          </div>
        </Modal>
      )}
      {open && (
        <Modal
          title={ui.crescer_fica_melhor_em_equipe}
          onClose={() => setOpen(false)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              const email = String(f.get("email")).trim().toLowerCase();
              const role = String(f.get("role"));
              const { data: userId, error } = await supabase().rpc(
                "atraction_add_member",
                {
                  tenant: state.tenant.id,
                  member_email: email,
                  member_role: role,
                },
              );
              setBusy(false);
              if (error || !userId) {
                const message = error?.message || "";
                notify(
                  message.includes("account not found")
                    ? "Esse e-mail ainda não possui cadastro. Peça à pessoa para criar a conta primeiro."
                    : message.includes("already a member")
                      ? "Essa pessoa já faz parte da empresa."
                      : message.includes("team limit")
                        ? "A equipe já atingiu o limite de 10 pessoas."
                        : "Não foi possível adicionar a pessoa. Tente novamente.",
                );
                return;
              }
              setMembers((current) => [
                ...current,
                { user_id: userId, email, role },
              ]);
              setOpen(false);
              notify("Pessoa adicionada à empresa.");
            }}
          >
            <label>
              {ui.e_mail_da_pessoa}
              <input name="email" type="email" required />
            </label>
            <label>
              Cargo e acesso
              <select name="role" defaultValue="agent">
                <option value="owner">
                  Dono — acesso total e gestão da equipe
                </option>
                <option value="manager">
                  Gerente — operação, contratos e financeiro
                </option>
                <option value="agent">
                  Assistente — clientes e tarefas atribuídos
                </option>
              </select>
            </label>
            <p>
              A pessoa precisa já ter criado uma conta com esse mesmo e-mail.
            </p>
            <button className="primary" disabled={busy}>
              {busy ? "Adicionando…" : "Adicionar pessoa"}
              <Users size={16} />
            </button>
          </form>
        </Modal>
      )}
    </section>
  );
}
