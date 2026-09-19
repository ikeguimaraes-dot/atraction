# Estado de entrega — 19/09/2026

## Entregue e verificado

O núcleo funciona localmente em Next.js/React/TypeScript e usa o Supabase fornecido para dados reais. As telas funcionam em 360 px. Existe demonstração isolada, três pacotes de nicho, cadastro e importação de contatos, quadro de negócios, histórico, rascunhos/notas, agenda, robôs de tarefas, captação com consentimento, resultados, autenticação/MFA, equipe, atribuição e lixeira.

Foram executados testes unitários de normalização, CSV, deduplicação, exportação e indicadores; testes Playwright de uso em computador/celular; e testes transacionais de segurança no Supabase, sem deixar usuários ou dados de teste persistidos. O agendador `atraction-task-worker` registrou execução bem-sucedida. Verificações específicas de MFA usam claims de teste no banco; entrega de e-mail e inscrição TOTP ponta a ponta com uma conta humana não foram exercitadas.

O banco existente não foi reestruturado. Foram adicionados objetos exclusivos do Atraction e dois agendamentos próprios. O segundo remove apenas o histórico de cron desses agendamentos após 30 dias.

## Limites deliberados desta versão

| Área | Estado |
| --- | --- |
| WhatsApp oficial | Não conectado. As respostas são rascunhos. Não há webhook, recebimento, mídia, catálogo ou envio real. |
| IA | Modelos de mensagem locais por nicho. Não há chamadas de modelo, transcrição, qualificação ou atendimento autônomo. |
| Disparos | Não implementados. Não existe caminho de envio em massa ou envio cobrado. |
| Aquisição/prospecção | Página de captação e QR implementados. Não há raspagem, compra de listas, Places/Ads nem rede de indicação. |
| Robôs | Criam tarefas, com fila a cada minuto e até 100 execuções por ciclo. Uma execução por pessoa/robô; reativação não repete trabalhos já concluídos. Não enviam mensagens. Demonstração mostra configuração; execução real ocorre no banco. |
| Arquivos | Importação CSV de até 10.000 linhas/5 MB. Importação direta de agenda, XLSX, áudio e anexos ainda não implementada. |
| Equipe | Até 10 membros, convite por link entregue manualmente. Cada usuário opera um espaço. Sem painel de troca de papel/remoção de membro nesta interface inicial. |
| Atualização entre atendentes | Consulta a cada 30 s e ao voltar à janela. Não é entrega Realtime em 5 s. |
| Escala | Leitura paginada até 50.000 itens por coleção no cliente. Ainda precisa de consultas/indicadores agregados no servidor e testes de carga antes de operar nesse volume. |
| Celular | Web responsiva com manifesto instalável. Não há aplicativo nativo nem operação offline de dados reais. |
| Lixeira | Restauração bloqueada após 30 dias. A remoção física e retenção legal não são automatizadas nesta versão. |
| Empresas, grupos e campos extras | Fora do núcleo implementado nesta entrega. |
| Faturamento | Não implementado. Não foram cadastrados preços ou meios de cobrança. |

## Antes de uma operação comercial

1. Definir hospedagem com limite de gastos e domínio/origem. A origem local já permite experimentar; não existe site público publicado por esta entrega.
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
