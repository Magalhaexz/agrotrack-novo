# Sprint 8F.3 — Reports Filter Mobile Overflow Fix

## Files changed
- `src/styles/relatorios.css`

## Responsive selectors fixed
- `@media (max-width: 760px) .reports-filter-card`
- `@media (max-width: 760px) .reports-filter-meta`
- `@media (max-width: 760px) .reports-filter-grid`
- `@media (max-width: 760px) .reports-filter-grid > label`
- `@media (max-width: 760px) .reports-filter-grid .ui-input/select/input`
- `@media (max-width: 760px) .reports-filter-grid .full`
- `@media (max-width: 760px) .reports-filter-foot`
- `@media (max-width: 760px) .reports-filter-foot .ui-button`
- `@media (max-width: 760px) .reports-filter-summary-grid`
- `@media (max-width: 760px) .reports-filter-summary-card`
- `@media (max-width: 760px) .reports-filter-summary-card small/strong/span`
- `@media (max-width: 480px) .reports-page-actions .ui-button`
- `@media (max-width: 480px) .reports-preset-row .reports-preset-button`
- `@media (max-width: 480px) .reports-filter-label`

## What was fixed
- Filtro mestre convertido para empilhamento seguro em coluna única no mobile.
- Campos (Data inicial/final, Fazenda, Lote, Status) com largura total sem clipping.
- Rodapé de filtros e botões com largura total e espaçamento estável.
- Cards de resumo/escopo atual em stack vertical no mobile para evitar sobreposição.
- Proteções de quebra de texto para impedir overflow horizontal em cards de resumo.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Nenhuma funcionalidade de relatórios removida.
- Filtros e UI de exportação preservados.
