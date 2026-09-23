> Atualização de 23/09/2026: endpoints de captação/chat e execução dos robôs revogados; gatilho e cron do robô removidos. Tabelas históricas de marketing preservadas sem escrita pelos usuários. As descrições anteriores desses módulos abaixo são históricas. Login por e-mail e senha e isolamento por empresa permanecem ativos.

# Segurança e isolamento

- Toda tabela operacional do Atraction tem RLS e tenant_id. Referências entre contatos e negócios/tarefas/mensagens usam chaves compostas `(tenant_id, id)`.
- Papéis são consultados em `atraction_members`; nunca em metadados editáveis do usuário. Donos e gestores acessam com e-mail e senha, sem exigência de autenticador. Atendentes só veem registros atribuídos, e somente leitura não escreve.
- Funções privilegiadas ficam em schema não exposto, com search_path vazio e EXECUTE explicitamente concedido. Wrappers da API são SECURITY INVOKER.
- Exceção intencional de autenticação: as duas implementações de captação aceitam visitantes públicos. A leitura retorna apenas nome/título/nicho de páginas habilitadas. A escrita exige opt-in e telefone válido, não retorna cadastro, deduplica e limita novas pessoas por hora com trava por conta. Não oferece leitura arbitrária de contatos. Esse limite ainda não substitui proteção per-IP/antibot em uma publicação pública.
- Eventos, histórico de consentimentos e fila não aceitam mutações pelo cliente. Os triggers registram alterações; o worker tem execução revogada para todas as funções de cliente e só roda pelo administrador/agendador.
- A fila usa trava por linha e chave única por robô/pessoa. Uma falha reverte o ciclo inteiro; a próxima execução tenta de novo. Não existe adaptador de envio externo habilitado.
- Exportação é RPC autorizada e auditada para dono/gerente. Atendentes não têm a função de exportar na interface. Como em qualquer cliente com acesso de leitura, não é possível impedir que uma pessoa copie individualmente dados que está autorizada a consultar.
- Chave pública Supabase é adequada ao navegador; chaves secretas/service-role nunca foram usadas no frontend. `.env.local`, artefatos de teste e especificação privada original ficam fora do Git.
- A demonstração persiste no localStorage. A conta real persiste os registros no Supabase, sem cache de contatos no localStorage; a sessão Supabase é persistida pelo SDK.
- Sessões e usuários do Supabase são compartilhados com aplicativos preexistentes no mesmo projeto. O Atraction não modificou suas políticas, tabelas ou configuração global de Auth.

Os testes SQL fazem ROLLBACK. Não executar rotinas de reset/migração geral do Supabase em um projeto compartilhado. Para manutenção futura, escopar nomes `atraction_*` e revisar as migrações antes de aplicar.


## Contratos e documentos

Contratos só podem ser criados/alterados pelas RPCs transacionais da jornada. Funções privilegiadas ficam em `atraction_private`, verificam `auth.uid()` e papel na empresa, usam `search_path` vazio e concessões explícitas. Chaves únicas impedem cobranças repetidas e contratos duplicados por venda/renovação. Contas de contrato não podem ser reassociadas a outro cliente.

Bucket `atraction-documents` privado: políticas exigem metadados visíveis pela RLS, uploads do proprietário do registro, sem upsert ou acesso público. Limites de 5 MB/arquivo e 20 arquivos/espaço protegem o consumo máximo de armazenamento do módulo. Metadados, quotas e auditoria incluem arquivos arquivados. Não alterar políticas/buckets dos outros aplicativos do projeto compartilhado.

Atendentes e leitores não leem contratos, documentos, financeiro ou seus eventos. Metadados UTM públicos são limitados em tamanho e nunca tratados como instruções ou HTML; repetições preservam a atribuição e o consentimento existentes.
