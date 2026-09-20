"use client";
import { useRef, useState } from "react";
import type { useWorkspace } from "./use-workspace";
import type { Contract } from "./types";
import { supabase } from "./supabase";
import { base, uuid } from "./demo";
import { schedule } from "./journey";
import { paid } from "./payments";
import { today } from "./finance";
export function useJourney(w: ReturnType<typeof useWorkspace>) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
      if (w.userId) await w.read(w.userId);
      w.notify("Jornada atualizada.");
      return true;
    } catch {
      w.notify(
        "Não foi possível concluir. Confira a conexão, os dados e se a venda já possui contrato.",
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const create = (c: Contract) =>
    run(async () => {
      if (
        w.state!.contracts.some(
          (x) =>
            (c.deal_id && x.deal_id === c.deal_id) ||
            (c.renews_id && x.renews_id === c.renews_id),
        )
      )
        throw new Error("Duplicate");
      if (w.userId) {
        const { error } = await supabase().rpc("atraction_create_contract", {
          p: { ...c },
        });
        if (error) throw error;
      } else
        w.setState((s) => {
          if (!s || s.contracts.some((x) => x.id === c.id)) return s;
          const person = s.contacts.find((p) => p.id === c.contact_id)!;
          const onboarding = s.activities.some(
            (a) =>
              a.contact_id === person.id &&
              a.purpose === "onboarding" &&
              !a.done &&
              !a.deleted_at,
          )
            ? []
            : [
                {
                  ...base(s.tenant.id, person.owner_id),
                  contact_id: person.id,
                  purpose: "onboarding" as const,
                  title: "Dar boas-vindas e combinar próximos passos",
                  due_at: c.start_date + "T12:00:00Z",
                  done: false,
                  kind: "task" as const,
                },
              ];
          return {
            ...s,
            contracts: [c, ...s.contracts],
            finance: [...schedule(c), ...s.finance],
            contacts: s.contacts.map((p) =>
              p.id === c.contact_id
                ? {
                    ...p,
                    lifecycle: "customer",
                    customer_since: p.customer_since || c.start_date,
                  }
                : p,
            ),
            deals: s.deals.map((d) =>
              d.id === c.deal_id
                ? { ...d, stage: 4, updated_at: new Date().toISOString() }
                : d,
            ),
            activities: [...onboarding, ...s.activities],
            events: [
              {
                id: uuid(),
                tenant_id: s.tenant.id,
                entity: "contracts",
                entity_id: c.id,
                kind: "INSERT",
                payload: { contact_id: c.contact_id, title: c.title },
                created_at: new Date().toISOString(),
              },
              ...(c.deal_id &&
              s.deals.find((d) => d.id === c.deal_id)?.stage !== 4
                ? [
                    {
                      id: uuid(),
                      tenant_id: s.tenant.id,
                      entity: "deals",
                      entity_id: c.deal_id,
                      kind: "won",
                      payload: {
                        revenue_delta:
                          s.deals.find((d) => d.id === c.deal_id)?.value || 0,
                      },
                      created_at: new Date().toISOString(),
                    },
                  ]
                : []),
              ...s.events,
            ],
          };
        });
    });
  const action = (
    c: Contract,
    action: "adjust" | "cancel",
    amount: number,
    effective: string,
  ) =>
    run(async () => {
      if (w.userId) {
        const { error } = await supabase().rpc("atraction_contract_action", {
          contract: c.id,
          action,
          amount,
          effective,
        });
        if (error) throw error;
      } else
        w.setState((s) =>
          !s
            ? s
            : {
                ...s,
                contracts: s.contracts.map((x) =>
                  x.id === c.id
                    ? {
                        ...x,
                        amount_cents:
                          action === "adjust" ? amount : x.amount_cents,
                        status: action === "cancel" ? "cancelled" : x.status,
                        updated_at: new Date().toISOString(),
                      }
                    : x,
                ),
                finance: s.finance.map((f) =>
                  f.contract_id === c.id &&
                  !f.deleted_at &&
                  !f.settled_date &&
                  paid(f) === 0 &&
                  f.due_date >= effective
                    ? {
                        ...f,
                        ...(action === "adjust"
                          ? { amount_cents: amount }
                          : { deleted_at: new Date().toISOString() }),
                      }
                    : f,
                ),
                events: [
                  {
                    id: uuid(),
                    tenant_id: s.tenant.id,
                    entity: "contracts",
                    entity_id: c.id,
                    kind: action,
                    payload: { amount, effective, contact_id: c.contact_id },
                    created_at: new Date().toISOString(),
                  },
                  ...s.events,
                ],
              },
        );
    });
  return { busy, create, action };
}
