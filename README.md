# Atraction

Sistema de gestão empresarial em português: empresas, clientes, contratos, agenda e financeiro. Os módulos de marketing e inbound foram retirados em 23/09/2026.

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

- Visão geral de clientes, contratos, tarefas e saldos financeiros.
- Cadastro manual de clientes, edição, busca, ativos/inativos e acesso aos cadastros anteriores.
- Ficha de cliente com atendimentos, retornos, satisfação, contratos e documentos privados.
- Contratos com cobrança única, parcelada ou mensal, reajuste, cancelamento e renovação.
- Receitas e despesas em abas separadas, parcelas, recorrências, categorias da DRE, CAPEX e filtros mensais.
- Fornecedores, baixas parciais, estornos, contas bancárias, transferências, exportação e DRE de caixa.
- Agenda e acompanhamento pós-venda, sem campanhas ou pedidos de indicação.
- Documentos PDF, modelos editáveis e campos personalizados de cadastro.
- Múltiplas empresas, visão consolidada, equipe e permissões por papel.
- Login por e-mail e senha, lixeira, restauração e auditoria.

Os menus Pessoas, Caminho do cliente, Conversas, Robôs, Atrair clientes e Resultados de marketing foram removidos. Captação pública e chat não aceitam novas operações; o agendamento dos robôs foi retirado. O banco conserva registros históricos e vínculos financeiros, sem exclusão de dados.

## Usuários existentes

O login reutiliza os usuários de `auth.users` do projeto Supabase fornecido, com o mesmo e-mail e senha. Não copia senhas ou usuários e não importa permissões de outros aplicativos. A validação mínima de oito caracteres é para novos cadastros; no login, a senha existente é validada pelo Supabase.

O acesso é por e-mail e senha, sem autenticador. Sem vínculo no Atraction, cadastra sua primeira empresa; para entrar em uma empresa existente, usa o convite nominal do dono. Pode cadastrar ou participar de várias empresas. O seletor da barra lateral mostra apenas empresas reais e a opção **Todas**, com visão consolidada de leitura. Cadastros e alterações são feitos dentro da empresa selecionada. A seleção persiste por usuário no navegador. `atraction_members` mantém as permissões próprias do produto. Usuários que só possuem autenticação por provedor externo, sem senha, não entram pelo formulário de senha até terem uma senha configurada no Auth. A demonstração local não é um espaço real.

## Banco

As migrações estão em `supabase/migrations`. O projeto informado já hospedava outros sistemas; por isso o Atraction usa tabelas com prefixo `atraction_` e funções internas no schema `atraction_private`. Não substitui tabelas, políticas ou funções dos demais produtos.

As quinze migrações já foram aplicadas no projeto fornecido. **Não rode `db reset` ou `db push` indiscriminadamente nesse projeto compartilhado.** Para outro ambiente, revise e aplique apenas as migrações do Atraction. Os agendamentos exigem `pg_cron`, que já estava disponível no projeto original.

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

`tests/marketing-retirement-security.sql` verifica o bloqueio dos endpoints de marketing, retirada do robô e preservação de clientes e recorrências financeiras.

As suítes `finance-security`, `multi-company-security`, `installments-security`, `recurrences-security` e `dre-security` validam permissões e gestão financeira em transações com rollback. As suítes anteriores de captação, chat e funil estão em `tests/legacy` para referência histórica e não se aplicam ao esquema atual.

O CI executa testes de unidade, build e navegador em desktop e celular com dados simulados. Testes SQL exigem acesso administrativo e terminam com rollback.

## Custos e operação

Nenhuma API paga de IA/WhatsApp, assinatura, domínio, instância ou branch pago foi contratado. As recorrências financeiras usam o banco já fornecido. Publicado no projeto Vercel já existente, com build local e sem contratação de plano ou serviço adicional. O consumo futuro da hospedagem e do Supabase continua sujeito ao plano existente.

A operação comercial ainda precisa das integrações, validações e processos listados em [docs/delivery.md](docs/delivery.md). Backup com PITR, SLA, termos legais e atendimento a titulares não devem ser presumidos pela existência do código.
