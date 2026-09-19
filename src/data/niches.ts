import type { Niche } from "@/lib/types";
export const niches: Record<
  Niche,
  {
    name: string;
    emoji: string;
    service: string;
    stages: string[];
    message: string;
    robots: string[];
  }
> = {
  estetica: {
    name: "Clínica de estética",
    emoji: "✦",
    service: "Avaliação personalizada",
    stages: [
      "Chegou agora",
      "Em conversa",
      "Avaliação marcada",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Que bom ter você por aqui. Vamos encontrar o melhor cuidado para você? Posso te ajudar a agendar uma avaliação.",
    robots: [
      "Boas-vindas com carinho",
      "Não deixar ninguém esperando",
      "Hora de cuidar de novo",
    ],
  },
  academia: {
    name: "Academia e estúdio",
    emoji: "↗",
    service: "Aula experimental",
    stages: [
      "Chegou agora",
      "Em conversa",
      "Aula marcada",
      "Escolhendo o plano",
      "Conquistado",
    ],
    message:
      "Oi, {nome}! Vamos dar o primeiro passo? Me conta seu objetivo e eu te ajudo a marcar uma aula experimental.",
    robots: [
      "Primeiro passo juntos",
      "Lembrar da aula experimental",
      "Vamos voltar ao ritmo?",
    ],
  },
  pet: {
    name: "Pet shop",
    emoji: "♡",
    service: "Banho e tosa",
    stages: [
      "Chegou agora",
      "Em conversa",
      "Horário reservado",
      "Confirmando o cuidado",
      "Conquistado",
    ],
    message:
      "Oi, {nome}! Vai ser um prazer cuidar do seu melhor amigo. Qual o nome dele e que cuidado vocês estão procurando?",
    robots: [
      "Boas-vindas para os dois",
      "Confirmar o próximo cuidado",
      "Saudade do seu melhor amigo",
    ],
  },
};

export function accountPack(tenant: import("@/lib/types").Tenant) {
  return tenant.niche_pack?.stages?.length
    ? tenant.niche_pack
    : niches[tenant.niche];
}
