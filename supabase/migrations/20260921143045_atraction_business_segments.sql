alter table public.atraction_tenants drop constraint atraction_tenants_niche_check;
alter table public.atraction_tenants add constraint atraction_tenants_niche_check check(niche in ('estetica','academia','pet','fintech','software','restaurante','ia','ecommerce','consultoria','agencia','educacao','saude','imobiliaria','outro'));
alter table public.atraction_tenants alter column niche set default 'outro';
