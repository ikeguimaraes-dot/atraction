"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useId, useRef, useState } from "react";
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
  manager:
    "Pode cadastrar e editar informações. Não pode dar baixa, estornar ou excluir registros.",
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
  const [newAccount, setNewAccount] = useState(true);
  const [error, setError] = useState("");
  const adding = useRef(false);
  const passwordHelp = useId();
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
                setError("");
                setNewAccount(true);
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
              if (adding.current) return;
              adding.current = true;
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              const email = String(f.get("email")).trim().toLowerCase();
              const role = String(f.get("role"));
              try {
                let userId: string;
                if (newAccount) {
                  if (
                    new TextEncoder().encode(String(f.get("password"))).length >
                    72
                  )
                    throw new Error(
                      "Use uma senha de até 72 bytes (acentos e símbolos podem ocupar mais de um byte).",
                    );
                  const result = await supabase().functions.invoke(
                    "atraction-create-member",
                    {
                      body: {
                        tenant: state.tenant.id,
                        email,
                        role,
                        password: String(f.get("password")),
                      },
                    },
                  );
                  if (result.error) {
                    let message =
                      "Não foi possível criar a pessoa. Confira sua conexão.";
                    const response = result.error.context;
                    if (response instanceof Response) {
                      const body = await response.json().catch(() => null);
                      if (typeof body?.error === "string") message = body.error;
                    }
                    throw new Error(message);
                  }
                  if (!result.data?.user_id)
                    throw new Error("Não foi possível confirmar o cadastro.");
                  userId = result.data.user_id;
                } else {
                  const result = await supabase().rpc("atraction_add_member", {
                    tenant: state.tenant.id,
                    member_email: email,
                    member_role: role,
                  });
                  if (result.error || !result.data) {
                    const message = result.error?.message || "";
                    throw new Error(
                      message.includes("account not found")
                        ? "Esse e-mail ainda não possui conta. Selecione Criar novo usuário."
                        : message.includes("already a member")
                          ? "Essa pessoa já faz parte da empresa."
                          : message.includes("team limit")
                            ? "A equipe já atingiu o limite de 10 pessoas."
                            : "Não foi possível adicionar a pessoa. Tente novamente.",
                    );
                  }
                  userId = result.data;
                }
                setMembers((current) => [
                  ...current,
                  { user_id: userId, email, role },
                ]);
                setOpen(false);
                notify("Pessoa cadastrada na empresa.");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                adding.current = false;
                setBusy(false);
              }
            }}
          >
            <label>
              Cadastro
              <select
                value={newAccount ? "new" : "existing"}
                disabled={busy}
                onChange={(e) => {
                  setNewAccount(e.target.value === "new");
                  setError("");
                }}
              >
                <option value="new">Criar novo usuário</option>
                <option value="existing">Adicionar usuário existente</option>
              </select>
            </label>
            <label>
              {ui.e_mail_da_pessoa}
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                disabled={busy}
              />
            </label>
            {newAccount && (
              <>
                <label>
                  Senha
                  <input
                    name="password"
                    type="password"
                    aria-describedby={passwordHelp}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    disabled={busy}
                  />
                </label>
                <small id={passwordHelp}>
                  Use pelo menos 8 caracteres. A pessoa entrará com este e-mail
                  e senha.
                </small>
              </>
            )}
            <label>
              Cargo e acesso
              <select name="role" defaultValue="agent" disabled={busy}>
                <option value="owner">
                  Dono — acesso total e gestão da equipe
                </option>
                <option value="manager">
                  Gerente — cadastros e edições, sem baixas ou exclusões
                </option>
                <option value="agent">
                  Assistente — clientes e tarefas atribuídos
                </option>
              </select>
            </label>
            <p>
              {newAccount
                ? "O usuário será criado e receberá acesso à empresa selecionada."
                : "A pessoa usará a senha que já possui. A senha existente não será alterada."}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
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
