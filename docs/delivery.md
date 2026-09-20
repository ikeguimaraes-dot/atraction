# Estado de entrega — 20/09/2026

## Entregue e verificado

Publicado em https://atraction.vercel.app/. O núcleo também funciona localmente em Next.js/React/TypeScript e usa o Supabase fornecido para dados reais. As telas funcionam em 360 px. Existe demonstração isolada, três pacotes de nicho, cadastro e importação de contatos, quadro de negócios, histórico, rascunhos/notas, agenda, robôs de tarefas, captação com consentimento, resultados, autenticação/MFA, equipe, atribuição e lixeira.

Foram executados testes unitários de normalização, CSV, deduplicação, exportação e indicadores; testes Playwright de uso em computador/celular; e testes transacionais de segurança no Supabase, sem deixar usuários ou dados de teste persistidos. O agendador `atraction-task-worker` registrou execução bem-sucedida. Verificações específicas de MFA usam claims de teste no banco; entrega de e-mail e inscrição TOTP ponta a ponta com uma conta humana não foram exercitadas.

O banco existente não foi reestruturado. Foram adicionados objetos exclusivos do Atraction e dois agendamentos próprios. O segundo remove apenas o histórico de cron desses agendamentos após 30 dias.

## Clientes e financeiro operacional

O escopo foi ampliado para CRM + gestão operacional, preservando inbound. Clientes existentes podem ser cadastrados manualmente sem criar uma venda fictícia. Pessoas existentes podem ser classificadas como cliente ativo/inativo sem duplicação. O cadastro mantém origem, anotações, negócios e tarefas, com documento, endereço e início do relacionamento.

Receitas e despesas têm categoria, vencimento, vínculo opcional com cliente/fornecedor e baixa manual com data. A visão mostra recebido, pago, saldo dos lançamentos, a receber e a pagar. Filtros seguem data da baixa para realizados e vencimento para abertos. Não inclui saldo inicial bancário; valores ganhos no funil não entram automaticamente no caixa. Valores armazenados em centavos, exclusão reversível e auditoria antes/depois. Donos e gestores com MFA acessam o financeiro; atendentes e leitores não recebem esses dados nem os respectivos eventos.

É controle financeiro operacional manual. Não inclui contabilidade fiscal, nota fiscal, conciliação bancária, transferências, baixa parcial, estoque ou folha. Contratos geram parcelas e mensalidades automaticamente dentro da vigência; a baixa de recebimento continua manual. Essas integrações não foram contratadas.

## Jornada conectada — seis melhorias

1. **Venda → operação:** ganhar um negócio oferece continuar a jornada; o usuário revisa cliente, plano e calendário antes de confirmar. Uma transação cria contrato, contas a receber e boas-vindas, promove o cliente e marca a venda ganha. Uma venda só pode originar um contrato. Repetir a mesma requisição não duplica parcelas.
2. **Contratos:** serviço/plano, vigência, cobrança única, parcelada ou mensal por 1 a 60 meses. Parcelas distribuem centavos sem diferença e vencimentos respeitam o fim de cada mês. Calendário completo gerado no cadastro; não depende de navegador aberto nem de um job de geração mensal. Reajustes atingem somente mensalidades em aberto a partir da data escolhida. Renovação confirmada cria um novo período. Cancelamento arquiva contas não pagas com vencimento de hoje em diante, mantendo dívidas anteriores e pagamentos. O cadastro operacional não é assinatura eletrônica nem emissão jurídica automática.
3. **Hoje:** prioridades para retornos vencidos, propostas sem avanço há sete dias, contas atrasadas e a vencer em sete dias, contratos a renovar em 30 dias e clientes sem interação dentro do intervalo definido. Links abrem a ficha ou o módulo responsável; tarefas também podem ser concluídas na ficha.
4. **Ficha completa:** linha do tempo cronológica de cadastro/origem, negócios/propostas, notas/conversas, tarefas/atendimentos, contratos, pagamentos e documentos. Documentos privados em PDF/PNG/JPEG, 5 MB por arquivo e 20 documentos por espaço, incluindo arquivados (máximo de 100 MB). Proprietário e gestores com MFA acessam arquivos; demonstração guarda até 1 MB/arquivo no navegador. Arquivo arquivado é ocultado e restaurável por 30 dias; não há expurgo físico automático. Testes de Storage verificam políticas em transação; upload completo via login humano não foi exercitado.
5. **Atribuição:** gerador de links UTM, captura pública de origem/meio/campanha/indicação, preservação da primeira atribuição em envio repetido. Relatório por origem/campanha separa contatos adquiridos e conversão desse grupo dos recebimentos realizados no período (que podem ser de clientes mais antigos). Sem pixels externos, rastreamento entre dispositivos, cálculo de ROI ou integração de mídia paga.
6. **Pós-venda:** intervalo por cliente, registro de atendimento, retorno agendado, satisfação de 0 a 10, atenção a notas até 6, renovação e indicação sugerida para notas 9/10 sem pedido recente. Tarefas abertas do mesmo tipo não se duplicam. São ações internas; contato, cobrança e pedido de indicação são realizados pela equipe, sem envio automático.

