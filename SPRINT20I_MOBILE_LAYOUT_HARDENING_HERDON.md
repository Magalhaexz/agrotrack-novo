# SPRINT20I - MOBILE LAYOUT HARDENING (HERDON)

## Files changed
- `src/styles/app.css`
- `SPRINT20I_MOBILE_LAYOUT_HARDENING_HERDON.md`

## Mobile issues fixed
1. **Header/topbar mobile quebrado**
   - Compactação do header mobile com altura mínima controlada e alinhamento central.
   - Ajuste da área de marca para evitar clipping de logo/título.
   - Botões utilitários com tamanho mínimo de toque (44x44).

2. **Dashboard mobile (hero, CTAs e KPIs)**
   - Header/hero do dashboard em layout vertical no mobile.
   - Tipografia do título e subtítulo reduzida para melhor leitura.
   - CTAs em grade segura (2 colunas até 640px, depois 1 coluna).
   - Cards KPI empilhados e com espaçamento/padding mais compactos.

3. **Calendário mobile (sobreposição e legibilidade)**
   - Toolbar do calendário empilhada verticalmente.
   - Células do mês compactadas com altura/padding ajustados.
   - Conteúdo textual interno de eventos dentro da célula ocultado no mobile para eliminar sobreposição.
   - Indicação por ponto de evento preservada e lista lateral com truncamento seguro.

4. **Estoque mobile (empty state, filtros e histórico)**
   - Blocos principais (`rebanho-header`, ações e KPI secundário) empilhados em 1 coluna.
   - Empty states com padding/raio/alinhamento consistentes.
   - Barras de filtro em uma coluna com controles full-width e touch target >= 44px.

5. **Shared mobile (safe area, bottom nav e overflow)**
   - Reforço de padding inferior em `main`/`main-content` e páginas principais para evitar conteúdo sob bottom nav.
   - FAB fixado acima da bottom nav com safe area:
     - `bottom: calc(var(--herdon-mobile-bottomnav-height) + env(safe-area-inset-bottom) + 16px)`
   - Ajustes de largura máxima/overflow no header mobile para evitar scroll horizontal.

## Validation results
- `npm run lint` ✅
- `npm run build` ✅

## Pending issues
- Não há pendências funcionais mapeadas neste escopo (somente CSS/layout).
- Recomenda-se validação visual final em dispositivos reais (iOS Safari e Android Chrome) para conferir nuances de safe-area e tipografia.
