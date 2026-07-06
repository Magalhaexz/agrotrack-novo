-- Sprint 7 — Telegram multiusuário por fazenda/usuário
--
-- Substitui o modelo de conta única (TELEGRAM_OWNER_USER_ID/TELEGRAM_CHAT_ID
-- fixos em variável de ambiente, Sprint 6) por conexões pessoais: cada
-- usuário conecta seu próprio chat do Telegram ao HERDON via código
-- temporário, sem expor owner_user_id ao frontend.
--
-- RLS aqui é por user_id (dono direto da conexão), não por
-- app_is_same_account: quem conecta um Telegram só pode ver/gerenciar a
-- própria conexão, mesmo que outro usuário da mesma conta veja dados
-- operacionais compartilhados (M2, 20260702171318).

-- 1. telegram_connections — uma conexão ativa por usuário HERDON
CREATE TABLE IF NOT EXISTS public.telegram_connections (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id             uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fazenda_id                bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  telegram_chat_id          text NOT NULL,
  telegram_username         text,
  telegram_first_name       text,
  telegram_last_name        text,
  is_active                 boolean NOT NULL DEFAULT true,
  daily_report_enabled      boolean NOT NULL DEFAULT true,
  alert_payments_enabled    boolean NOT NULL DEFAULT true,
  alert_stock_enabled       boolean NOT NULL DEFAULT true,
  alert_tasks_enabled       boolean NOT NULL DEFAULT true,
  alert_health_enabled      boolean NOT NULL DEFAULT true,
  report_time               time NOT NULL DEFAULT '07:00:00',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_connections_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_owner_user_id
  ON public.telegram_connections (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_connections_daily_report
  ON public.telegram_connections (is_active, daily_report_enabled);

DROP TRIGGER IF EXISTS set_telegram_connections_updated_at ON public.telegram_connections;
CREATE TRIGGER set_telegram_connections_updated_at
  BEFORE UPDATE ON public.telegram_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;

-- Só o próprio usuário enxerga/edita a conexão. Insert/delete ficam sem
-- policy para authenticated de propósito: só a service role (webhook)
-- cria linhas, o frontend só ajusta preferências e desativa (UPDATE).
DROP POLICY IF EXISTS telegram_connections_select_own ON public.telegram_connections;
CREATE POLICY telegram_connections_select_own ON public.telegram_connections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS telegram_connections_update_own ON public.telegram_connections;
CREATE POLICY telegram_connections_update_own ON public.telegram_connections
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. telegram_connection_codes — código temporário de pareamento
CREATE TABLE IF NOT EXISTS public.telegram_connection_codes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fazenda_id     bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  code           text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  used_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_connection_codes_user_id
  ON public.telegram_connection_codes (user_id);

-- Nenhuma policy para anon/authenticated: só o endpoint server-side (service
-- role, api/telegram-gerar-codigo.js e api/telegram-webhook.js) lê/escreve
-- aqui. Isso evita expor código de outro usuário.
ALTER TABLE public.telegram_connection_codes ENABLE ROW LEVEL SECURITY;

-- 3. telegram_notification_logs — trilha de envio (server-side apenas)
CREATE TABLE IF NOT EXISTS public.telegram_notification_logs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id            uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  telegram_connection_id   uuid REFERENCES public.telegram_connections (id) ON DELETE SET NULL,
  notification_type        text NOT NULL,
  status                   text NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message            text,
  sent_at                  timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_notification_logs_owner_user_id
  ON public.telegram_notification_logs (owner_user_id);

ALTER TABLE public.telegram_notification_logs ENABLE ROW LEVEL SECURITY;
