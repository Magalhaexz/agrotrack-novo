-- Sprint Bot Interativo — operações pendentes de confirmação + auditoria de ações.
--
-- Ambas as tabelas são escritas SÓ pela service role (webhook do Telegram,
-- api/telegram-webhook.js) — mesmo padrão de telegram_connection_codes: RLS
-- ligada, sem policy de INSERT/UPDATE/DELETE para authenticated. O dono da
-- conta pode LER a própria auditoria pelo app.

-- 1. telegram_operacoes_pendentes — ações mutáveis aguardando /confirmar (Parte 15)
CREATE TABLE IF NOT EXISTS public.telegram_operacoes_pendentes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  telegram_chat_id  text NOT NULL,
  fazenda_id        bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  tipo_operacao     text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            text NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','confirmada','cancelada','expirada','executada','erro')),
  criado_em         timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL,
  confirmado_em     timestamptz,
  executado_em      timestamptz,
  erro              text
);

-- Só existe uma operação pendente por chat de cada vez (a nova substitui a
-- anterior via lógica do webhook); o índice acelera "buscar a pendente do chat".
CREATE INDEX IF NOT EXISTS idx_tg_operacoes_pendentes_chat
  ON public.telegram_operacoes_pendentes (telegram_chat_id, status);
CREATE INDEX IF NOT EXISTS idx_tg_operacoes_pendentes_owner
  ON public.telegram_operacoes_pendentes (owner_user_id);

ALTER TABLE public.telegram_operacoes_pendentes ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: só service role. Owner nem precisa ler isso.

-- 2. telegram_bot_auditoria — trilha de toda ação do bot (Parte 16)
CREATE TABLE IF NOT EXISTS public.telegram_bot_auditoria (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id           uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  telegram_chat_id  text,
  fazenda_id        bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  comando_original  text,
  intencao          text,
  acao              text NOT NULL,
  dados_anteriores  jsonb,
  dados_posteriores jsonb,
  sucesso           boolean NOT NULL DEFAULT true,
  erro              text,
  origem            text NOT NULL DEFAULT 'telegram',
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_bot_auditoria_owner
  ON public.telegram_bot_auditoria (owner_user_id, criado_em DESC);

ALTER TABLE public.telegram_bot_auditoria ENABLE ROW LEVEL SECURITY;

-- O dono da conta pode LER a própria auditoria (para uma futura tela no app);
-- escrita é exclusiva da service role (sem policy de INSERT para authenticated).
DROP POLICY IF EXISTS telegram_bot_auditoria_select_own ON public.telegram_bot_auditoria;
CREATE POLICY telegram_bot_auditoria_select_own ON public.telegram_bot_auditoria
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
