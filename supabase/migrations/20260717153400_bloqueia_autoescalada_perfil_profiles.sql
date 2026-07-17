-- Corrige vulnerabilidade CRÍTICA (P0) encontrada na auditoria 360º: a
-- policy legada "Users can update own profile basics" (UPDATE, qual/with_check
-- = auth.uid() = id, sem nenhuma restrição de coluna) permite que QUALQUER
-- usuário autenticado altere seu PRÓPRIO `perfil` para 'proprietario' via uma
-- chamada direta à API REST (`PATCH /rest/v1/profiles?id=eq.<seu_id>`), já que
-- policies permissivas do Postgres se combinam por OR — essa policy antiga
-- convivia com `profiles_update_self_or_manager` (mais nova, mas que TAMBÉM
-- não restringe colunas: seu with_check só valida a LINHA, não que `perfil`
-- ficou igual). Nenhum trigger impedia a mudança. Com `perfil='proprietario'`,
-- o próprio usuário passa a satisfazer `app_can_manage_account()` para a sua
-- conta e pode então rebaixar/expulsar o dono real — escalada de privilégio
-- completa em uma única chamada.
--
-- Fix (defesa em profundidade, cobre as duas policies):
-- 1. Remove a policy legada, totalmente redundante com `profiles_update_self_or_manager`.
-- 2. Trigger BEFORE UPDATE bloqueia qualquer auto-atualização (auth.uid() = id
--    da linha antiga) que mude `perfil` OU `owner_user_id` — as duas colunas
--    que determinam poder/escopo de conta. Fluxo legítimo (gerente/proprietário
--    alterando o perfil de OUTRO membro da equipe, `updateProfilePerfil` em
--    src/services/userAccess.js) não é afetado: nesse caso `auth.uid() <> id`
--    da linha alterada, então o trigger nunca dispara.

drop policy if exists "Users can update own profile basics" on public.profiles;

create or replace function public.profiles_bloquear_autoescalada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() = old.id then
    if new.perfil is distinct from old.perfil then
      raise exception 'Você não pode alterar seu próprio perfil de acesso.' using errcode = '42501';
    end if;
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Você não pode alterar sua própria conta vinculada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_bloquear_autoescalada on public.profiles;
create trigger trg_profiles_bloquear_autoescalada
  before update on public.profiles
  for each row execute function public.profiles_bloquear_autoescalada();
