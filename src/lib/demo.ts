import type { State, Niche, Base } from "./types";
import { niches } from "@/data/niches";
export const uuid = () => crypto.randomUUID();
export function base(tenant = "demo", owner: string | null = null): Base {
  return {
    id: uuid(),
    tenant_id: tenant,
    owner_id: owner,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    is_example: tenant === "demo",
  };
}
export function demo(niche: Niche = "estetica"): State {
  const now = new Date();
  const at = (hours: number) =>
    new Date(now.getTime() + hours * 3600000).toISOString();
  const names = [
    "Mariana Costa",
    "Rafael Oliveira",
    "Camila Santos",
    "Beatriz Lima",
    "Lucas Ferreira",
    "Juliana Alves",
    "Pedro Martins",
    "Fernanda Rocha",
  ];
  const sources = [
    "Instagram",
    "Indicação",
    "WhatsApp",
    "Instagram",
    "Site",
    "Indicação",
    "WhatsApp",
    "Instagram",
  ];
  const contacts = names.map((name, i) => ({
    ...base(),
    name,
    phone: `+55119999000${String(i).padStart(2, "0")}`,
    email: "",
    source: "Cadastro",
    lifecycle: "customer" as const,
    tags: [
      i % 3 === 0
        ? "Novo interesse"
        : i % 3 === 1
          ? "Cliente especial"
          : "Retorno",
    ],
    notes: "Contato fictício para você conhecer o ION.",
    consent: false,
    consent_proof: "",
  }));
  const deals = contacts.slice(0, 7).map((c, i) => ({
    ...base(),
    contact_id: c.id,
    title: i === 4 ? "Pacote de cuidados" : niches[niche].service,
    value: [350, 890, 450, 1200, 2400, 650, 980][i],
    stage: [0, 1, 2, 3, 4, 4, 1][i],
    loss_reason: "",
  }));
  const activities = contacts.slice(0, 4).map((c, i) => ({
    ...base(),
    contact_id: c.id,
    title: [
      "Retornar sobre a avaliação",
      "Confirmar o melhor horário",
      "Conversar sobre a proposta",
      "Dar boas-vindas",
    ][i],
    due_at: at(i - 1),
    done: false,
    kind: i === 1 ? ("appointment" as const) : ("task" as const),
  }));
  const messages = contacts.slice(0, 3).map((c, i) => ({
    ...base(),
    created_at: at(-[0.2, 0.5, 1][i]),
    contact_id: c.id,
    body: [
      "Oi! Queria saber mais sobre a avaliação 😊",
      "Perfeito! Vocês têm horário amanhã à tarde?",
      "Obrigada pelo carinho! Vou olhar a proposta.",
    ][i],
    direction: "in" as const,
    status: "example" as const,
  }));
  const automations = niches[niche].robots.map((name, i) => ({
    ...base(),
    name,
    trigger: i === 1 ? ("deal_stale" as const) : ("contact_created" as const),
    delay_hours: [0, 24, 720][i],
    action: "create_task" as const,
    enabled: false,
  }));
  const events = [
    ...contacts.map((c) => ({
      id: uuid(),
      tenant_id: "demo",
      entity: "contacts",
      entity_id: c.id,
      kind: "INSERT",
      payload: { source: c.source },
      created_at: at(-24),
    })),
    ...messages.map((m) => ({
      id: uuid(),
      tenant_id: "demo",
      entity: "messages",
      entity_id: m.id,
      kind: "INSERT",
      payload: { direction: "in", contact_id: m.contact_id },
      created_at: m.created_at,
    })),
    ...deals
      .filter((d) => d.stage === 4)
      .map((d) => ({
        id: uuid(),
        tenant_id: "demo",
        entity: "deals",
        entity_id: d.id,
        kind: "won",
        payload: { value: d.value },
        created_at: at(-20),
      })),
  ];
  return {
    tenant: {
      id: "demo",
      name: "Meu negócio",
      niche,
      owner_id: "demo",
      created_at: at(0),
      capture_enabled: false,
      capture_title: "Vamos conversar?",
      capture_slug: "demonstracao",
      animations: true,
    },
    role: "owner",
    accounts: [],
    transfers: [],
    segments: [],
    chat_sessions: [],
    chat_messages: [],
    contracts: [],
    documents: [],
    suppliers: [],
    finance: [],
    contacts,
    deals,
    activities,
    messages,
    automations,
    events,
  };
}
