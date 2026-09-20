"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useState } from "react";
import { Users, Copy, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { State } from "@/lib/types";
import { Avatar, Modal } from "./ui";
export type TeamMember = { user_id: string; role: string; email: string };
const labels: Record<string, string> = {
  owner: ui.dono,
  manager: ui.gerente,
  agent: ui.atendente,
  viewer: ui.somente_leitura,
};
export function Team({
  state,
  notify,
}: {
  state: State;
  notify: (s: string) => void;
}) {
  const [change, setChange] = useState<{
    member: TeamMember;
    role: string;
  } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
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
      <p>{ui.convide_quem_cuida_dos_clientes_com_voce_ate_10_pessoas}</p>
      {isDemo ? (
        <div className="inline-notice">
          {ui.entre_em_uma_conta_real_para_convidar_sua_equipe}
        </div>
      ) : (
        <>
          {members.map((m) => (
            <div className="team-row" key={m.user_id}>
              <Avatar name={m.email} small />
              <span>
                <strong>{m.email}</strong>
                <small>{labels[m.role]}</small>
              </span>
              {state.role === "owner" && m.role !== "owner" ? (
                <select
                  aria-label={"Permissão de " + m.email}
                  value={m.role}
                  onChange={(e) =>
                    setChange({ member: m, role: e.target.value })
                  }
                >
                  <option value="manager">Gerente</option>
                  <option value="agent">Atendente</option>
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
                setLink("");
              }}
            >
              <Plus size={16} />
              {ui.convidar_uma_pessoa}
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
              Ao remover ou limitar à leitura, os contatos e tarefas atribuídos
              passam ao dono da conta.
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
              const { data, error } = await supabase()
                .from("atraction_invites")
                .insert({
                  tenant_id: state.tenant.id,
                  email: String(f.get("email")).trim().toLowerCase(),
                  role: f.get("role") as "manager" | "agent" | "viewer",
                })
                .select("token")
                .single();
              setBusy(false);
              if (error || !data) {
                notify(ui.nao_foi_possivel_preparar_o_convite_tente_novamente);
                return;
              }
              setLink(window.location.origin + "/?convite=" + data.token);
            }}
          >
            {!link ? (
              <>
                <label>
                  {ui.e_mail_da_pessoa}
                  <input name="email" type="email" required />
                </label>
                <label>
                  {ui.o_que_ela_pode_fazer}
                  <select name="role">
                    <option value="agent">
                      {ui.atendente_cuidar_das_pessoas_atribuidas}
                    </option>
                    <option value="manager">
                      {ui.gerente_cuidar_da_operacao_e_dos_resultados}
                    </option>
                    <option value="viewer">
                      {ui.somente_leitura_consultar_dados_e_resultados}
                    </option>
                  </select>
                </label>
                <p>
                  {ui.o_convite_vale_por_7_dias_e_so_funciona_com_esse_e_mail}
                </p>
                <button className="primary" disabled={busy}>
                  {ui.criar_link_de_convite}
                  <Users size={16} />
                </button>
              </>
            ) : (
              <>
                <div className="inline-notice">
                  {ui.convite_preparado_envie_o_link_a_pessoa_nenhum_e_mail_f}
                </div>
                <label>
                  {ui.link_do_convite}
                  <input readOnly value={link} />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(link)
                      .then(() => notify(ui.convite_copiado))
                      .catch(() => notify(ui.selecione_o_link_para_copiar))
                  }
                >
                  {ui.copiar_convite}
                  <Copy size={16} />
                </button>
              </>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