Validação desta expansão: testes unitários de centavos, calendários, atribuição e relacionamento; 26 testes Playwright em computador/celular; `tests/journey-security.sql` com contratos atômicos, idempotência, reajuste, renovação, cancelamento, isolamento de arquivos e captura atribuída. Todas as fixtures SQL terminam em rollback.

## Limites deliberados desta versão

| Área | Estado |
| --- | --- |
| WhatsApp oficial | Não conectado. As respostas são rascunhos. Não há webhook, recebimento, mídia, catálogo ou envio real. |
| IA | Modelos de mensagem locais por nicho. Não há chamadas de modelo, transcrição, qualificação ou atendimento autônomo. |
| Disparos | Não implementados. Não existe caminho de envio em massa ou envio cobrado. |
| Aquisição/prospecção | Página de captação e QR implementados. Não há raspagem, compra de listas, Places/Ads nem rede de indicação. |
| Robôs | Criam tarefas, com fila a cada minuto e até 100 execuções por ciclo. Uma execução por pessoa/robô; reativação não repete trabalhos já concluídos. Não enviam mensagens. Demonstração mostra configuração; execução real ocorre no banco. |
| Arquivos | Importação CSV de até 10.000 linhas/5 MB. Documentos privados PDF/PNG/JPEG na ficha. Importação direta de agenda, XLSX e áudio ainda não implementada. |
| Equipe | Até 10 membros, convite por link entregue manualmente. Cada usuário opera um espaço. Sem painel de troca de papel/remoção de membro nesta interface inicial. |
| Atualização entre atendentes | Consulta a cada 30 s e ao voltar à janela. Não é entrega Realtime em 5 s. |
| Escala | Leitura paginada até 50.000 itens por coleção no cliente. Ainda precisa de consultas/indicadores agregados no servidor e testes de carga antes de operar nesse volume. |
| Celular | Web responsiva com manifesto instalável. Não há aplicativo nativo nem operação offline de dados reais. |
| Lixeira | Restauração bloqueada após 30 dias. A remoção física e retenção legal não são automatizadas nesta versão. |
| Empresas, grupos e campos extras | Fora do núcleo implementado nesta entrega. |
| Cobrança da assinatura Atraction | Não implementada. O financeiro operacional é do negócio do cliente; não processa cobrança da assinatura SaaS. |

## Antes de uma operação comercial

1. Acompanhar consumo do projeto Vercel existente. O build é local, sem contratação adicional; a publicação usa a origem atraction.vercel.app.
2. Configurar redirect URLs e remetente/transporte de e-mail no Supabase sem substituir as configurações dos outros sistemas. Validar cadastro, confirmação e TOTP com conta real. O projeto compartilha o serviço Auth com outros aplicativos; novos usuários podem acionar triggers já existentes de perfil desses aplicativos.
3. Se autorizar custos no futuro, integrar a WhatsApp Business Platform com credenciais próprias, janela de atendimento, modelos aprovados, opt-in, opt-out, verificação de assinatura e idempotência de webhooks.
4. Só ativar modelos externos após implementar orçamento por conta, registro de execuções e limites de uso. Nenhuma chave de IA foi pedida ou usada.
5. Confirmar razão social/controlador, canal de privacidade, contratos, política de retenção, exportação completa do titular e remoção. O código não substitui esse trabalho.
6. Confirmar backup disponível no plano e testar restauração. PITR de sete dias não foi contratado nem habilitado.
7. Rodar pilotos observados, medir desempenho e acessibilidade, revisar recuperação de acesso e ampliar teste de carga. Não foram validados SLA, p95, importação de 10 mil linhas em dois minutos ou critérios de clientes pagantes do roadmap.

## Referências técnicas consultadas

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
- [Supabase changelog](https://supabase.com/changelog)
- [Next.js: Server e Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
