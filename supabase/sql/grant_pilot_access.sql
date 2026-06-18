-- Beta Piloto HERDON — Concessão de acesso ao criador piloto
--
-- Como usar:
-- 1. O criador piloto se cadastra na URL de produção.
-- 2. Você busca o UUID do usuário em: Supabase > Authentication > Users
-- 3. Substitua '<UUID-DO-PILOTO>' abaixo pelo UUID real.
-- 4. Execute este script no Supabase SQL Editor (com service_role).
-- 5. O piloto faz logout e login — plano Fundador estará ativo.
--
-- Para revogar acesso:
-- UPDATE customer_subscriptions
--   SET status = 'canceled', updated_at = now()
--   WHERE owner_user_id = '<UUID-DO-PILOTO>';

INSERT INTO public.customer_subscriptions (
  owner_user_id,
  plan_code,
  status,
  billing_provider,
  current_period_start,
  current_period_end,
  raw_payload
)
VALUES (
  '<UUID-DO-PILOTO>',
  'fundador',
  'internal_test',
  'manual',
  now(),
  now() + INTERVAL '30 days',
  '{"beta_piloto": true, "concedido_em": "2026-06-18", "concedido_por": "admin-herdon"}'::jsonb
)
ON CONFLICT (owner_user_id) DO UPDATE
  SET
    plan_code             = EXCLUDED.plan_code,
    status                = EXCLUDED.status,
    billing_provider      = EXCLUDED.billing_provider,
    current_period_start  = EXCLUDED.current_period_start,
    current_period_end    = EXCLUDED.current_period_end,
    raw_payload           = EXCLUDED.raw_payload,
    updated_at            = now();
