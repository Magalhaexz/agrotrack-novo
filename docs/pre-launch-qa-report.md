# HERDON Pre-Launch QA Report

Date: 2026-06-13

## Summary

This sprint focused on the pre-launch audit requested for HERDON, with emphasis on the global shell, sidebar behavior, and launch-readiness validation.

The main code-level issue corrected in this pass was the collapsed sidebar layout, where stacked CSS overrides were causing the collapse toggle to compete visually with the logo area. The collapsed header now keeps the toggle button above the brand mark with stable spacing, and compact navigation items retain a clear active state.

Validation completed successfully:

- `npm run lint`
- `npm run build`
- `npm test -- --run`

## Critical Bugs Found

1. Collapsed sidebar header collision
   - The collapse toggle could visually collide with the HERDON brand mark in compact mode.
   - Conflicting CSS blocks were fighting each other, which made the compact sidebar layout fragile.

## UI Bugs Found

- Collapsed sidebar spacing was inconsistent between the logo, toggle button, navigation items, and user area.
- The compact sidebar had a higher risk of clipping or crowding active navigation states.
- Multiple overlapping sidebar rules increased the chance of layout regressions on desktop widths.

## Functional Bugs Found

- No new functional blocker was reproduced by the automated test suite in this pass.
- Existing audited flows for calculations, persistence, permissions, and subscription gating remained green after validation.

## Data / Persistence Risks

- Multi-user and per-farm isolation still depends on the active session and farm-selection flows behaving correctly in live usage.
- Optional Supabase/table-fallback behavior remains a live-environment dependency and should continue to be smoke-tested after deployment.
- No fictional seed data was introduced in this sprint.

## Permission Risks

- Permission matrix coverage remains important for:
  - `PROPRIETARIO`
  - `GERENTE`
  - `OPERADOR`
  - `VISUALIZADOR`
- Automated coverage currently indicates the access matrix is intact, but live UI actions should still be checked for disabled states and the exact restricted message:
  - `Acesso restrito ao perfil autorizado.`

## Fixed Items

- Reworked the collapsed sidebar layout so the toggle sits above the brand mark instead of competing with it.
- Tightened compact sidebar spacing to reduce clipping and improve readability.
- Increased compact nav item sizing slightly so active states remain clear.
- Verified the full project with lint, build, and test runs.

## Remaining Risks

- A full browser-based visual sweep of every page was not performed in this session.
- The app still contains many historical CSS layers, so future visual regressions should be watched carefully.
- Live Supabase behavior and cross-user isolation should be rechecked in the real deployment environment.

## Recommended Next Sprint

1. Run a browser smoke pass on the main shell at desktop, notebook, tablet, and mobile widths.
2. Reconfirm farm switching, per-user isolation, and optional-table fallback behavior in production-like data.
3. Perform a page-by-page visual check of the highest-risk modules:
   - Dashboard
   - Fazendas
   - Lotes
   - Animais
   - Pesagens
   - Financeiro
   - Estoque
   - Suplementação / Nutrição
   - Pastagens
   - Indicadores
   - Cenários
   - Relatórios Gerenciais

## Final Launch Status

READY FOR BETA
