-- Sprint 6 — Equipe e Permissões (docs/EQUIPE_PERMISSOES_HERDON.md)
-- Duas mudanças aditivas e não-destrutivas: nenhuma tabela dropada, nenhum
-- dado apagado, nenhuma coluna removida.

-- ============================================================
-- 1) profiles.status — permite "remover acesso" de um membro já aceito
-- sem apagar a linha (profiles não tem policy de DELETE, de propósito).
-- Default 'ativo' preenche todas as linhas existentes sem quebrar nada.
-- ============================================================
alter table public.profiles
  add column if not exists status text not null default 'ativo';

alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check check (status in ('ativo', 'removido')) not valid;

alter table public.profiles
  validate constraint profiles_status_check;

-- ============================================================
-- 2) app_can_manage_account: remove 'gerente' do grupo que pode gerenciar
-- convites/perfis/assinatura/cobrança. Regra explícita desta sprint:
-- "apenas proprietário/admin gerencia equipe" — e o mesmo guarda já protegia
-- billing_events/checkout_sessions/customer_subscriptions, então a mudança
-- também fecha o acesso de gerente a essas tabelas de cobrança, consistente
-- com "gerente não altera plano". Hoje não existe nenhum profile com
-- perfil='gerente' em produção (confirmado antes de aplicar), então o
-- impacto imediato é zero.
-- ============================================================
create or replace function public.app_can_manage_account(target_owner_user_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    public.app_is_same_account(target_owner_user_id)
    and lower(coalesce(public.app_current_profile_role(), '')) in ('proprietario', 'admin')
$function$;
