# Estado de entrega — 20/09/2026

## Entregue e verificado

Publicado em https://atraction.vercel.app/. O núcleo também funciona localmente em Next.js/React/TypeScript e usa o Supabase fornecido para dados reais. As telas funcionam em 360 px. Existe demonstração isolada, 14 pacotes de nicho, cadastro e importação de contatos, quadro de negócios, histórico, rascunhos/notas, agenda, robôs de tarefas, captação com consentimento, resultados, autenticação/MFA, equipe, atribuição e lixeira.

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
| Arquivos | Importação CSV/XLSX de até 10.000 linhas/5 MB, primeira aba, prévia e validação. PDF a partir de modelos editáveis. Documentos privados PDF/PNG/JPEG na ficha. Agenda externa e áudio não integrados. |
| Equipe | Até 10 membros, convite por link entregue manualmente. Cada usuário pode cadastrar e participar de várias empresas. Dono altera papéis e remove acessos, com reatribuição ao dono para remoção ou leitura. |
| Atualização entre atendentes | Consulta a cada 30 s e ao voltar à janela. O chat usa consulta a cada 5 s enquanto a caixa/página está visível. |
| Escala | Leitura paginada até 50.000 itens por coleção no cliente. Ainda precisa de consultas/indicadores agregados no servidor e testes de carga antes de operar nesse volume. |
| Celular | Web responsiva com manifesto instalável. Não há aplicativo nativo nem operação offline de dados reais. |
| Lixeira | Restauração bloqueada após 30 dias. A remoção física e retenção legal não são automatizadas nesta versão. |
| Personalização | Campos texto/número/data, segmentos dinâmicos e múltiplos funis de cinco etapas (última ganha). Cadastro separado de empresas e grupos hierárquicos não implementados. |
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


## Expansão operacional de 20/09/2026

Todas as etapas autorizadas foram implementadas: segmentos por origem/etiqueta/relacionamento/inadimplência/renovação, Excel, exportação financeira, baixas parciais e estornos, gestão de equipe, aniversários, modelos PDF, caixa/bancos/transferências, funis/campos, mesclagem, chat nativo e DRE de caixa.

- **Financeiro:** cada baixa tem data, valor, conta opcional e identificador idempotente. Reajuste/cancelamento preservam parcelas com qualquer baixa. Saldos consideram a data inicial; transferências não são receita nem despesa. Não executa movimentações bancárias. A DRE é gerencial pelo regime de caixa, sem contabilidade fiscal ou emissão de nota.
- **Chat:** visitante inicia na página de captação ativa; equipe responde em Conversas. A sessão usa token aleatório com hash privado e validade de sete dias. Um novo visitante com o mesmo telefone nunca obtém conversas anteriores. Nome/telefone não são verificados. Limites: 30 sessões/hora/conta, 5 mensagens recebidas/minuto/sessão, 200 mensagens por sessão para novos envios do visitante e 500 mensagens/hora/conta. A caixa lista as 100 sessões mais recentes. Histórico anterior continua na ficha. Não há WhatsApp, e-mail, push ou atendimento automático.
- **Documentos:** modelos editáveis de proposta e registro contratual, geração local de PDF com dados escolhidos. Não inclui assinatura eletrônica nem envio ao cliente. Caracteres sem suporte na fonte são substituídos por `?`; português e acentos usuais são suportados.
- **Mesclagem:** somente dono/gestor, mesma conta, prévia e confirmação. Move vínculos e reúne notas/etiquetas/campos. Dados principais do destino prevalecem; origem arquivada preserva o registro anterior e não pode ser restaurada isoladamente. Sem desfazer automático.
- **Lembretes:** aniversários são sugestões internas nos próximos sete dias; não há disparo externo.

Validação: testes de navegador desktop/360 px incluindo Excel real, PDF, segmentos, campos, funil, transferências, mesclagem e chat; testes unitários de valores/DRE/datas/PDF; quatro suítes SQL transacionais com rollback. A interface de atendimento foi exercitada com fixtures de demonstração e o transporte público do chat com respostas simuladas no navegador; permissões e RPCs reais foram verificadas no Supabase. Login humano, e-mail de confirmação e entrega simultânea entre dois usuários reais não foram exercitados nesta rodada.

Nenhum plano, API paga ou serviço adicional foi contratado. O consumo continua sujeito aos planos existentes.


## Empresas e consolidação — 21/09/2026

- A barra lateral não mostra mais empresa/nicho fictícios como seletor na demonstração. Depois do login, lista as empresas acessíveis ao usuário, **Todas** e **Cadastrar empresa**.
- Vários cadastros de empresa e convites para empresas diferentes usam o mesmo usuário Auth. Cada empresa mantém equipe, permissões, clientes, financeiro e configurações próprios.
- **Todas** é uma visão consolidada de leitura com indicadores, comparativo por empresa, pessoas/clientes, negócios, agenda, lançamentos, fornecedores, contratos, contas, robôs, segmentos e sessões de chat. Cada registro identifica sua empresa e permite abri-la. Para cadastrar/editar, selecione a empresa.
- Financeiro consolidado considera somente empresas em que o usuário possui acesso financeiro. Recebimentos/pagamentos seguem a data de cada baixa; contas abertas seguem o vencimento. Cadastros repetidos em empresas distintas continuam separados e são contados por empresa.
- A lista consolidada exibe até 200 registros por vez; a busca filtra a coleção carregada. Continua valendo o limite de leitura do cliente de 50.000 itens por coleção. Configurações, equipe e captação são abertas por empresa.
- Seleção persistida por usuário, formulários reiniciados na troca, bloqueio de gravações na visão consolidada e proteção contra gravação de um registro na empresa errada. Nenhuma empresa existente foi migrada para outro proprietário.
- Testes SQL transacionais verificam dois cadastros para o mesmo dono, convites múltiplos, papéis distintos, MFA e impossibilidade de mover registros entre empresas. Navegador testa cadastro, alternância, gravação na empresa selecionada, consolidação e persistência em desktop/celular com API simulada.

### Segmentos de empresa — 21/09/2026

O cadastro oferece estética, academia, pet, fintech, software/SaaS, restaurante/bar/cafeteria, IA/automação, loja/e-commerce, consultoria, agência, educação, saúde, imobiliária e Outro/Geral com nome personalizado. O dono pode alterar o segmento em Configurações → Seu negócio. A mudança atualiza sugestões e mantém cadastros e funis personalizados; com negócios existentes, preserva as etapas do funil principal. Novas empresas começam na opção geral, sem presumir um setor.

### Receitas e despesas parceladas — 21/09/2026

No cadastro financeiro, informe valor total, quantidade de parcelas (1 a 60) e primeiro vencimento. A prévia mostra valores e vencimentos mensais. Centavos restantes são distribuídos nas primeiras parcelas; datas usam o dia original, limitado ao último dia de cada mês. Cada parcela vira um lançamento em aberto numerado no título, com cliente/fornecedor, categoria e grupo DRE preservados. Baixas e edições são individuais. O conjunto é inserido em uma única operação no banco; IDs estáveis evitam duplicação ao repetir uma tentativa sem resposta. Não há juros calculados automaticamente nem edição conjunta de séries.

Validação: 22 testes unitários, 30 testes de navegador desktop/celular e suíte SQL transacional de soma, gravação atômica e MFA.
