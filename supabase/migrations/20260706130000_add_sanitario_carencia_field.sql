-- Sprint 10 — Agenda Sanitária com vencimentos
--
-- Auditoria prévia (docs/SPRINT10_AGENDA_SANITARIA_RESULTADO.md): a tabela
-- `sanitario` já tem tipo, produto/descrição (`desc`), data de aplicação
-- (`data_aplic`), próxima aplicação (`proxima`), lote e observação (`obs`).
-- O único campo essencial que faltava é a data de fim de carência
-- (período de segurança antes de vender/abater após um medicamento) — não
-- existe hoje nem como coluna, nem em `metadata`.
--
-- Migration mínima: uma coluna nullable, sem default, sem backfill (não há
-- como inferir carência de registros antigos). RLS não muda — as policies
-- existentes (`sanitario_*_owner`/`sanitario_*_same_account`) operam por
-- linha via `owner_user_id`, cobrem qualquer coluna automaticamente.

ALTER TABLE public.sanitario
  ADD COLUMN IF NOT EXISTS data_fim_carencia date;

COMMENT ON COLUMN public.sanitario.data_fim_carencia IS
  'Data de fim do período de carência do manejo (ex.: medicamento) — opcional. Usado pelo Motor Único de Alertas (agruparCarenciaAtiva, src/domain/alertasUnificados.js) e pela Agenda Sanitária (src/domain/agendaSanitaria.js).';
