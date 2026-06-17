-- Sprint 10: Add optional financial status fields to movimentacoes_financeiras
-- Safe migration: all columns are optional (nullable), no existing data is altered.
-- Backward compatibility: code treats NULL status as 'realizado' (legacy behavior).

ALTER TABLE movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IS NULL OR status IN ('previsto', 'realizado', 'pago', 'cancelado')),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;

-- Index for common queries filtering by status
CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_status
  ON movimentacoes_financeiras (status)
  WHERE status IS NOT NULL;

-- Index for date-range queries on competencia
CREATE INDEX IF NOT EXISTS idx_movimentacoes_financeiras_data_competencia
  ON movimentacoes_financeiras (data_competencia)
  WHERE data_competencia IS NOT NULL;

-- Note: status is intentionally left as TEXT (not ENUM) for easier migration in case
-- new statuses need to be added later. The CHECK constraint enforces valid values.
-- Note: data_vencimento column may already exist in some rows inserted via FinanceiroPage.jsx
-- (Pagamento Diario flow). This migration adds the column at schema level — existing row
-- values stored in JSONB or app-level will remain valid.
