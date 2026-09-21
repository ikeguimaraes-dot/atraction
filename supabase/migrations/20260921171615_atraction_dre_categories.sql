-- Expand managerial DRE classification without rewriting historical entries.
alter table public.atraction_finance drop constraint atraction_finance_dre_group_check;
alter table public.atraction_finance add constraint atraction_finance_dre_group_check check(dre_group in ('revenue','cost','expense','tax','sales_deduction','personnel','sales','financial_revenue','financial_expense','other_revenue','other_expense','income_tax','non_dre'));
alter table public.atraction_recurrences drop constraint atraction_recurrences_dre_group_check;
alter table public.atraction_recurrences add constraint atraction_recurrences_dre_group_check check(dre_group in ('revenue','cost','expense','tax','sales_deduction','personnel','sales','financial_revenue','financial_expense','other_revenue','other_expense','income_tax','non_dre'));
create function atraction_private.classify_finance_category() returns trigger language plpgsql security invoker set search_path='' as $$
declare mapped text; mapped_direction text;
begin
 new.category:=trim(new.category);
 select v.group_key,v.direction into mapped,mapped_direction from (values
('Prestação de serviços','revenue','income'),
('Venda de produtos e mercadorias','revenue','income'),
('Assinaturas e mensalidades','revenue','income'),
('Licenças de software','revenue','income'),
('Implantação e suporte','revenue','income'),
('Consultoria e projetos','revenue','income'),
('Vendas de alimentos e bebidas','revenue','income'),
('Comissões por serviços prestados','revenue','income'),
('Taxas de processamento cobradas','revenue','income'),
('Juros de operações de crédito (atividade principal)','revenue','income'),
('ISS sobre faturamento','sales_deduction','expense'),
('ICMS sobre vendas','sales_deduction','expense'),
('PIS/COFINS sobre faturamento','sales_deduction','expense'),
('Simples Nacional (DAS integral)','sales_deduction','expense'),
('Devoluções e reembolsos de vendas','sales_deduction','expense'),
('Descontos concedidos sobre vendas','sales_deduction','expense'),
('Cancelamentos e chargebacks de vendas','sales_deduction','expense'),
('Mercadorias vendidas (CMV)','cost','expense'),
('Insumos e ingredientes consumidos','cost','expense'),
('Materiais aplicados nos serviços','cost','expense'),
('Mão de obra direta','cost','expense'),
('Terceirização da entrega do serviço','cost','expense'),
('Hospedagem e nuvem da operação','cost','expense'),
('APIs e modelos de IA da operação','cost','expense'),
('Licenças incorporadas ao serviço','cost','expense'),
('Processamento de transações da operação','cost','expense'),
('Frete de aquisição de mercadorias','cost','expense'),
('Embalagens dos produtos','cost','expense'),
('Outros custos diretos','cost','expense'),
('Salários administrativos','personnel','expense'),
('Pró-labore','personnel','expense'),
('INSS patronal e encargos da folha','personnel','expense'),
('FGTS','personnel','expense'),
('Férias e adicional de férias','personnel','expense'),
('Décimo terceiro salário','personnel','expense'),
('Benefícios e vale-transporte','personnel','expense'),
('Recrutamento e treinamento','personnel','expense'),
('Rescisões trabalhistas','personnel','expense'),
('Publicidade e mídia paga','sales','expense'),
('Agência de marketing e conteúdo','sales','expense'),
('Comissões de vendas','sales','expense'),
('Salários da equipe comercial','sales','expense'),
('Eventos e ações comerciais','sales','expense'),
('Frete de entrega ao cliente','sales','expense'),
('Viagens comerciais','sales','expense'),
('Ferramentas de vendas e marketing','sales','expense'),
('Taxas de cartão e marketplace','sales','expense'),
('Aluguel e condomínio administrativo','expense','expense'),
('Energia elétrica administrativa','expense','expense'),
('Água e saneamento','expense','expense'),
('Internet e telefonia','expense','expense'),
('Software de uso administrativo','expense','expense'),
('Contabilidade e assessoria fiscal','expense','expense'),
('Assessoria jurídica','expense','expense'),
('Material de escritório','expense','expense'),
('Limpeza e conservação','expense','expense'),
('Manutenção administrativa','expense','expense'),
('Seguros empresariais','expense','expense'),
('Serviços administrativos terceirizados','expense','expense'),
('IPTU e taxas de funcionamento','expense','expense'),
('Despesas administrativas gerais','expense','expense'),
('Rendimentos de aplicações financeiras','financial_revenue','income'),
('Juros recebidos por atraso','financial_revenue','income'),
('Descontos financeiros obtidos','financial_revenue','income'),
('Variação cambial ativa realizada','financial_revenue','income'),
('Juros de empréstimos e financiamentos','financial_expense','expense'),
('Juros e multas por atraso','financial_expense','expense'),
('Tarifas bancárias','financial_expense','expense'),
('IOF sobre operações financeiras','financial_expense','expense'),
('Despesas com antecipação de recebíveis','financial_expense','expense'),
('Variação cambial passiva realizada','financial_expense','expense'),
('Receitas de aluguel acessórias','other_revenue','income'),
('Indenizações recebidas','other_revenue','income'),
('Outras receitas operacionais acessórias','other_revenue','income'),
('Indenizações pagas','other_expense','expense'),
('Multas administrativas','other_expense','expense'),
('Outras despesas operacionais diversas','other_expense','expense'),
('IRPJ sobre o lucro','income_tax','expense'),
('CSLL sobre o lucro','income_tax','expense'),
('Aporte de capital dos sócios','non_dre','income'),
('Empréstimo recebido (principal)','non_dre','income'),
('Resgate de aplicação (principal)','non_dre','income'),
('Recebimento de empréstimo concedido (principal)','non_dre','income'),
('Venda de ativo imobilizado (valor recebido)','non_dre','income'),
('Distribuição de lucros aos sócios','non_dre','expense'),
('Pagamento de empréstimo (principal)','non_dre','expense'),
('Aplicação financeira (principal)','non_dre','expense'),
('Empréstimo concedido (principal)','non_dre','expense'),
('Aquisição de máquinas e equipamentos','non_dre','expense'),
('Aquisição de móveis e veículos','non_dre','expense'),
('Aquisição de ativos intangíveis','non_dre','expense'),
('Devolução de capital aos sócios','non_dre','expense')
 ) v(category,group_key,direction) where v.category=new.category;
 if mapped is not null then
  if new.direction<>mapped_direction then raise exception 'category direction mismatch';end if;
  new.dre_group:=mapped;
 end if;
 if new.direction='income' then
  if new.dre_group='expense' then new.dre_group:='revenue';end if;
  if new.dre_group not in ('revenue','financial_revenue','other_revenue','non_dre') then raise exception 'invalid income group';end if;
 elsif new.dre_group in ('revenue','financial_revenue','other_revenue') then raise exception 'invalid expense group';end if;
 return new;
