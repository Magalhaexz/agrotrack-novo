-- Sprint 16 — Central de Alertas Única: tratativa operacional
--
-- Auditoria prévia (docs/DECISAO_ALERTAS_CENTRAL_UNICA.md): as tabelas
-- existentes `alertas_resolvidos`/`alertas_adiados` só modelam "existe linha
-- = resolvido/adiado" (sem status), keyed por `chave`/`ack_key` heurístico
-- (utils/alerts.js) — servem exclusivamente o painel legado de notificações
-- do header (App.jsx). Não foram alteradas nem reaproveitadas aqui de
-- propósito, para não arriscar quebrar esse fluxo já em produção.
--
-- `alertas_tratativas` é a persistência da Central de Alertas
-- (src/pages/AlertasPage.jsx, src/domain/tratativasAlertas.js), com um
-- modelo de 4 status (em_analise/resolvido/adiado/ignorado), keyed por
-- `alerta_id` — o `id` estável que `gerarAlertasUnificados` já atribui a
-- cada alerta (Sprint 12).
--
-- RLS segue o padrão mais recente do projeto (só `same_account`, sem o par
-- duplicado `_owner`+`_same_account` já apontado como dívida de performance
-- na auditoria da Sprint 13 — não replicado aqui de propósito).

CREATE TABLE IF NOT EXISTS public.alertas_tratativas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id  uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fazenda_id     bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  alerta_id      text NOT NULL,
  alerta_tipo    text,
  origem         text,
  status         text NOT NULL CHECK (status IN ('em_analise', 'resolvido', 'adiado', 'ignorado')),
  observacao     text,
  adiado_ate     date,
  resolvido_em   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alertas_tratativas_owner_alerta_key UNIQUE (owner_user_id, alerta_id)
);

CREATE INDEX IF NOT EXISTS idx_alertas_tratativas_owner_user_id
  ON public.alertas_tratativas (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tratativas_alerta_id
  ON public.alertas_tratativas (alerta_id);
CREATE INDEX IF NOT EXISTS idx_alertas_tratativas_status
  ON public.alertas_tratativas (status);

DROP TRIGGER IF EXISTS set_alertas_tratativas_updated_at ON public.alertas_tratativas;
CREATE TRIGGER set_alertas_tratativas_updated_at
  BEFORE UPDATE ON public.alertas_tratativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.alertas_tratativas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alertas_tratativas_select_same_account ON public.alertas_tratativas;
CREATE POLICY alertas_tratativas_select_same_account ON public.alertas_tratativas
  FOR SELECT TO authenticated USING (app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS alertas_tratativas_insert_same_account ON public.alertas_tratativas;
CREATE POLICY alertas_tratativas_insert_same_account ON public.alertas_tratativas
  FOR INSERT TO authenticated WITH CHECK (app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS alertas_tratativas_update_same_account ON public.alertas_tratativas;
CREATE POLICY alertas_tratativas_update_same_account ON public.alertas_tratativas
  FOR UPDATE TO authenticated
  USING (app_is_same_account(owner_user_id))
  WITH CHECK (app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS alertas_tratativas_delete_same_account ON public.alertas_tratativas;
CREATE POLICY alertas_tratativas_delete_same_account ON public.alertas_tratativas
  FOR DELETE TO authenticated USING (app_is_same_account(owner_user_id));

COMMENT ON TABLE public.alertas_tratativas IS
  'Tratativa operacional de alertas da Central Única (Sprint 16) — status em_analise/resolvido/adiado/ignorado por alerta_id (id estável de gerarAlertasUnificados). Não confundir com alertas_resolvidos/alertas_adiados (painel legado do header de notificações, App.jsx).';
