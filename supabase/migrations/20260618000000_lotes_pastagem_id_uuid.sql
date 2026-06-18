-- Sprint 18.1 — Integridade do vínculo Lote → Pasto
--
-- Converte lotes.pastagem_id de text para uuid e cria FK para pastagens(id).
-- Safe: verifica o tipo atual antes de converter e verifica a FK antes de criar.
-- ON DELETE SET NULL: se um pasto for removido, o lote fica sem pasto vinculado,
--   sem orphan reference e sem erro de integridade.

-- 1. Converter pastagem_id para uuid, somente se ainda for text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'lotes'
      AND column_name  = 'pastagem_id'
      AND data_type    = 'text'
  ) THEN
    ALTER TABLE public.lotes
      ALTER COLUMN pastagem_id TYPE uuid USING pastagem_id::uuid;
  END IF;
END $$;

-- 2. Criar FK para pastagens(id), somente se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.lotes'::regclass
      AND conname   = 'lotes_pastagem_id_fkey'
  ) THEN
    ALTER TABLE public.lotes
      ADD CONSTRAINT lotes_pastagem_id_fkey
      FOREIGN KEY (pastagem_id)
      REFERENCES public.pastagens (id)
      ON DELETE SET NULL;
  END IF;
END $$;
