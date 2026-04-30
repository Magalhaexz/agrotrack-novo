# Sprint 8F.3 — Reports Mobile Responsiveness + Overflow and Runtime Error Fixes

## Files changed
- `src/styles/relatorios.css`

## Mobile/report issues fixed
- Hardening de `min-width: 0` para evitar estouro horizontal em grids e cards de relatórios.
- Empilhamento mobile consistente para:
  - módulos
  - tipos de relatório
  - workflow/contexto
  - KPIs
  - detalhe
- Correção de overflow/clipping no bloco de filtros:
  - grid em coluna única no mobile
  - rodapé de filtros em coluna
  - botões de ação expansíveis e com wrapping seguro
- Presets de período com rolagem horizontal intencional quando necessário (sem quebra visual).
- Tabelas e wrappers com overflow-x controlado e scrolling touch-friendly.
- Cards/contexto/export com padding e raio ajustados para leitura em telas pequenas.

## Runtime/layout errors fixed
- Foram adicionadas proteções de layout para evitar colapso/overflow que normalmente dispara erros de renderização visual (incluindo casos de área útil insuficiente para conteúdo).
- Estruturas críticas de relatórios e cards agora têm `min-width: 0` e regras de contenção/stack para prevenir cálculos inválidos de dimensão em viewport estreita.
- Não houve alteração de lógica de negócio ou de cálculos de dados de relatórios.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Todos os filtros, cards, insights, tabelas e ações de exportação foram preservados.
- Nenhuma funcionalidade de relatórios foi removida.
