-- Sprint Telegram interface completa — estado conversacional em várias etapas.
--
-- Guarda uma conversa ativa por chat (slot-filling de cadastros: valor →
-- descrição → lote → ...). Escrita SÓ pela service role (webhook), mesmo padrão
-- de telegram_operacoes_pendentes: RLS ligada, sem policy para authenticated.
-- A conversa apenas COLETA dados; a execução continua passando por
-- telegram_operacoes_pendentes + /confirmar.
CREATE TABLE IF NOT EXISTS public.telegram_conversas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  telegram_chat_id  text NOT NULL,
  fazenda_id        bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  intencao_atual    text NOT NULL,
  etapa_atual       text,
  dados_coletados   jsonb NOT NULL DEFAULT '{}'::jsonb,
  dados_pendentes   jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'ativa'
                    CHECK (status IN ('ativa','concluida','cancelada','expirada')),
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tg_conversas_chat
  ON public.telegram_conversas (telegram_chat_id, status);

ALTER TABLE public.telegram_conversas ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: só a service role lê/escreve.
