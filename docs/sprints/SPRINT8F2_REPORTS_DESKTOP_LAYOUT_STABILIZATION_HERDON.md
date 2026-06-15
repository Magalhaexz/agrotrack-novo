# Sprint 8F.2 — Reports Desktop Layout Stabilization

## Files changed
- `src/styles/relatorios.css`

## Desktop layout issues fixed
- Ajuste da hierarquia e ritmo vertical geral da página de Relatórios no desktop.
- Melhor estabilidade do bloco de filtros mestre com:
  - espaçamento interno mais consistente
  - grid de filtros mais previsível (4 colunas)
  - melhor alinhamento no rodapé de filtros
- Melhor composição entre filtros e resultados com redução de gaps excessivos.
- Melhor alinhamento visual de cards de resumo e cards de catálogo.
- Melhor densidade visual de cards/contexto para evitar aparência quebrada/espalhada.
- Melhor consistência visual das áreas de tabela (raio e shell) com o padrão premium dark.
- Nenhum bloco de dado, tabela, resumo, ação ou exportação foi removido.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Todos os filtros, cartões de resumo/insight, tabelas e ações de exportação existentes foram preservados.
- Nenhuma funcionalidade de relatórios foi removida.
