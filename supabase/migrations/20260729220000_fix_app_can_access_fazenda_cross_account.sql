-- Sprint 8 — corrige app_can_access_fazenda (auditoria SECURITY DEFINER, P1).
--
-- Comportamento ANTERIOR (confirmado ao vivo antes desta migration):
--   select
--     app_current_fazenda_id() is null
--     or target_fazenda_id is null
--     or target_fazenda_id = app_current_fazenda_id()
--
-- Como todo dono/gestor de conta (e qualquer membro sem restrição de
-- fazenda) tem profiles.fazenda_id = null, o primeiro OR fazia a função
-- devolver TRUE para QUALQUER target_fazenda_id — inclusive de outra
-- conta — sempre que o próprio perfil não tinha fazenda fixa. Confirmado
-- com chamada anônima e com usuário autenticado real: as duas devolviam
-- true para uma fazenda pertencente a outra conta.
--
-- Isso nunca causou vazamento de dado real porque, confirmado nesta
-- mesma auditoria, as 74 policies de RLS que chamam esta função SEMPRE a
-- combinam como `app_is_same_account(owner_user_id) AND
-- app_can_access_fazenda(fazenda_id)` — nenhuma policy a usa sozinha. Ainda
-- assim, é uma função pública (anon incluso) que responde errado a uma
-- pergunta de autorização, e vira um ponto único de falha para qualquer
-- policy ou RPC futura que venha a confiar nela isoladamente.
--
-- CORREÇÃO: a função passa a validar a posse real da fazenda consultando
-- `public.fazendas`, comparando `fazendas.owner_user_id` com a conta
-- resolvida por `app_current_owner_user_id()` — nunca aceitando
-- owner_user_id como parâmetro novo (a conta continua vindo só de
-- auth.uid()/profiles, como as demais funções app_*).
--
-- Regras da nova implementação:
--   1. Sem auth.uid() (anônimo) ou sem conta resolvida -> false.
--   2. target_fazenda_id IS NULL -> true (decisão deliberada, ver abaixo).
--   3. Perfil restrito a uma fazenda (profiles.fazenda_id definido):
--      só true se target_fazenda_id for exatamente essa fazenda E ela
--      realmente pertencer à conta resolvida (revalidado contra
--      `fazendas`, não só comparado ao valor do perfil).
--   4. Perfil sem restrição (profiles.fazenda_id null): true só se
--      target_fazenda_id existir em `fazendas` com
--      owner_user_id = app_current_owner_user_id().
--   5. Fazenda de outra conta, ou id inexistente -> false, em qualquer
--      um dos casos acima.
--
-- Decisão documentada para target_fazenda_id IS NULL (regra 2): mantida
-- como TRUE, e coberta por teste. Motivo: várias tabelas guardam
-- fazenda_id/faz_id nullable para registros legítimos ainda não
-- vinculados a uma fazenda específica (ex.: lote/pasto/custo criado antes
-- de escolher a fazenda, ou consolidado entre fazendas). Um NULL não é um
-- valor de outra conta — não há "propriedade de outra conta" para negar.
-- Essa regra só é segura porque, confirmado nesta auditoria, TODAS as
-- policies que chamam esta função também exigem
-- `app_is_same_account(owner_user_id)` na mesma linha — ou seja, o
-- isolamento entre contas para registros sem fazenda continua garantido
-- pelo lado de fora desta função, nunca só por ela.
--
-- service_role: nenhum tratamento especial foi adicionado. Confirmado
-- que `service_role` tem `rolbypassrls = true` (ignora RLS
-- completamente) e que esta função nunca é chamada diretamente pelo
-- backend/frontend (grep em api/ e src/: zero ocorrências) — logo, o
-- comportamento desta função é irrelevante para chamadas service_role
-- reais, e não há liberação genérica a preservar.
create or replace function public.app_can_access_fazenda(target_fazenda_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and public.app_current_owner_user_id() is not null
    and (
      target_fazenda_id is null
      or exists (
        select 1
        from public.fazendas f
        where f.id = target_fazenda_id
          and f.owner_user_id = public.app_current_owner_user_id()
          and (
            public.app_current_fazenda_id() is null
            or f.id = public.app_current_fazenda_id()
          )
      )
    )
$$;
