# Sprint 8G — Visual Stabilization (Animais e Pesagens)

## Files changed
- `src/styles/app.css`

## Exact selectors/components refined
### Animais
- `.animais-page`
- `.animais-workspace-shell`
- `.animais-page .ui-card`
- `.animais-page .ui-card-body`
- `.animais-list-card .ui-card-header`
- `.animais-mode-card .ui-card-header`
- `.animais-mode-card .ui-card-subtitle`
- `.animais-table-wrap .data-table th`
- `.animais-table-wrap .data-table td`
- `.animais-table-wrap .row-actions`
- `.animais-history-card .data-table th, td`
- `.animais-history-card .table-responsive`

### Pesagens
- `.page--pesagens`
- `.page--pesagens .animais-hero`
- `.page--pesagens .kpi-card.kpi-card--compact`
- `.page--pesagens .kpi-sub`
- `.page--pesagens .data-table th, td`
- `.page--pesagens .data-table th`
- `.page--pesagens .cell-chip .badge`
- `.page--pesagens .fazendas-table-wrap`

### Responsivo / mobile
- `@media (max-width: 1100px)` para largura mínima das tabelas em shells responsivos
- `@media (max-width: 720px)` para empilhamento de KPI/cards, botões full-width e segmented control full-width

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Nenhuma funcionalidade removida.
- Fluxo grupo/lote mantido.
- Fluxo individual de animal mantido.
- Pesagem por lote mantida.
- Pesagem individual mantida.
- Alterações focadas apenas em layout, espaçamento, hierarquia, legibilidade e responsividade.
