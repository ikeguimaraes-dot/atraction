# Atraction

CRM com gestão operacional e financeira em português para pequenos negócios. Pessoas, negócios, conversas, agenda e lembretes em uma interface que começa pela pergunta: **o que eu preciso fazer hoje?**

Esta é a versão inicial operacional do núcleo do produto. Não é a conclusão das fases de WhatsApp, IA e aquisição descritas na visão de longo prazo. Veja o [estado de entrega](docs/delivery.md).

Publicado em **https://atraction.vercel.app/**.

## Rodar

Requer Node.js 22 ou superior.

```bash
npm ci
cp .env.example .env.local
# Preencha a chave pública do seu projeto Supabase em .env.local.
npm run dev
```

Abra a URL indicada no terminal. No ambiente de desenvolvimento original, o Atraction está na porta **3001** porque a 3000 já estava ocupada.

A demonstração aparece imediatamente, é identificada como exemplo e fica no navegador. O botão **Usar com meus clientes** abre o acesso à conta real. Dados reais são persistidos no Supabase; exemplos não são enviados ao banco. Não use a demonstração para guardar dados reais de clientes.

## O que está implementado

- Hoje com prioridades de retornos, contas, renovações e propostas paradas, além de conversas, tarefas e ganhos da semana.
- Pessoas: cadastro, busca, etiquetas, anotações, telefone normalizado e deduplicação por conta.
- Clientes: cadastro manual, ativos/inativos, documento, endereço e data de início, mantendo origem e histórico do contato.
- Financeiro: receitas, custos/despesas, contas a pagar/receber, vencimentos, baixas manuais, reabertura e filtros por cliente/fornecedor/período. Valores em centavos; venda ganha não é recebimento de caixa.
- Contratos e planos: venda vinculada, cobrança única/parcelada/mensal, prévia, geração atômica, reajuste, cancelamento e renovação.
- Pós-venda: intervalos de relacionamento, satisfação, agendamento de retornos e pedidos de indicação.
- Ficha completa: linha do tempo e documentos privados (PDF/PNG/JPEG, 5 MB, 20 arquivos/espaço).
- Campanhas: links UTM, atribuição na captação e relatório de contatos, conversão e recebimentos por origem/campanha.
- Fornecedores: cadastro, edição, arquivo e totais vinculados. Financeiro e fornecedores exclusivos de dono/gestor, incluindo auditoria.
- Importação CSV e Excel XLSX com prévia e erros por linha. Escrita atômica e reversão da importação.
- Negócios em quadro arrastável, com alternativa por seletor no celular, valores e motivo de perda.
- Chat próprio na página pública, com mensagens reais em Conversas; rascunhos e notas internas em área separada. **Sem integração com WhatsApp.**
- Agenda, tarefas, conclusão e reabertura.
- Robôs de três blocos que criam tarefas; execução no Postgres a cada minuto com idempotência.
- Página de captação, link e QR; consentimento expresso e limite de 30 cadastros por hora por conta.
- Indicadores por eventos, com correção ao desfazer conquista ou alterar o valor.
- Conta com autenticação Supabase e TOTP obrigatório para dono e gerente.
- Convite de equipe por link, limitado ao e-mail convidado; quatro papéis, alteração/remoção de acesso e reatribuição automática ao dono.
- Lixeira com restauração por 30 dias e desfazer por 10 segundos nas alterações operacionais.
- Pacotes de estética, academia e pet shop, copiados para a conta na criação.
- Registro imutável de alterações e de consentimentos, auditoria de exportações.

- Ferramentas: segmentos dinâmicos, funis personalizados, campos extras e mesclagem de pessoas com prévia.
- Propostas e contratos em PDF, com modelos editáveis e preenchimento pelos cadastros.
- Baixas parciais/estornos, contas de caixa/banco, saldos iniciais, transferências internas registradas, exportação CSV e DRE de caixa.
- Aniversários nos próximos sete dias aparecem nas prioridades internas.

## Usuários existentes

O login reutiliza os usuários de `auth.users` do projeto Supabase fornecido, com o mesmo e-mail e senha. Não copia senhas ou usuários e não importa permissões de outros aplicativos. A validação mínima de oito caracteres é para novos cadastros; no login, a senha existente é validada pelo Supabase.

Após entrar, dono/gerente confirma ou configura TOTP. Sem vínculo no Atraction, cadastra sua primeira empresa; para entrar em uma empresa existente, usa o convite nominal do dono. Pode cadastrar ou participar de várias empresas. O seletor da barra lateral mostra apenas empresas reais e a opção **Todas**, com visão consolidada de leitura. Cadastros e alterações são feitos dentro da empresa selecionada. A seleção persiste por usuário no navegador. `atraction_members` mantém as permissões próprias do produto. Usuários que só possuem autenticação por provedor externo, sem senha, não entram pelo formulário de senha até terem uma senha configurada no Auth. A demonstração local não é um espaço real.

## Banco

As migrações estão em `supabase/migrations`. O projeto informado já hospedava outros sistemas; por isso o Atraction usa tabelas com prefixo `atraction_` e funções internas no schema `atraction_private`. Não substitui tabelas, políticas ou funções dos demais produtos.

As treze migrações já foram aplicadas no projeto fornecido. **Não rode `db reset` ou `db push` indiscriminadamente nesse projeto compartilhado.** Para outro ambiente, revise e aplique apenas as migrações do Atraction. Os agendamentos exigem `pg_cron`, que já estava disponível no projeto original.

Antes de testar confirmação de e-mail em uma nova origem, adicione a origem aos Redirect URLs do Supabase Auth, preservando os endereços dos outros sistemas. Não alteramos a configuração global de e-mail/Auth do projeto compartilhado.

## Validação

```bash
npm run typecheck
npm test
npm run build
# Com o servidor rodando na porta 3001:
npm run test:e2e
```

`tests/multi-company-security.sql` valida múltiplas empresas do mesmo dono, convites para diferentes empresas, consolidação com papéis distintos e isolamento dos vínculos.

`tests/operations-security.sql` valida pagamentos parciais, estornos, idempotência, mesclagem, gestão de membros e chat público com isolamento por token, sempre com rollback.

`tests/journey-security.sql` valida contratos, idempotência, calendários, reajuste, renovação, cancelamento, arquivos privados e atribuição, com rollback.

`tests/finance-security.sql` valida isolamento financeiro, papéis, MFA, integridade de vínculos, baixas e auditoria; também termina com rollback.

`tests/security.sql` verifica RLS, MFA, bloqueio entre contas, importação atômica, auditoria, exportação, captação e fila. Usa usuários temporários em transação e termina com `ROLLBACK`. Rode em ambiente de teste; exige privilégio administrativo. O CI executa testes de unidade, build e navegador em desktop e 360 px, usando dados de demonstração e sem credenciais de produção.

## Custos e operação

Nenhuma API paga de IA/WhatsApp, assinatura, domínio, instância ou branch pago foi contratado. Os robôs usam o banco já fornecido. Publicado no projeto Vercel já existente, com build local e sem contratação de plano ou serviço adicional. O consumo futuro da hospedagem e do Supabase continua sujeito ao plano existente.

A operação comercial ainda precisa das integrações, validações e processos listados em [docs/delivery.md](docs/delivery.md). Backup com PITR, SLA, termos legais e atendimento a titulares não devem ser presumidos pela existência do código.
