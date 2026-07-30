-- ============================================================================
-- HERDON — baseline candidata do schema-base (Sprint 4)
-- ============================================================================
-- NAO E UMA MIGRATION ATIVA. Ver supabase/baseline-candidate/README.md antes
-- de usar este arquivo por qualquer motivo.
--
-- Objetivo: reconstruir, num banco Postgres vazio, exatamente os objetos que
-- precisavam existir imediatamente ANTES da primeira migration rastreada do
-- repositorio, supabase/migrations/20260617020950_financial_status_fields.sql
-- — para que as 31 migrations rastreadas hoje em supabase/migrations/ possam
-- ser aplicadas em sequencia, em um banco descartavel, sem erro de "relation
-- does not exist".
--
-- Fonte de verdade: catalogo ao vivo do projeto Supabase de producao
-- (ljpiszxicmmuefbiixui), consultado via information_schema/pg_catalog em
-- 2026-07-30. Os arquivos docs/supabase-production-schema.sql e
-- docs/supabase-production-rls.sql foram lidos como ponto de partida, mas
-- MOSTRARAM DRIFT SIGNIFICATIVO em relacao a producao (ver secao "Divergencias
-- encontradas" do relatorio da sprint, docs/SPRINT4_BASELINE_CANDIDATA_SUPABASE.md)
-- — por isso este arquivo foi construido a partir do catalogo ao vivo, nao do
-- dump. Para cada objeto abaixo, a regra aplicada foi: incluir se e somente se
-- (a) existe hoje em producao E (b) nao e criado/alterado por nenhuma das 31
-- migrations rastreadas (confirmado via grep de CREATE TABLE/ADD COLUMN/CREATE
-- INDEX/CREATE TRIGGER/CREATE POLICY em supabase/migrations/*.sql). Colunas,
-- indices, triggers, funcoes e policies que SAO criados/alterados por uma das
-- 31 migrations foram deliberadamente omitidos daqui — a propria migration
-- rastreada os cria quando replayada. O detalhamento objeto-a-objeto esta no
-- relatorio da sprint.

-- ============================================================================
-- 1) EXTENSIONS
-- ============================================================================
create extension if not exists citext;
create extension if not exists pgcrypto;

-- ============================================================================
-- 2) ENUMS / TYPES
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'app_profile' and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_profile as enum ('proprietario', 'gerente', 'operador', 'visualizador');
  end if;
end $$;

-- ============================================================================
-- 3) FUNCOES UTILITARIAS (baseline-original — nenhuma das 31 migrations as
--    cria ou substitui; confirmado via grep)
-- ============================================================================

-- Usada pelos triggers "set_<tabela>_updated_at" (metade mais antiga do par
-- duplicado que existe em quase toda tabela — ver nota na secao de triggers).
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Usada pelos triggers "trg_<tabela>_updated_at" (metade mais nova do par
-- duplicado) e pelos 3 triggers de updated_at das tabelas antes 100% nao
-- documentadas (cenario_eventos, eventos_operacionais, suplementacao). Corpo
-- copiado literalmente de pg_proc.prosrc — sem origem em nenhuma migration.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- 4) TABELAS (ordem respeita dependencias de FK), PKs, FKs, indices e
--    triggers de updated_at inline por tabela. RLS/policies na secao 6.
-- ============================================================================

-- ---------------------------------------------------------------- profiles -
-- Exclui: status, fazenda_id (colunas adicionadas por 20260704173340 e
-- 20260722145101, ambas rastreadas e posteriores a 20260617020950).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nome_completo text,
  perfil text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_user_id uuid references auth.users (id) on delete set null,
  nome text,
  telefone text,
  cargo text,
  foto_url text
);

create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists profiles_owner_user_id_idx on public.profiles (owner_user_id);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_updated_at_idx on public.profiles (updated_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- invites -
-- Exclui: fazenda_id, expires_at (adicionadas por 20260722145101).
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  perfil text not null,
  created_at timestamptz not null default now(),
  owner_user_id uuid references auth.users (id) on delete set null,
  nome text,
  status text default 'pendente',
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  updated_at timestamptz default now(),
  constraint invites_email_key unique (email)
);

create index if not exists invites_owner_user_id_idx on public.invites (owner_user_id);
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists invites_used_by_idx on public.invites (used_by);
create index if not exists invites_status_idx on public.invites (status);
create index if not exists invites_created_at_idx on public.invites (created_at desc);
create index if not exists invites_updated_at_idx on public.invites (updated_at desc);

drop trigger if exists set_invites_updated_at on public.invites;
create trigger set_invites_updated_at before update on public.invites
for each row execute function public.set_current_timestamp_updated_at();

-- --------------------------------------------------------- subscription_plans -
create table if not exists public.subscription_plans (
  id bigint generated by default as identity primary key,
  plan_code text not null,
  plan_name text not null,
  status text not null default 'active',
  billing_provider text not null default 'manual',
  price_cents integer,
  currency_code text not null default 'BRL',
  billing_interval text not null default 'month',
  description text,
  sort_order integer not null default 0,
  is_launch_offer boolean not null default false,
  easy_to_disable boolean not null default false,
  plan_entitlements jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscription_plans_plan_code_key unique (plan_code)
);

create index if not exists subscription_plans_status_idx on public.subscription_plans (status);
create index if not exists subscription_plans_sort_order_idx on public.subscription_plans (sort_order);
create index if not exists subscription_plans_created_at_idx on public.subscription_plans (created_at desc);
create index if not exists subscription_plans_updated_at_idx on public.subscription_plans (updated_at desc);

drop trigger if exists set_subscription_plans_updated_at on public.subscription_plans;
create trigger set_subscription_plans_updated_at before update on public.subscription_plans
for each row execute function public.set_current_timestamp_updated_at();

insert into public.subscription_plans (
  plan_code, plan_name, status, billing_provider, price_cents, currency_code,
  billing_interval, description, sort_order, is_launch_offer, easy_to_disable,
  plan_entitlements, raw_payload
)
values
  ('fundador', 'FUNDADOR', 'active', 'manual', 29700, 'BRL', 'month',
   'Oferta de lancamento com acesso completo.', 1, true, true,
   '{"fullAccess": true, "limits": {"farms": 50, "animals": 10000, "users": 50}, "modules": ["*"]}'::jsonb, '{}'::jsonb),
  ('essencial', 'ESSENCIAL', 'active', 'manual', 19700, 'BRL', 'month',
   'Plano para operacao enxuta e organizada.', 2, false, false,
   '{"fullAccess": false, "limits": {"farms": 1, "animals": 300, "users": 2}, "modules": ["dashboard", "fazendas", "lotes", "animais", "pesagens", "tarefas", "calendarioOperacional", "rotina", "perfil", "configuracoes", "resultados", "comparativo"]}'::jsonb, '{}'::jsonb),
  ('pro', 'PRO', 'active', 'manual', 39700, 'BRL', 'month',
   'Plano completo para a operacao diaria da fazenda.', 3, false, false,
   '{"fullAccess": false, "limits": {"farms": 3, "animals": 1000, "users": 5}, "modules": ["dashboard", "fazendas", "lotes", "animais", "pesagens", "tarefas", "calendarioOperacional", "rotina", "perfil", "configuracoes", "resultados", "comparativo", "financeiro", "estoque", "sanitario", "relatoriosGerenciais"]}'::jsonb, '{}'::jsonb),
  ('premium', 'PREMIUM', 'active', 'manual', 69700, 'BRL', 'month',
   'Plano avancado para gestao ampliada e indicadores.', 4, false, false,
   '{"fullAccess": false, "limits": {"farms": 10, "animals": 3000, "users": 10}, "modules": ["dashboard", "fazendas", "lotes", "animais", "pesagens", "tarefas", "calendarioOperacional", "rotina", "perfil", "configuracoes", "resultados", "comparativo", "financeiro", "estoque", "sanitario", "relatoriosGerenciais", "pastagens", "indicadores", "cenarios", "dashboardPremium", "evolucaoRebanho"]}'::jsonb, '{}'::jsonb),
  ('enterprise', 'ENTERPRISE', 'active', 'manual', null, 'BRL', 'custom',
   'Plano personalizado com ativacao sob consulta.', 5, false, false,
   '{"fullAccess": true, "customLimits": true, "limits": {"farms": null, "animals": null, "users": null}, "modules": ["*"]}'::jsonb, '{}'::jsonb)
on conflict (plan_code) do nothing;

-- ---------------------------------------------------------------- fazendas -
create table if not exists public.fazendas (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  proprietario text,
  cidade text,
  estado text,
  area_total_ha numeric(12, 2),
  area_pastagem_ha numeric(12, 2),
  capacidade_ua numeric(12, 2),
  tipo_producao text,
  inscricao_estadual text,
  cnpj_cpf text,
  telefone text,
  email text,
  endereco text,
  status text default 'ativa',
  observacoes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responsavel text,
  hectares numeric(12, 2),
  area numeric(12, 2),
  hectares_pastagem numeric(12, 2),
  capacidade_lotacao numeric(12, 2),
  synced_from text,
  cloud_id uuid not null default gen_random_uuid()
);

create index if not exists fazendas_owner_user_id_idx on public.fazendas (owner_user_id);
create index if not exists fazendas_nome_idx on public.fazendas (nome);
create index if not exists fazendas_created_at_idx on public.fazendas (created_at desc);
create index if not exists fazendas_updated_at_idx on public.fazendas (updated_at desc);
create unique index if not exists fazendas_cloud_id_unique_idx on public.fazendas (cloud_id) where cloud_id is not null;

drop trigger if exists set_fazendas_updated_at on public.fazendas;
create trigger set_fazendas_updated_at before update on public.fazendas
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_fazendas_updated_at on public.fazendas;
create trigger trg_fazendas_updated_at before update on public.fazendas
for each row execute function public.set_updated_at();

-- ------------------------------------------------------ customer_subscriptions -
create table if not exists public.customer_subscriptions (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  farm_id bigint references public.fazendas (id) on delete set null,
  fazenda_id bigint references public.fazendas (id) on delete set null,
  plan_code text not null references public.subscription_plans (plan_code) on update cascade,
  plan_name text,
  status text not null default 'trialing',
  billing_provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  provider_payment_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  canceled_at timestamptz,
  blocked_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  checkout_url text,
  invoice_url text,
  external_reference text,
  provider_reference text,
  payment_url text,
  bank_slip_url text,
  transaction_receipt_url text
);

create unique index if not exists customer_subscriptions_provider_subscription_id_unique_idx on public.customer_subscriptions (provider_subscription_id) where provider_subscription_id is not null;
create index if not exists customer_subscriptions_owner_user_id_idx on public.customer_subscriptions (owner_user_id);
create index if not exists customer_subscriptions_user_id_idx on public.customer_subscriptions (user_id);
create index if not exists customer_subscriptions_plan_code_idx on public.customer_subscriptions (plan_code);
create index if not exists customer_subscriptions_status_idx on public.customer_subscriptions (status);
create index if not exists customer_subscriptions_created_at_idx on public.customer_subscriptions (created_at desc);
create index if not exists customer_subscriptions_updated_at_idx on public.customer_subscriptions (updated_at desc);

drop trigger if exists set_customer_subscriptions_updated_at on public.customer_subscriptions;
create trigger set_customer_subscriptions_updated_at before update on public.customer_subscriptions
for each row execute function public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------ billing_events -
create table if not exists public.billing_events (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  subscription_id bigint references public.customer_subscriptions (id) on delete set null,
  event_type text not null,
  event_status text not null default 'received',
  billing_provider text not null default 'manual',
  provider_event_id text,
  provider_customer_id text,
  provider_subscription_id text,
  provider_payment_id text,
  occurred_at timestamptz,
  processed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  provider text default 'asaas',
  provider_reference text,
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  status text default 'received',
  payment_url text,
  invoice_url text,
  external_reference text
);

create unique index if not exists billing_events_provider_event_id_unique_idx on public.billing_events (provider_event_id) where provider_event_id is not null;
create index if not exists billing_events_owner_user_id_idx on public.billing_events (owner_user_id);
create index if not exists billing_events_subscription_id_idx on public.billing_events (subscription_id);
create index if not exists billing_events_event_type_idx on public.billing_events (event_type);
create index if not exists billing_events_created_at_idx on public.billing_events (created_at desc);
create index if not exists billing_events_updated_at_idx on public.billing_events (updated_at desc);

drop trigger if exists set_billing_events_updated_at on public.billing_events;
create trigger set_billing_events_updated_at before update on public.billing_events
for each row execute function public.set_current_timestamp_updated_at();

-- ----------------------------------------------------------- checkout_sessions -
create table if not exists public.checkout_sessions (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  plan_code text references public.subscription_plans (plan_code) on update cascade,
  status text not null default 'pending',
  billing_provider text not null default 'manual',
  provider_checkout_session_id text,
  checkout_url text,
  expires_at timestamptz,
  completed_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  plan_name text,
  provider text default 'asaas',
  asaas_customer_id text,
  asaas_subscription_id text,
  asaas_payment_id text,
  invoice_url text,
  provider_reference text,
  external_reference text,
  payment_url text,
  bank_slip_url text,
  transaction_receipt_url text
);

create unique index if not exists checkout_sessions_provider_checkout_session_id_unique_idx on public.checkout_sessions (provider_checkout_session_id) where provider_checkout_session_id is not null;
create index if not exists checkout_sessions_owner_user_id_idx on public.checkout_sessions (owner_user_id);
create index if not exists checkout_sessions_plan_code_idx on public.checkout_sessions (plan_code);
create index if not exists checkout_sessions_status_idx on public.checkout_sessions (status);
create index if not exists checkout_sessions_created_at_idx on public.checkout_sessions (created_at desc);
create index if not exists checkout_sessions_updated_at_idx on public.checkout_sessions (updated_at desc);

drop trigger if exists set_checkout_sessions_updated_at on public.checkout_sessions;
create trigger set_checkout_sessions_updated_at before update on public.checkout_sessions
for each row execute function public.set_current_timestamp_updated_at();

-- --------------------------------------------------------------- pastagens -
-- id e uuid em producao (nao bigint identity como o dump manual afirmava —
-- ver relatorio da sprint, "Divergencias encontradas"). fazenda_id/faz_id nao
-- tem FK real em producao hoje (confirmado via pg_constraint), apenas indice.
create table if not exists public.pastagens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  fazenda_id uuid,
  nome text not null,
  status text default 'ativa',
  area_ha numeric default 0,
  capacidade_suporte_ua_ha numeric default 0,
  custo_pasto_mensal numeric default 0,
  custo_pasto_cab_mes numeric default 0,
  arrendamento_ativo boolean default false,
  arrendamento_area_ha numeric default 0,
  area_arrendada_ha numeric default 0,
  arrendamento_custo_mensal numeric default 0,
  custo_arrendamento_mes numeric default 0,
  capacidade_total_ua numeric default 0,
  taxa_lotacao_atual_ua_ha numeric default 0,
  observacoes text,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  faz_id bigint references public.fazendas (id) on delete set null,
  obs text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists pastagens_owner_user_id_idx on public.pastagens (owner_user_id);
create index if not exists pastagens_fazenda_id_idx on public.pastagens (fazenda_id);
create index if not exists pastagens_faz_id_idx on public.pastagens (faz_id);
create index if not exists pastagens_created_at_idx on public.pastagens (created_at desc);
create index if not exists pastagens_updated_at_idx on public.pastagens (updated_at desc);

drop trigger if exists set_pastagens_updated_at on public.pastagens;
create trigger set_pastagens_updated_at before update on public.pastagens
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at_pastagens on public.pastagens;
create trigger set_updated_at_pastagens before update on public.pastagens
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ funcionarios -
create table if not exists public.funcionarios (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  nome text not null,
  cpf text,
  telefone text,
  cargo text,
  salario numeric(14, 2),
  data_admissao date,
  status text default 'ativo',
  fazenda_id bigint references public.fazendas (id) on delete set null,
  observacoes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  funcao text,
  email text
);

create index if not exists funcionarios_owner_user_id_idx on public.funcionarios (owner_user_id);
create index if not exists funcionarios_fazenda_id_idx on public.funcionarios (fazenda_id);
create index if not exists funcionarios_status_idx on public.funcionarios (status);
create index if not exists funcionarios_created_at_idx on public.funcionarios (created_at desc);
create index if not exists funcionarios_updated_at_idx on public.funcionarios (updated_at desc);

drop trigger if exists set_funcionarios_updated_at on public.funcionarios;
create trigger set_funcionarios_updated_at before update on public.funcionarios
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_funcionarios_updated_at on public.funcionarios;
create trigger trg_funcionarios_updated_at before update on public.funcionarios
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ lotes -
create table if not exists public.lotes (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  faz_id bigint references public.fazendas (id) on delete set null,
  nome text not null,
  sistema text,
  tipo text,
  entrada date,
  saida date,
  tem_recria boolean default false,
  dias_recria integer,
  p_ini_recria numeric(10, 3),
  p_fim_recria numeric(10, 3),
  tem_engorda boolean default false,
  dias_engorda integer,
  gmd_meta numeric(10, 4),
  investimento numeric(14, 2),
  outras_desp_pc_mes numeric(14, 2),
  custo_fixo_mensal numeric(14, 2),
  preco_arroba numeric(14, 2),
  rendimento_carcaca numeric(8, 3),
  status text default 'ativo',
  data_encerramento date,
  data_venda date,
  motivo_encerramento text,
  p_at numeric(10, 3),
  peso_atual numeric(10, 3),
  peso_medio_atual numeric(10, 3),
  ultima_pesagem date,
  supl_nome text,
  supl_rkg numeric(10, 3),
  supl_pv_pct numeric(10, 3),
  supl_estoque_kg numeric(12, 3),
  supl_meta_dias integer,
  observacao text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cloud_id uuid not null default gen_random_uuid(),
  peso_alvo numeric(10, 2),
  raca text,
  sexo text,
  categoria text,
  obs text,
  p_ini numeric(10, 2),
  data_saida date,
  fechamento jsonb,
  pastagem_id uuid references public.pastagens (id) on delete set null,
  categoria_animal text,
  qtd numeric(14, 2),
  dias_estimados numeric(14, 2),
  consumo_tipo text,
  consumo_por_cabeca_dia numeric(14, 4),
  consumo_total_estimado numeric(14, 4),
  custo_total_estimado numeric(14, 2),
  preco_kg numeric(14, 4)
);

create unique index if not exists lotes_cloud_id_unique_idx on public.lotes (cloud_id) where cloud_id is not null;
create index if not exists lotes_owner_user_id_idx on public.lotes (owner_user_id);
create index if not exists lotes_faz_id_idx on public.lotes (faz_id);
create index if not exists lotes_pastagem_id_idx on public.lotes (pastagem_id);
create index if not exists lotes_status_idx on public.lotes (status);
create index if not exists lotes_created_at_idx on public.lotes (created_at desc);
create index if not exists lotes_updated_at_idx on public.lotes (updated_at desc);
create index if not exists idx_lotes_metadata_local_id on public.lotes (((metadata ->> 'local_id')));

drop trigger if exists set_lotes_updated_at on public.lotes;
create trigger set_lotes_updated_at before update on public.lotes
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_lotes_updated_at on public.lotes;
create trigger trg_lotes_updated_at before update on public.lotes
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- rotinas -
create table if not exists public.rotinas (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  funcionario_id bigint references public.funcionarios (id) on delete set null,
  lote_id bigint references public.lotes (id) on delete set null,
  tarefa text not null,
  setor text,
  obs text,
  recorrente boolean default false,
  recorrencia_tipo text,
  dias_semana jsonb default '[]'::jsonb,
  data_inicio date,
  data_fim date,
  concluido_datas jsonb default '[]'::jsonb,
  data date,
  status text,
  origem_sistema text,
  origem_sanitario_id bigint,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_id bigint references public.fazendas (id) on delete set null,
  descricao text
);

create index if not exists rotinas_owner_user_id_idx on public.rotinas (owner_user_id);
create index if not exists rotinas_fazenda_id_idx on public.rotinas (fazenda_id);
create index if not exists rotinas_funcionario_id_idx on public.rotinas (funcionario_id);
create index if not exists rotinas_lote_id_idx on public.rotinas (lote_id);
create index if not exists rotinas_data_idx on public.rotinas (data desc);
create index if not exists rotinas_created_at_idx on public.rotinas (created_at desc);
create index if not exists rotinas_updated_at_idx on public.rotinas (updated_at desc);

drop trigger if exists set_rotinas_updated_at on public.rotinas;
create trigger set_rotinas_updated_at before update on public.rotinas
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_rotinas_updated_at on public.rotinas;
create trigger trg_rotinas_updated_at before update on public.rotinas
for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- sanitario -
-- Exclui: data_fim_carencia (adicionada por 20260706180142).
-- rotina_automatica_id tem 2 FKs redundantes em producao hoje
-- (sanitario_rotina_automatica_id_fkey e sanitario_rotina_automatica_fk,
-- mesma definicao) — reportado como drift no relatorio da sprint; a baseline
-- cria apenas uma, o suficiente para o proposito deste arquivo.
create table if not exists public.sanitario (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  tipo text,
  "desc" text,
  data_aplic date,
  proxima date,
  alerta_dias_antes integer,
  qtd numeric(12, 3),
  obs text,
  funcionario_responsavel_id bigint references public.funcionarios (id) on delete set null,
  rotina_automatica_id bigint references public.rotinas (id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_id bigint references public.fazendas (id) on delete set null,
  nome text,
  status text
);

create index if not exists sanitario_owner_user_id_idx on public.sanitario (owner_user_id);
create index if not exists sanitario_fazenda_id_idx on public.sanitario (fazenda_id);
create index if not exists sanitario_lote_id_idx on public.sanitario (lote_id);
create index if not exists sanitario_funcionario_responsavel_id_idx on public.sanitario (funcionario_responsavel_id);
create index if not exists sanitario_data_aplic_idx on public.sanitario (data_aplic desc);
create index if not exists sanitario_proxima_idx on public.sanitario (proxima desc);
create index if not exists sanitario_created_at_idx on public.sanitario (created_at desc);
create index if not exists sanitario_updated_at_idx on public.sanitario (updated_at desc);

drop trigger if exists set_sanitario_updated_at on public.sanitario;
create trigger set_sanitario_updated_at before update on public.sanitario
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_sanitario_updated_at on public.sanitario;
create trigger trg_sanitario_updated_at before update on public.sanitario
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ animais -
create table if not exists public.animais (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  sexo text,
  gen text,
  qtd numeric(12, 3) not null default 0,
  p_ini numeric(10, 3),
  p_at numeric(10, 3),
  dias integer,
  consumo numeric(12, 3),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  identificacao text,
  tipo_registro text,
  status text,
  cloud_id uuid,
  fazenda_id bigint references public.fazendas (id) on delete set null,
  nome text,
  categoria text,
  categoria_animal text,
  raca text,
  origem text,
  data_referencia date,
  data_nascimento date,
  data_saida date,
  data_venda date,
  observacao text,
  rendimento_carcaca numeric(8, 3),
  preco_arroba numeric(14, 2)
);

create unique index if not exists animais_cloud_id_unique_idx on public.animais (cloud_id) where cloud_id is not null;
create index if not exists animais_owner_user_id_idx on public.animais (owner_user_id);
create index if not exists animais_fazenda_id_idx on public.animais (fazenda_id);
create index if not exists animais_lote_id_idx on public.animais (lote_id);
create index if not exists animais_status_idx on public.animais (status);
create index if not exists animais_created_at_idx on public.animais (created_at desc);
create index if not exists animais_updated_at_idx on public.animais (updated_at desc);

drop trigger if exists set_animais_updated_at on public.animais;
create trigger set_animais_updated_at before update on public.animais
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_animais_updated_at on public.animais;
create trigger trg_animais_updated_at before update on public.animais
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- pesagens -
create table if not exists public.pesagens (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  data date not null,
  peso_medio numeric(10, 3) not null,
  observacao text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  animal_id bigint references public.animais (id) on delete set null,
  tipo text,
  origem text,
  rendimento_carcaca numeric,
  preco_arroba numeric,
  cloud_id uuid
);

create unique index if not exists pesagens_cloud_id_unique_idx on public.pesagens (cloud_id) where cloud_id is not null;
create index if not exists pesagens_owner_user_id_idx on public.pesagens (owner_user_id);
create index if not exists pesagens_lote_id_idx on public.pesagens (lote_id);
create index if not exists pesagens_animal_id_idx on public.pesagens (animal_id);
create index if not exists pesagens_data_idx on public.pesagens (data desc);
create index if not exists pesagens_created_at_idx on public.pesagens (created_at desc);
create index if not exists pesagens_updated_at_idx on public.pesagens (updated_at desc);

drop trigger if exists set_pesagens_updated_at on public.pesagens;
create trigger set_pesagens_updated_at before update on public.pesagens
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_pesagens_updated_at on public.pesagens;
create trigger trg_pesagens_updated_at before update on public.pesagens
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ estoque -
create table if not exists public.estoque (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  produto text not null,
  categoria text,
  unidade text,
  quantidade_atual numeric(14, 3) not null default 0,
  quantidade_minima numeric(14, 3) default 0,
  valor_unitario numeric(14, 4) default 0,
  origem text,
  numero_nf text,
  data_entrada date,
  data_validade date,
  alerta_dias_antes integer default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_id bigint references public.fazendas (id) on delete set null,
  nome text,
  subcategoria text,
  unidade_medida text,
  quantidade numeric(14, 4),
  custo_unitario numeric(14, 4),
  preco_unitario numeric(14, 4),
  valor_total numeric(14, 2),
  validade date,
  fornecedor text,
  observacoes text,
  obs text
);

create index if not exists estoque_owner_user_id_idx on public.estoque (owner_user_id);
create index if not exists estoque_fazenda_id_idx on public.estoque (fazenda_id);
create index if not exists estoque_categoria_idx on public.estoque (categoria);
create index if not exists estoque_created_at_idx on public.estoque (created_at desc);
create index if not exists estoque_updated_at_idx on public.estoque (updated_at desc);

drop trigger if exists set_estoque_updated_at on public.estoque;
create trigger set_estoque_updated_at before update on public.estoque
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_estoque_updated_at on public.estoque;
create trigger trg_estoque_updated_at before update on public.estoque
for each row execute function public.set_updated_at();

-- --------------------------------------------------------- movimentacoes_estoque -
create table if not exists public.movimentacoes_estoque (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  item_estoque_id bigint references public.estoque (id) on delete set null,
  lote_id bigint references public.lotes (id) on delete set null,
  tipo text not null,
  quantidade numeric(14, 3) not null default 0,
  custo_unitario numeric(14, 4),
  valor_total numeric(14, 2),
  data date not null,
  fornecedor text,
  numero_nf text,
  observacao text,
  obs text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  origem text,
  origem_tipo text,
  origem_id bigint
);

create index if not exists movimentacoes_estoque_owner_user_id_idx on public.movimentacoes_estoque (owner_user_id);
create index if not exists movimentacoes_estoque_item_idx on public.movimentacoes_estoque (item_estoque_id);
create index if not exists movimentacoes_estoque_lote_idx on public.movimentacoes_estoque (lote_id);
create index if not exists movimentacoes_estoque_data_idx on public.movimentacoes_estoque (data desc);
create index if not exists movimentacoes_estoque_created_at_idx on public.movimentacoes_estoque (created_at desc);
create index if not exists movimentacoes_estoque_updated_at_idx on public.movimentacoes_estoque (updated_at desc);

drop trigger if exists set_movimentacoes_estoque_updated_at on public.movimentacoes_estoque;
create trigger set_movimentacoes_estoque_updated_at before update on public.movimentacoes_estoque
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_movimentacoes_estoque_updated_at on public.movimentacoes_estoque;
create trigger trg_movimentacoes_estoque_updated_at before update on public.movimentacoes_estoque
for each row execute function public.set_updated_at();

-- ----------------------------------------------------- movimentacoes_financeiras -
-- Exclui: status, data_competencia, data_vencimento, data_pagamento
-- (adicionadas pela propria 20260617020950 — a primeira migration rastreada,
-- que roda IMEDIATAMENTE apos esta baseline) e estornado_em (adicionada por
-- 20260720202758).
create table if not exists public.movimentacoes_financeiras (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  tipo text not null,
  categoria text,
  lote_id bigint references public.lotes (id) on delete set null,
  valor numeric(14, 2) not null default 0,
  data date not null,
  descricao text,
  observacao text,
  origem text,
  origem_tipo text,
  origem_id bigint,
  parcela_num integer,
  parcela_total integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_id bigint references public.fazendas (id) on delete set null,
  subcategoria text,
  metodo_pagamento text,
  pago boolean,
  comprador text,
  fornecedor text
);

create index if not exists movimentacoes_financeiras_owner_user_id_idx on public.movimentacoes_financeiras (owner_user_id);
create index if not exists movimentacoes_financeiras_fazenda_id_idx on public.movimentacoes_financeiras (fazenda_id);
create index if not exists movimentacoes_financeiras_lote_id_idx on public.movimentacoes_financeiras (lote_id);
create index if not exists movimentacoes_financeiras_data_idx on public.movimentacoes_financeiras (data desc);
create index if not exists movimentacoes_financeiras_created_at_idx on public.movimentacoes_financeiras (created_at desc);
create index if not exists movimentacoes_financeiras_updated_at_idx on public.movimentacoes_financeiras (updated_at desc);

drop trigger if exists set_movimentacoes_financeiras_updated_at on public.movimentacoes_financeiras;
create trigger set_movimentacoes_financeiras_updated_at before update on public.movimentacoes_financeiras
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_movimentacoes_financeiras_updated_at on public.movimentacoes_financeiras;
create trigger trg_movimentacoes_financeiras_updated_at before update on public.movimentacoes_financeiras
for each row execute function public.set_updated_at();

-- ------------------------------------------------------- movimentacoes_animais -
create table if not exists public.movimentacoes_animais (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  tipo text not null,
  qtd numeric(12, 3) not null default 0,
  peso_medio numeric(10, 3),
  valor_total numeric(14, 2),
  custo_por_cabeca numeric(14, 4),
  data date not null,
  comprador_fornecedor text,
  destino_lote_id bigint references public.lotes (id) on delete set null,
  lote_destino text,
  obs text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  animal_id bigint references public.animais (id) on delete set null,
  origem text,
  origem_tipo text,
  origem_id bigint,
  observacao text
);

create index if not exists movimentacoes_animais_owner_user_id_idx on public.movimentacoes_animais (owner_user_id);
create index if not exists movimentacoes_animais_lote_id_idx on public.movimentacoes_animais (lote_id);
create index if not exists movimentacoes_animais_destino_lote_id_idx on public.movimentacoes_animais (destino_lote_id);
create index if not exists movimentacoes_animais_animal_id_idx on public.movimentacoes_animais (animal_id);
create index if not exists movimentacoes_animais_data_idx on public.movimentacoes_animais (data desc);
create index if not exists movimentacoes_animais_created_at_idx on public.movimentacoes_animais (created_at desc);
create index if not exists movimentacoes_animais_updated_at_idx on public.movimentacoes_animais (updated_at desc);

drop trigger if exists set_movimentacoes_animais_updated_at on public.movimentacoes_animais;
create trigger set_movimentacoes_animais_updated_at before update on public.movimentacoes_animais
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_movimentacoes_animais_updated_at on public.movimentacoes_animais;
create trigger trg_movimentacoes_animais_updated_at before update on public.movimentacoes_animais
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------- custos -
create table if not exists public.custos (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  cat text,
  "desc" text,
  data date not null,
  val numeric(14, 2) not null default 0,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_id bigint references public.fazendas (id) on delete set null,
  observacao text,
  origem text,
  origem_id bigint
);

create index if not exists custos_owner_user_id_idx on public.custos (owner_user_id);
create index if not exists custos_fazenda_id_idx on public.custos (fazenda_id);
create index if not exists custos_lote_id_idx on public.custos (lote_id);
create index if not exists custos_data_idx on public.custos (data desc);
create index if not exists custos_created_at_idx on public.custos (created_at desc);
create index if not exists custos_updated_at_idx on public.custos (updated_at desc);

drop trigger if exists set_custos_updated_at on public.custos;
create trigger set_custos_updated_at before update on public.custos
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_custos_updated_at on public.custos;
create trigger trg_custos_updated_at before update on public.custos
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- tarefas -
create table if not exists public.tarefas (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  titulo text not null,
  descricao text,
  status text not null default 'pendente',
  prioridade text default 'media',
  categoria text,
  responsavel_id bigint references public.funcionarios (id) on delete set null,
  lote_id bigint references public.lotes (id) on delete set null,
  fazenda_id bigint references public.fazendas (id) on delete set null,
  data_vencimento date,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  concluida_em timestamptz,
  adiado_em timestamptz
);

create index if not exists tarefas_owner_user_id_idx on public.tarefas (owner_user_id);
create index if not exists tarefas_fazenda_id_idx on public.tarefas (fazenda_id);
create index if not exists tarefas_lote_id_idx on public.tarefas (lote_id);
create index if not exists tarefas_responsavel_id_idx on public.tarefas (responsavel_id);
create index if not exists tarefas_created_at_idx on public.tarefas (created_at desc);
create index if not exists tarefas_updated_at_idx on public.tarefas (updated_at desc);

drop trigger if exists set_tarefas_updated_at on public.tarefas;
create trigger set_tarefas_updated_at before update on public.tarefas
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_tarefas_updated_at on public.tarefas;
create trigger trg_tarefas_updated_at before update on public.tarefas
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- usuarios -
create table if not exists public.usuarios (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  user_ref uuid references auth.users (id) on delete set null,
  nome text,
  email text,
  perfil text,
  status text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists usuarios_owner_user_id_idx on public.usuarios (owner_user_id);
create index if not exists usuarios_email_idx on public.usuarios (email);
create index if not exists usuarios_created_at_idx on public.usuarios (created_at desc);
create index if not exists usuarios_updated_at_idx on public.usuarios (updated_at desc);

drop trigger if exists set_usuarios_updated_at on public.usuarios;
create trigger set_usuarios_updated_at before update on public.usuarios
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_usuarios_updated_at on public.usuarios;
create trigger trg_usuarios_updated_at before update on public.usuarios
for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ configuracoes -
create table if not exists public.configuracoes (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  geral jsonb not null default '{}'::jsonb,
  notificacoes jsonb not null default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fazenda_selecionada_id bigint references public.fazendas (id) on delete set null,
  constraint configuracoes_owner_user_id_key unique (owner_user_id)
);

create index if not exists configuracoes_fazenda_selecionada_id_idx on public.configuracoes (fazenda_selecionada_id);
create index if not exists configuracoes_created_at_idx on public.configuracoes (created_at desc);
create index if not exists configuracoes_updated_at_idx on public.configuracoes (updated_at desc);

drop trigger if exists set_configuracoes_updated_at on public.configuracoes;
create trigger set_configuracoes_updated_at before update on public.configuracoes
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_configuracoes_updated_at on public.configuracoes;
create trigger trg_configuracoes_updated_at before update on public.configuracoes
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------- cenarios -
-- id e uuid em producao (nao bigint identity como o dump manual afirmava).
-- Exclui: fazenda_id (bigint, adicionada por 20260722154003 —
-- cenarios_fazenda_id_e_rls). fazenda_id_legado_uuid/premissas_json/
-- resultado_projetado/created_by/updated_by sao baseline-original (nao
-- tocadas por nenhuma migration rastreada).
create table if not exists public.cenarios (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  fazenda_id_legado_uuid uuid,
  nome text not null,
  status text default 'rascunho',
  periodo_inicio date,
  periodo_fim date,
  observacoes text,
  compras_simuladas numeric default 0,
  vendas_simuladas numeric default 0,
  mortalidade_pct numeric default 0,
  natalidade_pct numeric default 0,
  valor_medio_venda numeric default 0,
  custo_medio_compra numeric default 0,
  capacidade_suporte_ua numeric default 0,
  area_pastagem_ha numeric default 0,
  premissas_json jsonb default '{}'::jsonb,
  resultado_projetado jsonb default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  lote_id bigint references public.lotes (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists cenarios_owner_user_id_idx on public.cenarios (owner_user_id);
create index if not exists cenarios_lote_id_idx on public.cenarios (lote_id);
create index if not exists cenarios_created_at_idx on public.cenarios (created_at desc);
create index if not exists cenarios_updated_at_idx on public.cenarios (updated_at desc);
create index if not exists idx_cenarios_status on public.cenarios (status);
create index if not exists idx_cenarios_fazenda_id on public.cenarios (fazenda_id_legado_uuid);

drop trigger if exists set_cenarios_updated_at on public.cenarios;
create trigger set_cenarios_updated_at before update on public.cenarios
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_updated_at_cenarios on public.cenarios;
create trigger set_updated_at_cenarios before update on public.cenarios
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- auditoria -
-- Somente select/insert nas policies (RLS na secao 6) — trilha imutavel de
-- proposito, sem update/delete.
create table if not exists public.auditoria (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  acao text not null,
  entidade text,
  entidade_id text,
  usuario_id uuid references auth.users (id) on delete set null,
  data timestamptz not null default now(),
  detalhes jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_hora timestamptz default timezone('utc', now()),
  criticidade text
);

create index if not exists auditoria_owner_user_id_idx on public.auditoria (owner_user_id);
create index if not exists auditoria_usuario_id_idx on public.auditoria (usuario_id);
create index if not exists auditoria_data_hora_idx on public.auditoria (data_hora desc);
create index if not exists auditoria_created_at_idx on public.auditoria (created_at desc);
create index if not exists auditoria_updated_at_idx on public.auditoria (updated_at desc);
create index if not exists idx_auditoria_entidade on public.auditoria (entidade, entidade_id);

drop trigger if exists set_auditoria_updated_at on public.auditoria;
create trigger set_auditoria_updated_at before update on public.auditoria
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_auditoria_updated_at on public.auditoria;
create trigger trg_auditoria_updated_at before update on public.auditoria
for each row execute function public.set_updated_at();

-- --------------------------------------------------------- alertas_resolvidos -
create table if not exists public.alertas_resolvidos (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  ack_key text not null,
  resolved_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  chave text,
  origem text,
  constraint alertas_resolvidos_owner_user_id_ack_key_key unique (owner_user_id, ack_key)
);

create index if not exists alertas_resolvidos_created_at_idx on public.alertas_resolvidos (created_at desc);
create index if not exists alertas_resolvidos_updated_at_idx on public.alertas_resolvidos (updated_at desc);
create index if not exists idx_alertas_resolvidos_chave on public.alertas_resolvidos (chave);

drop trigger if exists set_alertas_resolvidos_updated_at on public.alertas_resolvidos;
create trigger set_alertas_resolvidos_updated_at before update on public.alertas_resolvidos
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists trg_alertas_resolvidos_updated_at on public.alertas_resolvidos;
create trigger trg_alertas_resolvidos_updated_at before update on public.alertas_resolvidos
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------- alertas_adiados -
-- id e uuid em producao (nao bigint identity como o dump manual afirmava).
create table if not exists public.alertas_adiados (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  chave text not null,
  origem text,
  ate timestamptz,
  snooze_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alertas_adiados_owner_chave_key unique (owner_user_id, chave)
);

create index if not exists alertas_adiados_created_at_idx on public.alertas_adiados (created_at desc);
create index if not exists alertas_adiados_updated_at_idx on public.alertas_adiados (updated_at desc);
create index if not exists idx_alertas_adiados_chave on public.alertas_adiados (chave);

drop trigger if exists set_alertas_adiados_updated_at on public.alertas_adiados;
create trigger set_alertas_adiados_updated_at before update on public.alertas_adiados
for each row execute function public.set_current_timestamp_updated_at();

-- ----------------------------------------------------- consumo_suplementacao -
create table if not exists public.consumo_suplementacao (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  fazenda_id bigint references public.fazendas (id) on delete set null,
  lote_id bigint references public.lotes (id) on delete set null,
  item_estoque_id bigint references public.estoque (id) on delete set null,
  dieta_id bigint,
  origem_tipo text,
  ref_id bigint,
  produto_nome text,
  dieta_nome text,
  modo text,
  quantidade numeric(14, 4),
  qtd_total numeric(14, 4),
  quantidade_total numeric(14, 4),
  consumo_por_cabeca_dia numeric(14, 4),
  percentual_peso_vivo numeric(14, 4),
  peso_medio_usado numeric(14, 4),
  unidade text,
  custo_total numeric(14, 2),
  data date,
  obs text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists consumo_suplementacao_owner_user_id_idx on public.consumo_suplementacao (owner_user_id);
create index if not exists consumo_suplementacao_fazenda_id_idx on public.consumo_suplementacao (fazenda_id);
create index if not exists consumo_suplementacao_lote_id_idx on public.consumo_suplementacao (lote_id);
create index if not exists consumo_suplementacao_item_estoque_id_idx on public.consumo_suplementacao (item_estoque_id);
create index if not exists consumo_suplementacao_data_idx on public.consumo_suplementacao (data desc);
create index if not exists consumo_suplementacao_created_at_idx on public.consumo_suplementacao (created_at desc);
create index if not exists consumo_suplementacao_updated_at_idx on public.consumo_suplementacao (updated_at desc);

drop trigger if exists set_consumo_suplementacao_updated_at on public.consumo_suplementacao;
create trigger set_consumo_suplementacao_updated_at before update on public.consumo_suplementacao
for each row execute function public.set_current_timestamp_updated_at();

-- ------------------------------------------------------------ cenario_eventos -
-- Tabela sem NENHUM CREATE TABLE em qualquer migration rastreada (nem no
-- dump manual) — reconstruida inteiramente a partir do catalogo ao vivo.
-- Exclui: policies same_account (todas as 4 sao recriadas por
-- 20260722154003), trigger/funcao set_cenario_eventos_owner (criados por
-- 20260707161920), trigger trg_validar_integridade_conta_fazenda/funcao
-- validar_integridade_conta_fazenda (criados por 20260713224735).
create table if not exists public.cenario_eventos (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  cenario_id uuid references public.cenarios (id) on delete cascade,
  fazenda_id uuid,
  tipo text not null,
  descricao text,
  quantidade numeric default 0,
  valor_unitario numeric default 0,
  valor_total numeric default 0,
  data_evento date,
  payload jsonb default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_cenario_eventos_cenario_id on public.cenario_eventos (cenario_id);
create index if not exists idx_cenario_eventos_owner_user_id on public.cenario_eventos (owner_user_id);

drop trigger if exists set_updated_at_cenario_eventos on public.cenario_eventos;
create trigger set_updated_at_cenario_eventos before update on public.cenario_eventos
for each row execute function public.set_updated_at();

-- --------------------------------------------------------- eventos_operacionais -
-- Tabela sem NENHUM CREATE TABLE em qualquer migration rastreada (nem no
-- dump manual). Exclui: indices idx_eventos_operacionais_fazenda_id/lote_id/
-- funcionario_id/origem e o ALTER FUNCTION de search_path hardening (todos
-- de 20260707161920); policies same_account (recriadas por 20260702171318);
-- trigger trg_validar_integridade_conta_fazenda (20260713224735).
create table if not exists public.eventos_operacionais (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  origem text,
  origem_id text,
  tipo text,
  titulo text not null,
  descricao text,
  data_inicio date,
  data_fim date,
  status text,
  lote_id bigint references public.lotes (id) on delete set null,
  fazenda_id bigint references public.fazendas (id) on delete set null,
  funcionario_id bigint references public.funcionarios (id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_eventos_data on public.eventos_operacionais (data_inicio, data_fim);
create index if not exists idx_eventos_owner on public.eventos_operacionais (owner_user_id);

drop trigger if exists trg_eventos_operacionais_updated_at on public.eventos_operacionais;
create trigger trg_eventos_operacionais_updated_at before update on public.eventos_operacionais
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- suplementacao -
-- Tabela sem NENHUM CREATE TABLE em qualquer migration rastreada (nem no
-- dump manual). Exclui: policy suplementacao_insert_same_account (recriada
-- por 20260623220539 — a versao original tinha with_check(true), inseguro;
-- a baseline nao a recria, deixando 20260623220539 criar a versao corrigida
-- do zero); trigger trg_validar_integridade_conta_fazenda (20260713224735).
create table if not exists public.suplementacao (
  id bigint generated by default as identity primary key,
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  lote_id bigint references public.lotes (id) on delete set null,
  produto_id bigint references public.estoque (id) on delete set null,
  nome text,
  tipo text,
  data_inicio date,
  data_fim date,
  consumo_kg numeric(14, 3),
  consumo_kg_dia numeric(14, 3),
  custo_total numeric(14, 2),
  observacao text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_suplementacao_lote on public.suplementacao (lote_id);
create index if not exists idx_suplementacao_owner on public.suplementacao (owner_user_id);
create index if not exists idx_suplementacao_produto on public.suplementacao (produto_id);

drop trigger if exists trg_suplementacao_updated_at on public.suplementacao;
create trigger trg_suplementacao_updated_at before update on public.suplementacao
for each row execute function public.set_updated_at();

-- ============================================================================
-- 5) GRANTS MINIMOS
-- ============================================================================
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================================
-- 6) RLS — FUNCOES E POLICIES INICIAIS
-- ============================================================================
-- Nao inclui app_current_role_can_write() nem app_can_access_fazenda() —
-- ambas criadas por migrations rastreadas posteriores (20260713193754 e
-- 20260722145101, respectivamente). As policies "_owner"/"_own" abaixo usam
-- a forma pre-role-gate (owner_user_id = auth.uid()), que e exatamente a
-- forma que existia em producao antes de 20260713193754/20260713204723 —
-- essas duas migrations (dinamicas, via loop sobre pg_policies) adicionam o
-- gate de escrita quando replayadas, sem precisar que a baseline as
-- antecipe.

create or replace function public.app_current_owner_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_owner uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.owner_user_id
    into current_owner
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  return coalesce(current_owner, auth.uid());
end;
$$;

create or replace function public.app_current_profile_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.perfil::text
    into current_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  return current_role;
end;
$$;

create or replace function public.app_is_same_account(target_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and target_owner_user_id is not null
    and public.app_current_owner_user_id() = target_owner_user_id
$$;

create or replace function public.app_can_manage_account(target_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.app_is_same_account(target_owner_user_id)
    and coalesce(public.app_current_profile_role(), '') in ('proprietario', 'admin')
$$;

-- ---- profiles / invites / subscription_plans / customer_subscriptions /
-- ---- billing_events / checkout_sessions — nenhuma migration rastreada
-- ---- toca estas policies (confirmado via grep), copiadas como estao.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy profiles_select_same_account
on public.profiles for select to authenticated
using (auth.uid() = id or public.app_is_same_account(owner_user_id));

create policy profiles_insert_self_or_manager
on public.profiles for insert to authenticated
with check (
  (auth.uid() = id and coalesce(owner_user_id, auth.uid()) = public.app_current_owner_user_id())
  or public.app_can_manage_account(owner_user_id)
);

create policy profiles_update_self_or_manager
on public.profiles for update to authenticated
using (auth.uid() = id or public.app_can_manage_account(owner_user_id))
with check (
  (auth.uid() = id and public.app_is_same_account(owner_user_id))
  or public.app_can_manage_account(owner_user_id)
);

alter table public.invites enable row level security;
alter table public.invites force row level security;

create policy invites_select_same_account_managers
on public.invites for select to authenticated
using (public.app_can_manage_account(owner_user_id));

create policy invites_insert_same_account_managers
on public.invites for insert to authenticated
with check (public.app_can_manage_account(owner_user_id));

create policy invites_update_same_account_managers
on public.invites for update to authenticated
using (public.app_can_manage_account(owner_user_id))
with check (public.app_can_manage_account(owner_user_id));

create policy invites_delete_same_account_managers
on public.invites for delete to authenticated
using (public.app_can_manage_account(owner_user_id));

alter table public.subscription_plans enable row level security;
alter table public.subscription_plans force row level security;

create policy subscription_plans_select_authenticated
on public.subscription_plans for select to authenticated
using (true);

alter table public.customer_subscriptions enable row level security;
alter table public.customer_subscriptions force row level security;

create policy customer_subscriptions_select_same_account
on public.customer_subscriptions for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy customer_subscriptions_insert_same_account
on public.customer_subscriptions for insert to authenticated
with check (public.app_can_manage_account(owner_user_id));

create policy customer_subscriptions_update_same_account
on public.customer_subscriptions for update to authenticated
using (public.app_can_manage_account(owner_user_id))
with check (public.app_can_manage_account(owner_user_id));

create policy customer_subscriptions_delete_same_account
on public.customer_subscriptions for delete to authenticated
using (public.app_can_manage_account(owner_user_id));

alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

create policy billing_events_select_same_account
on public.billing_events for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy billing_events_insert_same_account
on public.billing_events for insert to authenticated
with check (public.app_can_manage_account(owner_user_id));

create policy billing_events_update_same_account
on public.billing_events for update to authenticated
using (public.app_can_manage_account(owner_user_id))
with check (public.app_can_manage_account(owner_user_id));

create policy billing_events_delete_same_account
on public.billing_events for delete to authenticated
using (public.app_can_manage_account(owner_user_id));

alter table public.checkout_sessions enable row level security;
alter table public.checkout_sessions force row level security;

create policy checkout_sessions_select_same_account
on public.checkout_sessions for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy checkout_sessions_insert_same_account
on public.checkout_sessions for insert to authenticated
with check (public.app_can_manage_account(owner_user_id));

create policy checkout_sessions_update_same_account
on public.checkout_sessions for update to authenticated
using (public.app_can_manage_account(owner_user_id))
with check (public.app_can_manage_account(owner_user_id));

create policy checkout_sessions_delete_same_account
on public.checkout_sessions for delete to authenticated
using (public.app_can_manage_account(owner_user_id));

-- ---- Tabelas "owner" (padrao _owner + _same_account em pares, mesma forma
-- ---- em toda tabela: select sem gate de escrita, insert/update/delete com
-- ---- owner_user_id = auth.uid() [pre-role-gate]). Aplica-se um loop generico
-- ---- do mesmo jeito que o do bundle de RLS original — mantido assim de
-- ---- proposito: migrations POSTERIORES (20260722145101, 20260722151402,
-- ---- 20260702171318, 20260722154003) recriam o same_account de varias
-- ---- destas tabelas via DROP POLICY IF EXISTS + CREATE POLICY (idempotente),
-- ---- entao nao ha necessidade de excluir a versao original daqui: ela e
-- ---- corretamente substituida quando as 31 migrations rodam em sequencia.
do $$
declare
  table_name text;
  owner_tables text[] := array[
    'fazendas', 'animais', 'pesagens', 'sanitario', 'estoque',
    'movimentacoes_estoque', 'movimentacoes_financeiras', 'movimentacoes_animais',
    'custos', 'funcionarios', 'rotinas', 'tarefas', 'usuarios', 'configuracoes',
    'alertas_resolvidos'
  ];
begin
  foreach table_name in array owner_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_user_id = auth.uid())',
      table_name || '_select_owner', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_user_id = auth.uid())',
      table_name || '_insert_owner', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())',
      table_name || '_update_owner', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_user_id = auth.uid())',
      table_name || '_delete_owner', table_name
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_select_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_is_same_account(owner_user_id))',
      table_name || '_insert_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_is_same_account(owner_user_id)) with check (public.app_is_same_account(owner_user_id))',
      table_name || '_update_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_delete_same_account', table_name
    );
  end loop;
end $$;

-- ---- Tabelas "_own" (mesmo padrao, sufixo _own em vez de _owner —
-- ---- convencao de nomenclatura historica que a producao mantem hoje).
do $$
declare
  table_name text;
  own_tables text[] := array['cenarios', 'lotes', 'pastagens'];
begin
  foreach table_name in array own_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_user_id = auth.uid())',
      table_name || '_select_own', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_user_id = auth.uid())',
      table_name || '_insert_own', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid())',
      table_name || '_update_own', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_user_id = auth.uid())',
      table_name || '_delete_own', table_name
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_select_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_is_same_account(owner_user_id))',
      table_name || '_insert_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_is_same_account(owner_user_id)) with check (public.app_is_same_account(owner_user_id))',
      table_name || '_update_same_account', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_delete_same_account', table_name
    );
  end loop;
end $$;

-- ---- auditoria — somente select/insert, trilha imutavel de proposito.
alter table public.auditoria enable row level security;
alter table public.auditoria force row level security;

create policy auditoria_select_owner
on public.auditoria for select to authenticated
using (owner_user_id = auth.uid());

create policy auditoria_insert_owner
on public.auditoria for insert to authenticated
with check (owner_user_id = auth.uid());

create policy auditoria_select_same_account
on public.auditoria for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy auditoria_insert_same_account
on public.auditoria for insert to authenticated
with check (public.app_is_same_account(owner_user_id));

-- ---- alertas_adiados / consumo_suplementacao — somente same_account em
-- ---- producao hoje (nunca tiveram o par _owner).
alter table public.alertas_adiados enable row level security;
alter table public.alertas_adiados force row level security;

create policy alertas_adiados_select_same_account
on public.alertas_adiados for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy alertas_adiados_insert_same_account
on public.alertas_adiados for insert to authenticated
with check (public.app_is_same_account(owner_user_id));

create policy alertas_adiados_update_same_account
on public.alertas_adiados for update to authenticated
using (public.app_is_same_account(owner_user_id))
with check (public.app_is_same_account(owner_user_id));

create policy alertas_adiados_delete_same_account
on public.alertas_adiados for delete to authenticated
using (public.app_is_same_account(owner_user_id));

alter table public.consumo_suplementacao enable row level security;
alter table public.consumo_suplementacao force row level security;

create policy consumo_suplementacao_select_same_account
on public.consumo_suplementacao for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy consumo_suplementacao_insert_same_account
on public.consumo_suplementacao for insert to authenticated
with check (public.app_is_same_account(owner_user_id));

create policy consumo_suplementacao_update_same_account
on public.consumo_suplementacao for update to authenticated
using (public.app_is_same_account(owner_user_id))
with check (public.app_is_same_account(owner_user_id));

create policy consumo_suplementacao_delete_same_account
on public.consumo_suplementacao for delete to authenticated
using (public.app_is_same_account(owner_user_id));

-- ---- cenario_eventos — apenas as 4 policies "_own" (owner_user_id nullable
-- ---- em producao, entao a policy usa exatamente essa coluna sem exigir
-- ---- NOT NULL). As 4 "_same_account" NAO entram aqui — 20260722154003
-- ---- recria as 4 do zero.
alter table public.cenario_eventos enable row level security;
alter table public.cenario_eventos force row level security;

create policy cenario_eventos_select_own
on public.cenario_eventos for select to authenticated
using (owner_user_id = auth.uid());

create policy cenario_eventos_insert_own
on public.cenario_eventos for insert to authenticated
with check (owner_user_id = auth.uid());

create policy cenario_eventos_update_own
on public.cenario_eventos for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy cenario_eventos_delete_own
on public.cenario_eventos for delete to authenticated
using (owner_user_id = auth.uid());

-- ---- eventos_operacionais — apenas as 4 policies "_owner". As 4
-- ---- "_same_account" NAO entram aqui — 20260702171318 recria as 4 do zero.
alter table public.eventos_operacionais enable row level security;
alter table public.eventos_operacionais force row level security;

create policy eventos_operacionais_select_owner
on public.eventos_operacionais for select to authenticated
using (owner_user_id = auth.uid());

create policy eventos_operacionais_insert_owner
on public.eventos_operacionais for insert to authenticated
with check (owner_user_id = auth.uid());

create policy eventos_operacionais_update_owner
on public.eventos_operacionais for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy eventos_operacionais_delete_owner
on public.eventos_operacionais for delete to authenticated
using (owner_user_id = auth.uid());

-- ---- suplementacao — as 4 "_owner" + select/update/delete "_same_account"
-- ---- (nao tocadas por nenhuma migration). insert_same_account NAO entra
-- ---- aqui — 20260623220539 a recria do zero com o with_check correto.
alter table public.suplementacao enable row level security;
alter table public.suplementacao force row level security;

create policy suplementacao_select_owner
on public.suplementacao for select to authenticated
using (owner_user_id = auth.uid());

create policy suplementacao_insert_owner
on public.suplementacao for insert to authenticated
with check (owner_user_id = auth.uid());

create policy suplementacao_update_owner
on public.suplementacao for update to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy suplementacao_delete_owner
on public.suplementacao for delete to authenticated
using (owner_user_id = auth.uid());

create policy suplementacao_select_same_account
on public.suplementacao for select to authenticated
using (public.app_is_same_account(owner_user_id));

create policy suplementacao_update_same_account
on public.suplementacao for update to authenticated
using (public.app_is_same_account(owner_user_id))
with check (public.app_is_same_account(owner_user_id));

create policy suplementacao_delete_same_account
on public.suplementacao for delete to authenticated
using (public.app_is_same_account(owner_user_id));
