"use client";
import { ui } from "@/lib/pt-ui";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { phone } from "@/lib/domain";
import { niches } from "@/data/niches";
import type { Niche } from "@/lib/types";
export function CapturePage({ slug }: { slug: string }) {
  const [info, setInfo] = useState<{
    name: string;
    title: string;
    niche: Niche;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase()
      .rpc("atraction_capture_info", { slug })
      .then(({ data, error }) => {
        if (!error) setInfo(data);
        setLoading(false);
      });
  }, [slug]);
  return (
    <main className="public-page">
      <section className="public-card">
        {loading ? (
          <p>{ui.preparando_uma_boa_conversa}</p>
        ) : !info ? (
          <>
            <h1>{ui.esta_pagina_esta_descansando}</h1>
            <p>{ui.peca_um_novo_link_ao_negocio_com_quem_voce_quer_convers}</p>
          </>
        ) : done ? (
          <>
            <CheckCircle2 size={42} color="#89b79a" />
            <h1>{ui.o_primeiro_passo_esta_dado}</h1>
            <p>
              {info.name}{" "}
              {ui.recebeu_seu_interesse_aguarde_um_contato_pelo_telefone_}
            </p>
          </>
        ) : (
          <>
            <span className="business-icon">
              {niches[info.niche]?.emoji || "✦"}
            </span>
            <small>{info.name}</small>
            <h1>{info.title}</h1>
            <p>{ui.deixe_seu_nome_e_telefone_vamos_adorar_conhecer_voce}</p>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setError("");
                const f = new FormData(e.currentTarget);
                if (f.get("website")) return;
                setBusy(true);
                try {
                  const normalized = phone(String(f.get("phone")));
                  const { error } = await supabase().rpc(
                    "atraction_capture_attributed",
                    {
                      slug,
                      person_name: String(f.get("name")),
                      person_phone: normalized,
                      accepted: true,
                      attribution: Object.fromEntries(
                        ["utm_source", "utm_campaign", "utm_medium", "ref"].map(
                          (key) => [
                            key,
                            new URLSearchParams(window.location.search).get(
                              key,
                            ) || "",
                          ],
                        ),
                      ),
                    },
                  );
                  if (error) throw error;
                  setDone(true);
                } catch {
                  setError(
                    ui.nao_foi_possivel_enviar_confira_o_telefone_com_ddd_e_te,
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {ui.seu_nome}
                <input
                  name="name"
                  required
                  maxLength={160}
                  autoComplete="name"
                />
              </label>
              <label>
                {ui.seu_telefone}
                <input
                  name="phone"
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder={ui["11_99999_9999"]}
                />
              </label>
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ display: "none" }}
              />
              <label className="checkbox">
                <input type="checkbox" required />
                {ui.autorizo}
                {info.name}{" "}
                {ui.a_entrar_em_contato_pelo_telefone_informado_sobre_meu_i}
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Enviando…" : ui.quero_saber_mais}
                <ArrowRight size={16} />
              </button>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <p className="muted">
                {ui.seus_dados_serao_disponibilizados_apenas_a_este_negocio}
              </p>
            </form>
          </>
        )}
        <div className="public-brand">{ui.feito_com_no_atraction}</div>
      </section>
    </main>
  );
}
