-- Sprint 17 — Limpeza de Banco: índices faltantes em FK e hardening de search_path
--
-- Auditoria prévia via Supabase MCP (docs/SPRINT17_LIMPEZA_BANCO_RLS_MIGRATIONS.md):
-- 13 colunas de foreign key sem índice líder e 5 tabelas usando o padrão
-- genérico origem_tipo/origem_id (já usado por Sanidade→Estoque desde a
-- Sprint 15, e por outros módulos) sem índice composto. Nenhuma tabela nova,
-- nenhuma coluna nova, nenhum dado alterado — só índices e SET search_path.
-- Idempotente: seguro para rodar mais de uma vez.

-- ============================================================
-- 1) Índices para foreign keys sem índice líder
-- ============================================================
create index if not exists idx_alertas_tratativas_fazenda_id
  on public.alertas_tratativas (fazenda_id);
create index if not exists idx_customer_subscriptions_farm_id
  on public.customer_subscriptions (farm_id);
create index if not exists idx_customer_subscriptions_fazenda_id
  on public.customer_subscriptions (fazenda_id);
create index if not exists idx_eventos_operacionais_fazenda_id
  on public.eventos_operacionais (fazenda_id);
create index if not exists idx_eventos_operacionais_lote_id
  on public.eventos_operacionais (lote_id);
create index if not exists idx_eventos_operacionais_funcionario_id
  on public.eventos_operacionais (funcionario_id);
create index if not exists idx_lote_pastagens_historico_pastagem_destino_id
  on public.lote_pastagens_historico (pastagem_destino_id);
create index if not exists idx_lote_pastagens_historico_pastagem_origem_id
  on public.lote_pastagens_historico (pastagem_origem_id);
create index if not exists idx_sanitario_rotina_automatica_id
  on public.sanitario (rotina_automatica_id);
create index if not exists idx_telegram_connection_codes_fazenda_id
  on public.telegram_connection_codes (fazenda_id);
create index if not exists idx_telegram_connections_fazenda_id
  on public.telegram_connections (fazenda_id);
create index if not exists idx_telegram_notification_logs_connection_id
  on public.telegram_notification_logs (telegram_connection_id);

-- ============================================================
-- 2) Índices compostos para o padrão genérico origem_tipo/origem_id
-- (mesma convenção usada por movimentacoes_estoque desde a Sprint 15,
-- sem índice em nenhuma das tabelas que a usam)
-- ============================================================
create index if not exists idx_movimentacoes_estoque_origem
  on public.movimentacoes_estoque (origem_tipo, origem_id);
create index if not exists idx_movimentacoes_animais_origem
  on public.movimentacoes_animais (origem_tipo, origem_id);
create index if not exists idx_movimentacoes_financeiras_origem
  on public.movimentacoes_financeiras (origem_tipo, origem_id);
create index if not exists idx_custos_origem
  on public.custos (origem, origem_id);
create index if not exists idx_eventos_operacionais_origem
  on public.eventos_operacionais (origem, origem_id);

-- ============================================================
-- 3) search_path fixo nas funções apontadas pelo advisor de segurança
-- (function_search_path_mutable) — mesmo padrão já usado por
-- app_is_same_account/app_current_owner_user_id/handle_new_user_profile/
-- mover_lote_para_pasto. Corpo das funções inalterado.
-- ============================================================
create or replace function public.set_cenario_eventos_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.owner_user_id is null then
    new.owner_user_id = auth.uid();
  end if;

  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  new.updated_by = auth.uid();

  return new;
end;
$function$;

create or replace function public.set_cenarios_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.owner_user_id is null then
    new.owner_user_id = auth.uid();
  end if;

  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  new.updated_by = auth.uid();

  return new;
end;
$function$;

create or replace function public.set_pastagens_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.owner_user_id is null then
    new.owner_user_id = auth.uid();
  end if;

  if new.created_by is null then
    new.created_by = auth.uid();
  end if;

  new.updated_by = auth.uid();

  return new;
end;
$function$;

alter function public.set_updated_at() set search_path = public;
alter function public.set_current_timestamp_updated_at() set search_path = public;

-- ============================================================
-- 4) force row level security nas 4 tabelas criadas após a
-- padronização da migration 20260623220539 (que forçou RLS nas 4
-- tabelas existentes até então) — mesma justificativa: não afeta
-- conexões normais do app (role "authenticated" sempre respeita RLS),
-- só padroniza o nível de proteção contra o role "owner" da tabela.
-- ============================================================
alter table public.telegram_connections force row level security;
alter table public.telegram_connection_codes force row level security;
alter table public.telegram_notification_logs force row level security;
alter table public.alertas_tratativas force row level security;
