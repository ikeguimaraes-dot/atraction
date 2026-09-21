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
  fintech: {
    name: "Fintech e serviços financeiros",
    emoji: "◈",
    service: "Apresentação da solução financeira",
    stages: [
      "Novo contato",
      "Entendendo a necessidade",
      "Solução apresentada",
      "Proposta em análise",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Qual necessidade financeira sua empresa quer resolver? Podemos apresentar como nossa solução funciona.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  software: {
    name: "Empresa de software / SaaS",
    emoji: "⌘",
    service: "Demonstração do software",
    stages: [
      "Novo contato",
      "Qualificação",
      "Demonstração realizada",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Que processo você gostaria de melhorar? Podemos agendar uma demonstração do nosso software.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  restaurante: {
    name: "Restaurante, bar e cafeteria",
    emoji: "◉",
    service: "Reserva ou proposta para evento",
    stages: [
      "Novo contato",
      "Em conversa",
      "Reserva ou evento planejado",
      "Confirmando detalhes",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Você procura uma reserva, um evento ou informações sobre nosso cardápio? Vamos ajudar.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  ia: {
    name: "Sistemas de IA e automação",
    emoji: "✧",
    service: "Diagnóstico de automação com IA",
    stages: [
      "Novo contato",
      "Diagnóstico",
      "Solução demonstrada",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Qual atividade você quer automatizar ou melhorar com IA? Podemos conversar sobre seu processo.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  ecommerce: {
    name: "Loja e e-commerce",
    emoji: "▣",
    service: "Atendimento de compra",
    stages: [
      "Novo contato",
      "Entendendo a procura",
      "Produto escolhido",
      "Pedido em confirmação",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! O que você está procurando? Podemos ajudar a escolher a melhor opção.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  consultoria: {
    name: "Consultoria e serviços profissionais",
    emoji: "◇",
    service: "Reunião de diagnóstico",
    stages: [
      "Novo contato",
      "Diagnóstico",
      "Escopo definido",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Conte um pouco sobre seu objetivo para prepararmos uma conversa de diagnóstico.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  agencia: {
    name: "Agência de marketing e comunicação",
    emoji: "↗",
    service: "Diagnóstico de marketing",
    stages: [
      "Novo contato",
      "Briefing",
      "Plano apresentado",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Qual resultado você quer alcançar com sua comunicação? Vamos entender seu momento.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  educacao: {
    name: "Educação e cursos",
    emoji: "◎",
    service: "Apresentação do curso",
    stages: [
      "Novo contato",
      "Entendendo o objetivo",
      "Curso apresentado",
      "Matrícula em análise",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! O que você gostaria de aprender? Podemos apresentar os cursos e tirar suas dúvidas.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  saude: {
    name: "Saúde e atendimento clínico",
    emoji: "✚",
    service: "Agendamento de atendimento",
    stages: [
      "Novo contato",
      "Em conversa",
      "Atendimento agendado",
      "Confirmando atendimento",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Podemos ajudar com horários e informações sobre nossos atendimentos.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  imobiliaria: {
    name: "Imobiliária e construção",
    emoji: "⌂",
    service: "Visita ou reunião comercial",
    stages: [
      "Novo contato",
      "Perfil definido",
      "Visita ou reunião",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Que tipo de imóvel ou projeto você procura? Vamos entender suas preferências.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
  outro: {
    name: "Outro / Geral",
    emoji: "○",
    service: "Apresentação de serviços",
    stages: [
      "Novo contato",
      "Em conversa",
      "Necessidade definida",
      "Proposta enviada",
      "Conquistado",
    ],
    message:
      "Olá, {nome}! Como podemos ajudar? Conte um pouco sobre o que você procura.",
    robots: [
      "Receber novos contatos",
      "Retomar conversas pendentes",
      "Acompanhar próximos passos",
    ],
  },
};

export function accountPack(tenant: import("@/lib/types").Tenant) {
  return tenant.niche_pack?.stages?.length
    ? tenant.niche_pack
    : niches[tenant.niche] || niches.outro;
}

// Existing opportunities keep their stage meanings when the company changes sector.
export function segmentPack(
  tenant: import("@/lib/types").Tenant,
  niche: Niche,
  label: string,
  hasDeals: boolean,
) {
  const preset = niches[niche];
  return {
    ...preset,
    name:
      niche === "outro" && label.trim()
        ? label.trim().slice(0, 120)
        : preset.name,
    stages: hasDeals ? [...accountPack(tenant).stages] : [...preset.stages],
  };
}
