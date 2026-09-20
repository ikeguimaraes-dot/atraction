"use client";
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
];
const storageKey = "atraction-demo-v1";
export function useWorkspace() {
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
  const read = useCallback(async (uid: string) => {
    const db = supabase();
    const { data: members, error } = await db
      .from("atraction_members")
      .select("tenant_id,role")
      .eq("user_id", uid)
      .limit(1);
    if (error) throw error;
    if (!members?.length) return false;
    const tid = members[0].tenant_id;
    const fetchRows = async (
      table: `atraction_${Collection}` | "atraction_events",
    ) => {
      const all: unknown[] = [];
      for (let offset = 0; offset < 50000; offset += 1000) {
        const result = await db
          .from(table)
          .select("*")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 999);
        if (result.error) return result;
        all.push(...(result.data || []));
        if ((result.data?.length || 0) < 1000) break;
      }
      return { data: all, error: null };
    };
    const results = await Promise.all([
      db.from("atraction_tenants").select("*").eq("id", tid).single(),
      ...collections.map((c) => fetchRows(`atraction_${c}`)),
      fetchRows("atraction_events"),
    ]);
    if (results.some((r) => r.error)) throw results.find((r) => r.error)!.error;
    const next = {
      tenant: results[0].data,
      role: members[0].role as Role,
      events: results[collections.length + 1].data,
    } as unknown as State;
    collections.forEach((c, i) =>
      Object.assign(next, { [c]: results[i + 1].data }),
    );
    setState(next);
    setUserId(uid);
    return true;
  }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      setState(
        saved ? { suppliers: [], finance: [], ...JSON.parse(saved) } : demo(),
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
            .eq("user_id", data.user.id)
            .limit(1);
          if (
            aal?.currentLevel === "aal2" ||
            member?.some((m) => ["agent", "viewer"].includes(m.role))
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
      if (document.visibilityState === "visible")
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
    if (!state || busy || state.role === "viewer") return false;
    if (
      ["finance", "suppliers"].includes(c) &&
      !["owner", "manager"].includes(state.role)
    )
      return false;
    if (
      c === "contacts" &&
      "phone" in row &&
      state.contacts.some((r) => r.phone === row.phone && r.id !== row.id)
    ) {
      notify(pt.duplicate);
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
        (e as { code?: string }).code === "23505" ? pt.duplicate : pt.error,
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const bulk = async (c: Collection, rows: Row[]) => {
    if (!state || busy || state.role === "viewer") return false;
    if (
      ["finance", "suppliers"].includes(c) &&
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
    if (!state) return;
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
        notify("Alteração desfeita.");
      });
    } catch {
      notify(pt.error);
    }
  };
  const logout = async () => {
    const { error } = await supabase().auth.signOut({ scope: "local" });
    if (error) {
      notify("Não foi possível sair. Tente novamente.");
      return;
    }
    setUserId(null);
    setState(demo());
    notify("Você saiu da conta. Esta é a demonstração.");
  };
  return {
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
