"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { phone } from "@/lib/domain";
import { uuid } from "@/lib/demo";
import type { useWorkspace } from "@/lib/use-workspace";
import { SectionTitle, Empty } from "./ui";
export function PublicChat({ slug }: { slug: string }) {
  const key = "atraction-chat-" + slug;
  const [session, setSession] = useState<{ id: string; token: string } | null>(
    null,
  );
  const [messages, setMessages] = useState<
    { id: string; body: string; direction: string; created_at: string }[]
  >([]);
  const [closed, setClosed] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(uuid);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setSession(JSON.parse(saved));
    } catch {}
  }, [key]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const { data, error } = await supabase().rpc("atraction_chat_poll", {
        session: session.id,
        token: session.token,
      });
      if (!active) return;
      if (error) {
        setError(
          "Não foi possível atualizar. Se a sessão expirou, inicie uma nova conversa.",
        );
        return;
      }
      setMessages(data.messages);
      setClosed(data.closed);
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session]);
  return (
    <section className="public-card live-chat">
      <h2>Converse com a equipe</h2>
      <p>
        Atendimento pelo chat do site. A equipe responde quando estiver
        disponível.
      </p>
      {!session ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const { data, error } = await supabase().rpc(
                "atraction_chat_start",
                {
                  slug,
                  person_name: String(f.get("name")),
                  person_phone: phone(String(f.get("phone"))),
                  accepted: true,
                },
              );
              if (error) throw error;
              localStorage.setItem(key, JSON.stringify(data));
              setSession(data);
            } catch {
              setError(
                "Não foi possível iniciar. Confira o telefone e tente novamente mais tarde.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Seu nome no chat
            <input name="name" required maxLength={160} />
          </label>
          <label>
            Telefone para contato
            <input name="phone" type="tel" required />
          </label>
          <label className="checkbox">
            <input required type="checkbox" />
            Autorizo o uso desses dados para este atendimento.
          </label>
          <button className="primary" disabled={busy}>
            Iniciar conversa
          </button>
        </form>
      ) : (
        <>
          <div className="chat-feed" aria-live="polite">
            {messages.map((m) => (
              <div
                className={`chat-bubble ${m.direction === "in" ? "visitor" : "team"}`}
                key={m.id}
              >
                <small>{m.direction === "in" ? "Você" : "Equipe"}</small>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          {closed ? (
            <p>A equipe encerrou esta conversa.</p>
          ) : (
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  const { error } = await supabase().rpc(
                    "atraction_chat_send",
                    {
                      session: session.id,
                      token: session.token,
                      body,
                      request_id: requestId,
                    },
                  );
                  if (error) throw error;
                  setBody("");
                  setRequestId(uuid());
                  const { data } = await supabase().rpc("atraction_chat_poll", {
                    session: session.id,
                    token: session.token,
                  });
                  if (data) setMessages(data.messages);
                } catch {
                  setError(
                    "Não foi possível enviar. Aguarde um minuto e tente novamente.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Sua mensagem
                <textarea
                  required
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button className="primary" disabled={busy || !body.trim()}>
                Enviar mensagem
              </button>
            </form>
          )}
          <button
            className="text-button"
            onClick={() => {
              localStorage.removeItem(key);
              setSession(null);
              setMessages([]);
              setError("");
              setClosed(false);
            }}
          >
            Iniciar nova conversa
          </button>
          <small>
            Esta sessão fica disponível neste navegador por até sete dias. Uma
            nova conversa não recupera o histórico de outras sessões.
          </small>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
export function SiteInbox({ w }: { w: ReturnType<typeof useWorkspace> }) {
  const s = w.state!;
  const [selected, setSelected] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(uuid);
  const sessions = s.chat_sessions
    .filter((c) => !c.deleted_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = sessions.find((c) => c.id === selected) || sessions[0];
  const list = s.chat_messages
    .filter((m) => m.session_id === current?.id)
    .sort(
      (a, b) =>
        a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    );
  useEffect(() => {
    if (!w.userId) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const db = supabase();
      const { data: sessions, error } = await db
        .from("atraction_chat_sessions")
        .select("*")
        .eq("tenant_id", s.tenant.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error || !active) return;
      const id = selected || sessions[0]?.id;
      const result = id
        ? await db
            .from("atraction_chat_messages")
            .select("*")
            .eq("tenant_id", s.tenant.id)
            .eq("session_id", id)
            .order("created_at")
            .limit(200)
        : { data: [], error: null };
      if (active && !result.error)
        w.setState((prev) =>
          prev
            ? {
                ...prev,
                chat_sessions: sessions,
                chat_messages: [
                  ...prev.chat_messages.filter((m) => m.session_id !== id),
                  ...(result.data || []),
                ],
              }
            : prev,
        );
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [w.userId, s.tenant.id, selected]);
  return (
    <section className="card attribution">
      <SectionTitle
        title="Conversas do site"
        subtitle="Mensagens reais da sua página de captação. Nome e telefone são informados pelo visitante, sem verificação de identidade."
      />
      {sessions.length ? (
        <div className="site-inbox">
          <aside>
            {sessions.map((c) => (
              <button
                className={current?.id === c.id ? "active" : ""}
                key={c.id}
                onClick={() => {
                  setSelected(c.id);
                  setBody("");
                  setRequestId(uuid());
                }}
              >
                <strong>{c.visitor_name}</strong>
                <small>
                  {c.closed ? "Encerrada" : "Aberta"} ·{" "}
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </small>
              </button>
            ))}
          </aside>
          <div>
            <div className="management-actions">
              <h3>{current.visitor_name}</h3>
              <button
                className="secondary"
                disabled={w.busy || s.role === "viewer"}
                onClick={() =>
                  w.write("chat_sessions", {
                    ...current,
                    closed: !current.closed,
                  })
                }
              >
                {current.closed ? "Reabrir chat" : "Encerrar chat"}
              </button>
            </div>
            <div className="chat-feed" aria-live="polite">
              {list.map((m) => (
                <div
                  className={`chat-bubble ${m.direction === "out" ? "team" : "visitor"}`}
                  key={m.id}
                >
                  <small>
                    {m.direction === "out" ? "Equipe" : current.visitor_name}
                  </small>
                  <p>{m.body}</p>
                  <small>
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              ))}
            </div>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  if (
                    await w.write("chat_messages", {
                      ...w.base(),
                      session_id: current.id,
                      body: body.trim(),
                      direction: "out",
                      client_id: requestId,
                    })
                  ) {
                    setBody("");
                    setRequestId(uuid());
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Resposta pelo chat
                <textarea
                  required
                  maxLength={2000}
                  disabled={current.closed || s.role === "viewer"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  w.busy ||
                  !body.trim() ||
                  current.closed ||
                  s.role === "viewer"
                }
              >
                Enviar resposta no chat
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Empty
          title="Seu chat está pronto para receber"
          text="Ative a página em Atrair clientes e compartilhe o link. As conversas iniciadas nela aparecerão aqui."
        />
      )}
    </section>
  );
}
