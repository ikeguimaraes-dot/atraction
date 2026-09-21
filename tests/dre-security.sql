begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label;end if;end $$;
insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-00000000ef01','dre-test@example.invalid',now());
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ef01","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
insert into public.atraction_tenants(id,name,owner_id) values('00000000-0000-4000-8000-00000000ef02','DRE teste','00000000-0000-4000-8000-00000000ef01');
do $$ declare r record; actual text; entry_id uuid; begin
for r in select * from (values
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
) v(category,group_key,direction) loop
insert into public.atraction_finance(tenant_id,title,direction,category,amount_cents,due_date) values('00000000-0000-4000-8000-00000000ef02',r.category,r.direction,r.category,10000,current_date) returning id,dre_group into entry_id,actual;
perform pg_temp.assert_true(actual=r.group_key,'automatic category '||r.category);
perform public.atraction_record_payment(entry_id,100,current_date,null,gen_random_uuid(),null);
perform pg_temp.assert_true((select dre_group=r.group_key from public.atraction_finance where id=entry_id),'payment preserves category');
end loop;
begin
insert into public.atraction_finance(tenant_id,title,direction,category,amount_cents,due_date) values('00000000-0000-4000-8000-00000000ef02','Wrong direction','expense','Aporte de capital dos sócios',10000,current_date);
raise exception 'FAIL: accepted wrong direction';exception when raise_exception then if sqlerrm like 'FAIL:%' then raise;end if;end;
end $$;
select public.atraction_create_recurrence('00000000-0000-4000-8000-00000000ef02','00000000-0000-4000-8000-00000000ef03',jsonb_build_object('title','Rendimento mensal','direction','income','amount_cents',2000,'category','Rendimentos de aplicações financeiras','due_date',current_date),current_date);
select pg_temp.assert_true((select dre_group='financial_revenue' from public.atraction_recurrences where id='00000000-0000-4000-8000-00000000ef03'),'recurrence classified');
select pg_temp.assert_true((select dre_group='financial_revenue' from public.atraction_finance where recurrence_id='00000000-0000-4000-8000-00000000ef03'),'generated occurrence classified');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000ef01","role":"authenticated","aal":"aal1"}',true);
select pg_temp.assert_true((select count(*)>0 from public.atraction_finance),'owner password session reads finance');
select 'DRE category mapping, payments, recurrence and password access passed' as result;
rollback;
