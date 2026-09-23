"use client";
import { uuid } from "@/lib/demo";
import { ui } from "@/lib/pt-ui";
import { useEffect, useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Modal } from "./ui";
import { niches } from "@/data/niches";
import type { Niche } from "@/lib/types";
export function Auth({
  onClose,
  onReady,
  createCompany = false,
}: {
  onClose: () => void;
  createCompany?: boolean;
  onReady: (id: string, companyId?: string) => Promise<boolean>;
}) {
  const [companyId] = useState(uuid);
  const [step, setStep] = useState("login");
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [niche, setNiche] = useState<Niche>("outro");
  const [segmentLabel, setSegmentLabel] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState("");
  const finish = async (id: string) => {
    const token = new URLSearchParams(window.location.search).get("convite");
    if (token) {
      const { data: companyId, error } = await supabase().rpc(
        "atraction_accept_invite",
        {
          p_token: token,
        },
      );
      if (error) {
        setError(ui.este_convite_expirou_foi_usado_ou_pertence_a_outro_e_ma);
        throw new Error("invalid invitation");
      }
      window.history.replaceState({}, "", window.location.pathname);
      return onReady(id, companyId || undefined);
    }
    return onReady(id);
  };
  const afterAuth = async () => {
    const db = supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    setUid(user.id);
    if (createCompany) {
      setStep("business");
      return;
    }
    if (await finish(user.id)) onClose();
    else setStep("business");
  };
  useEffect(() => {
    afterAuth().catch(() => setError(ui.confira_sua_conexao_e_tente_novamente));
  }, []); // eslint-disable-line
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const db = supabase();
      if (step === "login") {
        const result = signup
          ? await db.auth.signUp({
              email: email.trim().toLowerCase(),
              password,
              options: { emailRedirectTo: window.location.origin },
            })
          : await db.auth.signInWithPassword({
              email: email.trim().toLowerCase(),
              password,
            });
        if (result.error) {
          setError(
            signup
              ? ui.nao_foi_possivel_criar_a_conta_use_uma_senha_com_pelo_m
              : ui.e_mail_ou_senha_nao_conferem_revise_e_tente_novamente,
          );
          return;
        }
        if (signup && !result.data.session) {
          setStep("confirm");
          return;
        }
        await afterAuth();
      } else if (step === "business") {
        const { error } = await db.from("atraction_tenants").insert({
          id: companyId,
          name,
          niche,
          owner_id: uid,
          niche_pack: {
            ...niches[niche],
            name:
              niche === "outro" && segmentLabel.trim()
                ? segmentLabel.trim()
                : niches[niche].name,
          },
          pack_version: 1,
          onboarding: {
            team_size: String(form.get("team_size")),
          },
        });
        if (error) {
          if (error.code === "23505") {
            const { data: existing } = await db
              .from("atraction_tenants")
              .select("id")
              .eq("id", companyId)
              .eq("owner_id", uid)
              .maybeSingle();
            if (existing) {
              if (await onReady(uid, companyId)) onClose();
              return;
            }
          }
          setError(ui.nao_foi_possivel_criar_seu_espaco_tente_novamente);
          return;
        }
        if (await onReady(uid, companyId)) onClose();
      }
    } catch {
      setError(ui.nao_conseguimos_conectar_confira_sua_internet_e_tente_n);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={
        step === "business"
          ? ui.seu_negocio_comeca_aqui
          : signup
            ? ui.crie_seu_espaco
            : ui.que_bom_ter_voce_por_aqui
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="form">
        {step === "login" && (
          <>
            <p>
              {signup
                ? "Crie um usuário somente se ainda não tiver cadastro."
                : "Já tem cadastro? Entre com o mesmo e-mail e senha. No primeiro acesso, você configura seu negócio ou entra pelo convite da sua equipe."}
            </p>
            <label>
              {ui.e_mail}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label>
              {ui.senha}
              <input
                type="password"
                minLength={signup ? 8 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Conectando…" : signup ? ui.criar_minha_conta : ui.entrar}
              <ArrowRight size={17} />
            </button>
            <button
              type="button"
              className="text-button center"
              onClick={() => setSignup(!signup)}
            >
              {signup
                ? ui.ja_tenho_uma_conta
                : ui.primeira_vez_criar_conta_gratuita}
            </button>
          </>
        )}
        {step === "confirm" && (
          <div className="empty">
            <Mail />
            <h3>{ui.confira_seu_e_mail}</h3>
            <p>{ui.abra_o_link_de_confirmacao_e_volte_para_entrar_na_sua_c}</p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setSignup(false);
                setStep("login");
              }}
            >
              {ui.voltar_para_entrar}
            </button>
          </div>
        )}
        {step === "business" && (
          <>
            <p>
              Seu usuário já está conectado. Cadastre sua empresa para começar.
              Você poderá cadastrar outras empresas depois. Para participar de
              uma equipe existente, abra o link de convite enviado pelo dono.
            </p>
            <label>
              {ui.nome_do_seu_negocio}
              <input
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              {ui.qual_e_o_seu_negocio}
              <select
                value={niche}
                onChange={(e) => setNiche(e.target.value as Niche)}
              >
                {Object.entries(niches).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            {niche === "outro" && (
              <label>
                Nome do segmento (opcional)
                <input
                  maxLength={120}
                  value={segmentLabel}
                  onChange={(e) => setSegmentLabel(e.target.value)}
                  placeholder="Ex.: Logística, turismo, indústria"
                />
              </label>
            )}
            <label>
              {ui.quantas_pessoas_atendem}
              <select name="team_size">
                <option>{ui.so_eu}</option>
                <option>{ui["2_a_5_pessoas"]}</option>
                <option>{ui["6_a_20_pessoas"]}</option>
              </select>
            </label>
            <button className="primary" disabled={busy}>
              {ui.abrir_meu_espaco}
              <ArrowRight size={17} />
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
