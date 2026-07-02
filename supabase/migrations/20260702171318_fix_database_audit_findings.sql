-- Correções pós-auditoria do banco HERDON (docs/AUDITORIA_BANCO_DADOS_HERDON.md)
-- Achados A1, M1 e M2. Sem exclusão de dados, sem drop de tabela/coluna.
-- Aplicada no projeto ljpiszxicmmuefbiixui em 2026-07-02 (versão 20260702171318).

-- ============================================================
-- A1: remover função órfã handle_new_user()
-- Confirmado antes da migration: nenhum trigger depende dela
-- (o trigger ativo on_auth_user_created usa handle_new_user_profile).
-- Ela inseria perfil='PROPRIETARIO', valor fora da CHECK
-- profiles_perfil_check ('admin','gerente','operador','visualizador').
-- ============================================================
drop function if exists public.handle_new_user();

-- ============================================================
-- M1: backfill de profiles.owner_user_id
-- Análise pré-migration: os 7 profiles com owner_user_id NULL
-- (2 admin + 5 visualizador) não são subusuários — nenhum outro
-- profile os referencia como owner e eles não apontam para dono.
-- app_current_owner_user_id() já faz coalesce(owner_user_id, auth.uid()),
-- então owner_user_id = id preserva o comportamento efetivo atual.
-- ============================================================
update public.profiles
set owner_user_id = id
where owner_user_id is null;

-- ============================================================
-- M2: policies same_account em eventos_operacionais
-- Mesmo padrão das demais tabelas operacionais (pesagens, sanitario,
-- lotes, etc.): pares _owner + _same_account por comando, usando
-- app_is_same_account(owner_user_id). As policies _owner existentes
-- não são alteradas.
-- ============================================================
drop policy if exists eventos_operacionais_select_same_account on public.eventos_operacionais;
create policy eventos_operacionais_select_same_account
  on public.eventos_operacionais
  for select
  to authenticated
  using (app_is_same_account(owner_user_id));

drop policy if exists eventos_operacionais_insert_same_account on public.eventos_operacionais;
create policy eventos_operacionais_insert_same_account
  on public.eventos_operacionais
  for insert
  to authenticated
  with check (app_is_same_account(owner_user_id));

drop policy if exists eventos_operacionais_update_same_account on public.eventos_operacionais;
create policy eventos_operacionais_update_same_account
  on public.eventos_operacionais
  for update
  to authenticated
  using (app_is_same_account(owner_user_id))
  with check (app_is_same_account(owner_user_id));

drop policy if exists eventos_operacionais_delete_same_account on public.eventos_operacionais;
create policy eventos_operacionais_delete_same_account
  on public.eventos_operacionais
  for delete
  to authenticated
  using (app_is_same_account(owner_user_id));
