-- Autorização real por perfil (Parte 1): ate aqui o RLS so validava
-- pertencimento a conta (app_is_same_account), nunca o papel do usuario.
-- Um "visualizador" (perfil somente-leitura por design do produto, ver
-- src/auth/perfis.js) conseguia INSERT/UPDATE/DELETE direto via API,
-- contornando toda checagem de permissao da interface.
--
-- app_current_role_can_write() nega por padrao (null/vazio/visualizador),
-- so libera quando o perfil e um valor conhecido diferente de "visualizador".
create or replace function public.app_current_role_can_write()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    auth.uid() is not null
    and lower(coalesce(public.app_current_profile_role(), '')) not in ('', 'visualizador')
$$;

-- Aplica o gate de papel em toda policy "_same_account" de escrita
-- (INSERT/UPDATE/DELETE) que hoje so checa app_is_same_account(owner_user_id).
-- Tabelas ja protegidas por app_can_manage_account (invites, billing_events,
-- checkout_sessions, customer_subscriptions, profiles) nao usam esse padrao
-- de texto e portanto nao sao tocadas aqui.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (
        qual = 'app_is_same_account(owner_user_id)'
        or with_check = 'app_is_same_account(owner_user_id)'
      )
  loop
    if pol.cmd = 'INSERT' then
      execute format(
        'alter policy %I on public.%I with check (app_is_same_account(owner_user_id) and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    elsif pol.cmd = 'DELETE' then
      execute format(
        'alter policy %I on public.%I using (app_is_same_account(owner_user_id) and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    elsif pol.cmd = 'UPDATE' then
      execute format(
        'alter policy %I on public.%I using (app_is_same_account(owner_user_id) and app_current_role_can_write()) with check (app_is_same_account(owner_user_id) and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    end if;
  end loop;
end $$;
