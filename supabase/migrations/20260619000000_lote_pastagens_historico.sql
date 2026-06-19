-- Sprint 21 — Movimentação de Lotes entre Pastos
--
-- Cria a tabela de histórico de movimentação de lotes entre pastagens e a
-- função mover_lote_para_pasto, que registra o histórico e atualiza
-- lotes.pastagem_id em uma única operação transacional.
-- Idempotente: seguro para rodar mais de uma vez.

-- 1. Tabela de histórico
CREATE TABLE IF NOT EXISTS public.lote_pastagens_historico (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lote_id              bigint REFERENCES public.lotes (id) ON DELETE SET NULL,
  faz_id               bigint REFERENCES public.fazendas (id) ON DELETE SET NULL,
  pastagem_origem_id   uuid REFERENCES public.pastagens (id) ON DELETE SET NULL,
  pastagem_destino_id  uuid REFERENCES public.pastagens (id) ON DELETE SET NULL,
  data_movimentacao    date NOT NULL,
  quantidade_cabecas   numeric,
  motivo               text,
  observacoes          text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lote_pastagens_historico_quantidade_check
    CHECK (quantidade_cabecas IS NULL OR quantidade_cabecas > 0)
);
-- pastagem_destino_id é obrigatório a nível de aplicação (validado em
-- mover_lote_para_pasto). Mantido nullable na coluna apenas para permitir
-- ON DELETE SET NULL quando um pasto referenciado por um registro antigo é excluído.

CREATE INDEX IF NOT EXISTS idx_lote_pastagens_historico_lote_id
  ON public.lote_pastagens_historico (lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_pastagens_historico_faz_id
  ON public.lote_pastagens_historico (faz_id);
CREATE INDEX IF NOT EXISTS idx_lote_pastagens_historico_owner_user_id
  ON public.lote_pastagens_historico (owner_user_id);

-- 2. updated_at automático (mesmo padrão usado em lotes/pastagens/movimentacoes_animais)
DROP TRIGGER IF EXISTS set_lote_pastagens_historico_updated_at ON public.lote_pastagens_historico;
CREATE TRIGGER set_lote_pastagens_historico_updated_at
  BEFORE UPDATE ON public.lote_pastagens_historico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS — mesmo padrão de lotes/pastagens: dono direto ou mesma conta
ALTER TABLE public.lote_pastagens_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lote_pastagens_historico_select_own ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_select_own ON public.lote_pastagens_historico
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS lote_pastagens_historico_select_same_account ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_select_same_account ON public.lote_pastagens_historico
  FOR SELECT TO authenticated USING (public.app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS lote_pastagens_historico_insert_own ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_insert_own ON public.lote_pastagens_historico
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS lote_pastagens_historico_insert_same_account ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_insert_same_account ON public.lote_pastagens_historico
  FOR INSERT TO authenticated WITH CHECK (public.app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS lote_pastagens_historico_update_own ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_update_own ON public.lote_pastagens_historico
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS lote_pastagens_historico_update_same_account ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_update_same_account ON public.lote_pastagens_historico
  FOR UPDATE TO authenticated
  USING (public.app_is_same_account(owner_user_id))
  WITH CHECK (public.app_is_same_account(owner_user_id));

DROP POLICY IF EXISTS lote_pastagens_historico_delete_own ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_delete_own ON public.lote_pastagens_historico
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS lote_pastagens_historico_delete_same_account ON public.lote_pastagens_historico;
CREATE POLICY lote_pastagens_historico_delete_same_account ON public.lote_pastagens_historico
  FOR DELETE TO authenticated USING (public.app_is_same_account(owner_user_id));

-- 4. Função transacional de movimentação
--
-- SECURITY INVOKER: respeita as policies de RLS já existentes em lotes,
-- pastagens e lote_pastagens_historico em vez de duplicar a lógica de
-- isolamento de conta dentro da função. Se o lote ou o pasto de destino não
-- forem encontrados pelo SELECT, é porque não existem ou não pertencem à
-- conta do usuário (RLS já filtrou) — tratado como erro de validação.
CREATE OR REPLACE FUNCTION public.mover_lote_para_pasto(
  p_lote_id              bigint,
  p_pastagem_destino_id  uuid,
  p_data_movimentacao    date,
  p_quantidade_cabecas   numeric DEFAULT NULL,
  p_motivo               text DEFAULT NULL,
  p_observacoes          text DEFAULT NULL
)
RETURNS public.lote_pastagens_historico
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_lote          public.lotes;
  v_destino       public.pastagens;
  v_origem_id     uuid;
  v_owner_user_id uuid;
  v_historico     public.lote_pastagens_historico;
BEGIN
  IF p_pastagem_destino_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o pasto de destino.' USING ERRCODE = '22004';
  END IF;

  IF p_data_movimentacao IS NULL THEN
    RAISE EXCEPTION 'Informe a data da movimentação.' USING ERRCODE = '22004';
  END IF;

  IF p_quantidade_cabecas IS NOT NULL AND p_quantidade_cabecas <= 0 THEN
    RAISE EXCEPTION 'A quantidade de cabeças deve ser maior que zero.' USING ERRCODE = '22003';
  END IF;

  SELECT * INTO v_lote FROM public.lotes WHERE id = p_lote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado ou não pertence à sua conta.' USING ERRCODE = '42501';
  END IF;

  IF v_lote.faz_id IS NULL THEN
    RAISE EXCEPTION 'O lote não está vinculado a uma fazenda.' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_destino FROM public.pastagens WHERE id = p_pastagem_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pasto de destino não encontrado ou não pertence à sua conta.' USING ERRCODE = '42501';
  END IF;

  IF v_destino.faz_id IS DISTINCT FROM v_lote.faz_id THEN
    RAISE EXCEPTION 'O pasto de destino pertence a outra fazenda.' USING ERRCODE = '22023';
  END IF;

  v_origem_id := v_lote.pastagem_id;

  IF v_origem_id IS NOT NULL THEN
    PERFORM 1 FROM public.pastagens
      WHERE id = v_origem_id AND faz_id IS NOT DISTINCT FROM v_lote.faz_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O pasto atual do lote é inconsistente com a fazenda do lote.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_origem_id IS NOT NULL
     AND v_origem_id = p_pastagem_destino_id
     AND coalesce(trim(p_motivo), '') = ''
  THEN
    RAISE EXCEPTION 'O destino é igual ao pasto atual. Informe um motivo para confirmar a movimentação.' USING ERRCODE = '22023';
  END IF;

  v_owner_user_id := coalesce(public.app_current_owner_user_id(), auth.uid());

  INSERT INTO public.lote_pastagens_historico (
    owner_user_id, lote_id, faz_id, pastagem_origem_id, pastagem_destino_id,
    data_movimentacao, quantidade_cabecas, motivo, observacoes
  ) VALUES (
    v_owner_user_id, v_lote.id, v_lote.faz_id, v_origem_id, p_pastagem_destino_id,
    p_data_movimentacao, p_quantidade_cabecas, p_motivo, p_observacoes
  )
  RETURNING * INTO v_historico;

  UPDATE public.lotes
     SET pastagem_id = p_pastagem_destino_id
   WHERE id = v_lote.id;

  RETURN v_historico;
END;
$$;

REVOKE ALL ON FUNCTION public.mover_lote_para_pasto(bigint, uuid, date, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_lote_para_pasto(bigint, uuid, date, numeric, text, text) TO authenticated;
