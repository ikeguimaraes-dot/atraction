"use client";
import { paid, payments } from "./payments";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { demo, base, uuid } from "./demo";
import type {
  State,
  Collection,
  Row,
  Tenant,
  Role,
  Contact,
  Account,
  Transfer,
  Segment,
  ChatSession,
  ChatMessage,
  CustomerDocument,
  Supplier,
  FinanceEntry,
  Deal,
  Activity,
  Message,
  Automation,
} from "./types";
import { pt } from "./pt";
const collections: Collection[] = [
  "contacts",
  "deals",
  "activities",
  "messages",
  "automations",
  "suppliers",
  "finance",
  "contracts",
  "documents",
  "accounts",
  "transfers",
  "segments",
  "chat_sessions",
  "chat_messages",
];
const storageKey = "atraction-demo-v1";
export function useWorkspace() {
  const [companies, setCompanies] = useState<(Tenant & { role: Role })[]>([]);
  const [allState, setAllState] = useState<State | null>(null);
  const [selection, setSelection] = useState("");
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const selectionRef = useRef("");
  const selectionUser = useRef("");
  const readVersion = useRef(0);
  const [state, setState] = useState<State | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [undo, setUndo] = useState<null | (() => Promise<void>)>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback(
    (message: string, reverse?: () => Promise<void>) => {
      setNotice(message);
      setUndo(() => reverse || null);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setNotice("");
        setUndo(null);
      }, 10000);
    },
    [],
  );
  const read = useCallback(async (uid: string, requested?: string) => {
    const version = ++readVersion.current;
    const db = supabase();
    const { data: members, error } = await db
      .from("atraction_members")
      .select("tenant_id,role")
      .eq("user_id", uid);
    if (error) throw error;
    if (!members?.length) {
      if (version === readVersion.current) {
        setCompanies([]);
        setAllState(null);
        setSelection("");
        selectionRef.current = "";
        setState(demo());
        setUserId(null);
      }
      return false;
    }
    const { data: tenants, error: tenantError } = await db
      .from("atraction_tenants")
      .select("*")
      .in(
        "id",
        members.map((m) => m.tenant_id),
      )
      .order("name");
    if (tenantError) throw tenantError;
    if (!tenants?.length)
      throw new Error(
        "Confirme sua proteção de acesso para abrir as empresas.",
      );
    const available = tenants.map((t) => ({
      ...t,
      role: members.find((m) => m.tenant_id === t.id)!.role as Role,
    }));
    let saved = "";
    try {
      saved = localStorage.getItem("atraction-company-" + uid) || "";
    } catch {}
    let chosen =
      requested ||
      (selectionUser.current === uid ? selectionRef.current : "") ||
      saved ||
      available[0].id;
    if (chosen !== "all" && !available.some((t) => t.id === chosen))
      chosen = available[0].id;
    const ids = chosen === "all" ? available.map((t) => t.id) : [chosen];
    const fetchRows = async (
      table: `atraction_${Collection}` | "atraction_events",
    ) => {
      const rows: unknown[] = [];
      for (let offset = 0; offset < 50000; offset += 1000) {
        const result = await db
          .from(table)
          .select("*")
          .in("tenant_id", ids)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 999);
        if (result.error) throw result.error;
        rows.push(...(result.data || []));
        if ((result.data?.length || 0) < 1000) break;
      }
      return rows;
    };
    const results = await Promise.all([
      ...collections.map((c) => fetchRows(`atraction_${c}`)),
      fetchRows("atraction_events"),
    ]);
    if (version !== readVersion.current) return true;
    const tenant = available.find((t) => t.id === chosen) || available[0];
    const next = {
      tenant,
      role: chosen === "all" ? "viewer" : tenant.role,
      events: results[collections.length],
    } as unknown as State;
    collections.forEach((c, i) => Object.assign(next, { [c]: results[i] }));
    setCompanies(available);
    setUserId(uid);
    selectionRef.current = chosen;
    selectionUser.current = uid;
    setSelection(chosen);
    if (chosen === "all") {
      setAllState(next);
      setState(next);
    } else {
      setState(next);
      setAllState(null);
    }
    try {
      localStorage.setItem("atraction-company-" + uid, chosen);
    } catch {}
    return true;
  }, []);
  const selectCompany = async (id: string) => {
    if (!userId || busy || switching) return false;
    const previous = selectionRef.current;
    selectionRef.current = id;
    switchingRef.current = true;
    setSwitching(true);
    setUndo(null);
    setNotice("");
    try {
      return await read(userId, id);
    } catch {
      selectionRef.current = previous;
      notify("Não foi possível abrir a empresa. Tente novamente.");
      return false;
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  };
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setState(
        saved
          ? {
              accounts: [],
              transfers: [],
              segments: [],
              chat_sessions: [],
              chat_messages: [],
              contracts: [],
              documents: [],
              suppliers: [],
              finance: [],
              ...JSON.parse(saved),
            }
          : demo(),
      );
    } catch {
      setState(demo());
    }
    if (new URLSearchParams(window.location.search).has("convite"))
      setAuthOpen(true);
    supabase()
      .auth.getUser()
      .then(async ({ data }) => {
        if (data.user) {
          const { data: aal } =
            await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
          const { data: member } = await supabase()
            .from("atraction_members")
            .select("role")
            .eq("user_id", data.user.id);
          if (
            aal?.currentLevel === "aal2" ||
            (member?.length &&
              member.every((m) => ["agent", "viewer"].includes(m.role)))
          ) {
            try {
              if (!(await read(data.user.id))) setAuthOpen(true);
            } catch {
              notify(
                "Não conseguimos carregar sua conta. Confira a conexão e entre novamente.",
              );
              setAuthOpen(true);
            }
          } else setAuthOpen(true);
        }
      });
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [read]);
  useEffect(() => {
    if (state?.tenant.id === "demo") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        notify(
          "O navegador não conseguiu guardar a demonstração. Libere espaço e tente novamente.",
        );
      }
    }
  }, [state, notify]);
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (!switchingRef.current && document.visibilityState === "visible")
        read(userId).catch(() =>
          notify("Não conseguimos atualizar seu espaço. Confira sua conexão."),
        );
    };
    const id = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [userId, read, notify]);
  const persist = async (c: Collection, rows: Row[]) => {
    if (!state || state.tenant.id === "demo") return;
    const db = supabase();
    for (const row of rows) {
      const exists = (state[c] as Row[]).some((r) => r.id === row.id);
      let result;
      switch (c) {
        case "chat_messages":
          result = exists
            ? await db
                .from("atraction_chat_messages")
                .update(row as ChatMessage)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_chat_messages")
                .insert(row as ChatMessage)
                .select("id");
          break;
        case "chat_sessions":
          result = exists
            ? await db
                .from("atraction_chat_sessions")
                .update(row as ChatSession)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_chat_sessions")
                .insert(row as ChatSession)
                .select("id");
          break;
        case "segments":
          result = exists
            ? await db
                .from("atraction_segments")
                .update(row as Segment)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_segments")
                .insert(row as Segment)
                .select("id");
          break;
        case "transfers":
          result = exists
            ? await db
                .from("atraction_transfers")
                .update(row as Transfer)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_transfers")
                .insert(row as Transfer)
                .select("id");
          break;
        case "accounts":
          result = exists
            ? await db
                .from("atraction_accounts")
                .update(row as Account)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_accounts")
                .insert(row as Account)
                .select("id");
          break;
        case "contracts":
          throw new Error("Use a jornada para alterar contratos.");
        case "documents":
          result = exists
            ? await db
                .from("atraction_documents")
                .update(row as CustomerDocument)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_documents")
                .insert(row as CustomerDocument)
                .select("id");
          break;
        case "finance":
          result = exists
            ? await db
                .from("atraction_finance")
                .update(row as FinanceEntry)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_finance")
                .insert(row as FinanceEntry)
                .select("id");
          break;
        case "suppliers":
          result = exists
            ? await db
                .from("atraction_suppliers")
                .update(row as Supplier)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_suppliers")
                .insert(row as Supplier)
                .select("id");
          break;
        case "contacts":
          result = exists
            ? await db
                .from("atraction_contacts")
                .update(row as Contact)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_contacts")
                .insert(row as Contact)
                .select("id");
          break;
        case "deals":
          result = exists
            ? await db
                .from("atraction_deals")
                .update(row as Deal)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_deals")
                .insert(row as Deal)
                .select("id");
          break;
        case "activities":
          result = exists
            ? await db
                .from("atraction_activities")
                .update(row as Activity)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_activities")
                .insert(row as Activity)
                .select("id");
          break;
        case "messages":
          result = exists
            ? await db
                .from("atraction_messages")
                .update(row as Message)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_messages")
                .insert(row as Message)
                .select("id");
          break;
        case "automations":
          result = exists
            ? await db
                .from("atraction_automations")
                .update(row as Automation)
                .eq("tenant_id", state.tenant.id)
                .eq("id", row.id)
                .select("id")
            : await db
                .from("atraction_automations")
                .insert(row as Automation)
                .select("id");
          break;
      }
      if (result.error) throw result.error;
      if (!result.data?.length) throw new Error("not saved");
    }
  };
  const write = async (c: Collection, row: Row) => {
    if (state && row.tenant_id !== state.tenant.id) return false;
    if (c === "finance" && "amount_cents" in row && "settled_date" in row) {
      const f = row as import("./types").FinanceEntry;
      if (!state?.finance.some((x) => x.id === f.id))
        row = {
          ...f,
          payments: f.settled_date
            ? [
                {
                  id: uuid(),
                  date: f.settled_date,
                  amount_cents: f.amount_cents,
                  account_id: null,
                },
              ]
            : [],
        };
    }
    if (
      !state ||
      busy ||
      switching ||
      selectionRef.current === "all" ||
      state.role === "viewer"
    )
      return false;
    if (
      [
        "finance",
        "suppliers",
        "contracts",
        "documents",
        "accounts",
        "transfers",
      ].includes(c) &&
      !["owner", "manager"].includes(state.role)
    )
      return false;
    if (
      c === "contacts" &&
      "phone" in row &&
      state.contacts.some(
        (r) => r.phone === (row as Contact).phone && r.id !== row.id,
      )
    ) {
      notify(pt.duplicate);
      return false;
    }
    if (c === "finance") {
      const f = row as FinanceEntry;
      if (paid(f) > f.amount_cents) {
        notify(
          "O valor não pode ser menor que as baixas. Estorne a baixa primeiro.",
        );
        return false;
      }
      row = {
        ...f,
        settled_date:
          paid(f) === f.amount_cents
            ? payments(f)
                .map((p) => p.date)
                .sort()
                .at(-1) || null
            : null,
      };
    }
    if (
      c === "contacts" &&
      (row as Contact).merged_into &&
      !(row as Contact).deleted_at
    ) {
      notify("Um cadastro mesclado não pode ser restaurado.");
      return false;
    }
    setBusy(true);
    const previous = (state[c] as Row[]).find((r) => r.id === row.id);
    const next = { ...row, updated_at: new Date().toISOString() };
    try {
      await persist(c, [next]);
      if (userId) await read(userId);
      else
        setState((s) => {
          if (!s) return s;
          const rows = s[c] as Row[];
          const wasWon =
            c === "deals" &&
            previous &&
            "stage" in previous &&
            previous.stage === 4 &&
            !previous.deleted_at;
          const isWon =
            c === "deals" &&
            "stage" in next &&
            next.stage === 4 &&
            !next.deleted_at;
          return {
            ...s,
            [c]: previous
              ? rows.map((r) => (r.id === next.id ? next : r))
              : [next, ...rows],
            events: [
              {
                id: uuid(),
                tenant_id: s.tenant.id,
                entity: c,
                entity_id: next.id,
                kind:
                  isWon && !wasWon
                    ? "won"
                    : wasWon && !isWon
                      ? "unwon"
                      : previous
                        ? "UPDATE"
                        : "INSERT",
                payload: {
                  ...next,
                  ...(c === "deals"
                    ? {
                        revenue_delta:
                          (isWon && "value" in next ? Number(next.value) : 0) -
                          (wasWon && previous && "value" in previous
                            ? Number(previous.value)
                            : 0),
                      }
                    : {}),
                },
                created_at: new Date().toISOString(),
              },
              ...s.events,
            ],
          };
        });
      if (c === "chat_messages") {
        notify("Resposta enviada pelo chat.");
        return true;
      }
      notify(next.deleted_at ? pt.deleted : pt.saved, async () => {
        const restored = previous || {
          ...next,
          deleted_at: new Date().toISOString(),
        };
        try {
          if (userId) {
            const { error } = await supabase()
              .from(`atraction_${c}`)
              .update(restored)
              .eq("tenant_id", state.tenant.id)
              .eq("id", row.id);
            if (error) throw error;
          } else await persist(c, [restored]);
          if (userId) await read(userId);
          else
            setState((s) =>
              s
                ? {
                    ...s,
                    [c]: (s[c] as Row[]).map((r) =>
                      r.id === row.id ? restored : r,
                    ),
                    events: s.events.filter(
                      (e) =>
                        !(
                          e.entity_id === row.id &&
                          e.created_at >= next.updated_at
                        ),
                    ),
                  }
                : s,
            );
          notify("Alteração desfeita.");
        } catch {
          notify(pt.error);
        }
      });
      return true;
    } catch (e) {
      notify(
        (e as { code?: string }).code === "23505"
          ? c === "contacts"
            ? pt.duplicate
            : c === "activities"
              ? "Esse acompanhamento já tem uma tarefa pendente."
              : "Esse registro já existe."
          : pt.error,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const bulk = async (c: Collection, rows: Row[]) => {
    if (state && rows.some((r) => r.tenant_id !== state.tenant.id))
      return false;
    if (
      !state ||
      busy ||
      switching ||
      selectionRef.current === "all" ||
      state.role === "viewer"
    )
      return false;
    if (
      [
        "finance",
        "suppliers",
        "contracts",
        "documents",
        "accounts",
        "transfers",
      ].includes(c) &&
      !["owner", "manager"].includes(state.role)
    )
      return false;
    setBusy(true);
    try {
      if (userId && c === "contacts") {
        const { error } = await supabase().rpc("atraction_import_contacts", {
          p_tenant: state.tenant.id,
          rows,
        });
        if (error) throw error;
      } else await persist(c, rows);
      if (userId) await read(userId);
      else
        setState((s) =>
          s
            ? {
                ...s,
                [c]: [...rows, ...s[c]],
                events: [
                  ...rows.map((row) => ({
                    id: uuid(),
                    tenant_id: s.tenant.id,
                    entity: c,
                    entity_id: row.id,
                    kind: "INSERT",
                    payload: row,
                    created_at: new Date().toISOString(),
                  })),
                  ...s.events,
                ],
              }
            : s,
        );
      notify(`${rows.length} pessoas importadas.`, async () => {
        if (userId) {
          const { error } = await supabase().rpc("atraction_undo_import", {
            p_tenant: state.tenant.id,
            ids: rows.map((r) => r.id),
          });
          if (error) throw error;
        } else
          await persist(
            c,
            rows.map((r) => ({ ...r, deleted_at: new Date().toISOString() })),
          );
        if (userId) await read(userId);
        else
          setState((s) =>
            s
              ? {
                  ...s,
                  [c]: (s[c] as Row[]).map((r) =>
                    rows.some((x) => x.id === r.id)
                      ? { ...r, deleted_at: new Date().toISOString() }
                      : r,
                  ),
                }
              : s,
          );
        notify("Importação desfeita.");
      });
      return true;
    } catch {
      notify(
        "A importação não foi salva. Confira telefones duplicados e tente novamente.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const updateTenant = async (patch: Partial<Tenant>) => {
    if (!state || switching || selectionRef.current === "all") return false;
    const before = state.tenant;
    try {
      if (userId) {
        const { error, data } = await supabase()
          .from("atraction_tenants")
          .update(patch)
          .eq("id", before.id)
          .select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("not updated");
      }
      setState((s) => (s ? { ...s, tenant: { ...s.tenant, ...patch } } : s));
      setCompanies((cs) =>
        cs.map((c) => (c.id === before.id ? { ...c, ...patch } : c)),
      );
      notify(pt.saved, async () => {
        if (userId) {
          const { error } = await supabase()
            .from("atraction_tenants")
            .update(before)
            .eq("id", before.id);
          if (error) {
            notify(pt.error);
            return;
          }
        }
        setState((s) => (s ? { ...s, tenant: before } : s));
        setCompanies((cs) =>
          cs.map((c) => (c.id === before.id ? { ...c, ...before } : c)),
        );
        notify("Alteração desfeita.");
      });
      return true;
    } catch {
      notify(pt.error);
      return false;
    }
  };
  const logout = async () => {
    const { error } = await supabase().auth.signOut({ scope: "local" });
    if (error) {
      notify("Não foi possível sair. Tente novamente.");
      return;
    }
    ++readVersion.current;
    selectionRef.current = "";
    selectionUser.current = "";
    setSelection("");
    setCompanies([]);
    setAllState(null);
    setUndo(null);
    setUserId(null);
    setState(demo());
    notify("Você saiu da conta. Esta é a demonstração.");
  };
  return {
    companies,
    allState,
    selection,
    allSelected: selection === "all",
    switching,
    selectCompany,
    state,
    setState,
    userId,
    notice,
    notify,
    undo,
    busy,
    write,
    bulk,
    updateTenant,
    logout,
    read,
    authOpen,
    setAuthOpen,
    base: () => base(state?.tenant.id, userId),
  };
}
