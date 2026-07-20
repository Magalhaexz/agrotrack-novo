-- Onda A (integridade): estorno de lançamento financeiro (UX-FN1).
-- O estorno NUNCA sobrescreve/apaga o lançamento original — só marca
-- `estornado_em` nele e cria um NOVO lançamento com tipo invertido,
-- vinculado via `origem_tipo = 'estorno'` / `origem_id = <original>`
-- (mesma convenção já usada por movimentacoes.js/consumoSuplementacao).
-- `estornado_em` também é o que bloqueia um segundo estorno do mesmo
-- lançamento (checado em src/pages/FinanceiroPage.jsx antes de estornar).
ALTER TABLE public.movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz;

COMMENT ON COLUMN public.movimentacoes_financeiras.estornado_em IS
  'Data/hora em que este lançamento foi estornado (não nulo = já estornado, bloqueia novo estorno). O lançamento reverso fica em outra linha, com origem_tipo=''estorno'' e origem_id apontando para este id.';
