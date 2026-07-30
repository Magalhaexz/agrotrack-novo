-- Recuperada na Sprint 2 de reconciliação de versões (docs/SPRINT2_RECONCILIACAO_VERSOES_MIGRATIONS.md).
-- Esta migration só existia registrada em supabase_migrations.schema_migrations
-- (versão 20260626221604), sem arquivo .sql correspondente no repositório —
-- foi aplicada em 2026-06-26 via Supabase MCP (apply_migration), sem nunca
-- ter sido commitada como arquivo. O SQL abaixo é uma cópia literal do bloco
-- documentado em docs/AUDITORIA_VISUAL_UX_HERDON.md, seção "10. Correção —
-- usuários autenticados sem public.profiles (2026-06-26)", escrito na mesma
-- sessão em que a correção foi aplicada — não é uma reconstrução de memória.
--
-- Correspondência confirmada com o estado real do banco antes de recuperar
-- este arquivo: `profiles.perfil` tem DEFAULT 'admin'::text hoje (efeito do
-- ALTER TABLE abaixo, nunca revertido por migration posterior).
--
-- Causa raiz: `handle_new_user_profile()` (e o DEFAULT da coluna `perfil`)
-- inseriam o valor 'PROPRIETARIO', que nunca satisfazia a CHECK constraint
-- de profiles.perfil (admin/gerente/operador/visualizador) — o trigger
-- engolia o erro num `exception when others` e o usuário ficava autenticado
-- sem profile, sem erro visível.
--
-- Nota: o corpo de handle_new_user_profile() abaixo foi substituído por uma
-- versão posterior (migration 20260722145101_convite_equipe_fazenda_vinculo,
-- que adiciona a checagem de convite pendente) — não precisa bater com o
-- estado atual da função, só representar fielmente o que esta versão,
-- especificamente, aplicou naquele momento da linha do tempo.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Novo usuário'
  );

  insert into public.profiles (id, email, nome, perfil, owner_user_id, created_at, updated_at)
  values (new.id, new.email, resolved_name, 'admin', new.id, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do update
  set
    email = excluded.email,
    nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome),
    perfil = coalesce(nullif(public.profiles.perfil, ''), excluded.perfil),
    owner_user_id = coalesce(public.profiles.owner_user_id, excluded.owner_user_id),
    updated_at = timezone('utc', now());

  return new;
exception
  when others then
    raise warning 'HERDON handle_new_user_profile failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$function$;

alter table public.profiles alter column perfil set default 'admin';
