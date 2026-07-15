-- Sprint Assistente Inteligente HERDON no Telegram — contexto conversacional
-- do Assistente IA (seção 5 do spec: manter contexto entre mensagens).
--
-- Distinto de `telegram_conversas` (slot-filling determinístico de UM
-- cadastro por vez, com `intencao_atual`/`etapa_atual`). Aqui guardamos um
-- histórico curto de mensagens (usuário + assistente) por chat, para a IA
-- responder perguntas de acompanhamento ("e quanto tempo isso dura?") sem
-- reconstruir o assunto do zero. Não substitui `telegram_operacoes_pendentes`
-- — nenhuma escrita é decidida aqui, só o texto da conversa.
--
-- Mesmo padrão de RLS das demais tabelas do bot: ligada, sem policy para
-- authenticated — só a service role (webhook) lê/escreve.
CREATE TABLE IF NOT EXISTS public.telegram_ia_contexto (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  telegram_chat_id  text NOT NULL UNIQUE,
  fazenda_id        bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  mensagens         jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  expira_em         timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tg_ia_contexto_chat
  ON public.telegram_ia_contexto (telegram_chat_id);

ALTER TABLE public.telegram_ia_contexto ENABLE ROW LEVEL SECURITY;
-- Sem policy para authenticated: só a service role lê/escreve.
