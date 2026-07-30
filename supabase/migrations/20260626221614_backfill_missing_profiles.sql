-- Recuperada na Sprint 2 de reconciliação de versões (docs/SPRINT2_RECONCILIACAO_VERSOES_MIGRATIONS.md).
-- Esta migration só existia registrada em supabase_migrations.schema_migrations
-- (versão 20260626221614), sem arquivo .sql correspondente no repositório —
-- aplicada em 2026-06-26 via Supabase MCP (apply_migration), logo após
-- 20260626221604_fix_handle_new_user_profile_perfil_constraint.sql, para
-- corrigir os usuários já criados antes da correção da constraint (que
-- tinham ficado sem linha em public.profiles). SQL copiado literalmente de
-- docs/AUDITORIA_VISUAL_UX_HERDON.md, seção "10. Correção — usuários
-- autenticados sem public.profiles (2026-06-26)" — não é uma reconstrução.
--
-- Correspondência confirmada com o estado real do banco antes de recuperar
-- este arquivo: `select count(*) from auth.users u left join public.profiles
-- p on p.id = u.id where p.id is null` retorna 0 hoje.
insert into public.profiles (id, email, nome, perfil, owner_user_id, created_at, updated_at)
select u.id, u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nome'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Novo usuário'
  ),
  'admin', u.id, timezone('utc', now()), timezone('utc', now())
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