end $$;
revoke all on function atraction_private.classify_finance_category() from public,anon,authenticated;
create trigger atraction_classify_category before insert or update of category,direction,dre_group on public.atraction_finance for each row execute function atraction_private.classify_finance_category();
create trigger atraction_classify_category before insert or update of category,direction,dre_group on public.atraction_recurrences for each row execute function atraction_private.classify_finance_category();

-- Payment validation remains unchanged; classification is handled by the earlier trigger.
create or replace function atraction_private.validate_payments() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb;total bigint:=0;last_date date;seen uuid[]:='{}';begin
 if TG_OP='UPDATE' and current_user='authenticated' and new.payments is distinct from old.payments then raise exception 'use payment operation';end if;
 if jsonb_typeof(new.payments)<>'array' or jsonb_array_length(new.payments)>200 then raise exception 'invalid payments';end if;
 for p in select value from jsonb_array_elements(new.payments) loop
 if (p->>'amount_cents') is null or (p->>'amount_cents')!~'^[0-9]+$' or (p->>'amount_cents')::bigint<1 or (p->>'date') is null or (p->>'date')::date>current_date or (p->>'id') is null or (p->>'id')::uuid=any(seen) then raise exception 'invalid payment';end if;
 seen:=array_append(seen,(p->>'id')::uuid);total:=total+(p->>'amount_cents')::bigint;last_date:=greatest(last_date,(p->>'date')::date);
 if p->>'account_id' is not null and not exists(select 1 from public.atraction_accounts where id=(p->>'account_id')::uuid and tenant_id=new.tenant_id) then raise exception 'invalid account';end if;
 end loop;
 if total>new.amount_cents then raise exception 'payment exceeds amount';end if;
 new.settled_date:=case when total=new.amount_cents then last_date else null end;
 return new;
end $$;
