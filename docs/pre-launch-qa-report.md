# HERDON Pre-Launch QA Report

Date: 2026-06-13

## Summary

This sprint focused on the pre-launch audit requested for HERDON, with emphasis on the global shell, sidebar behavior, and launch-readiness validation.

The main code-level issue corrected in this pass was the collapsed sidebar layout, where stacked CSS overrides were causing the collapse toggle to compete visually with the logo area. The collapsed header now keeps the toggle button above the brand mark with stable spacing, and compact navigation items retain a clear active state.

Validation completed successfully:

- `npm run lint`
- `npm run build`
- `npm test -- --run`
- `npm run e2e` is unavailable in this environment because the required E2E credentials are missing

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

NOT READY FOR BETA

## Browser Smoke QA - Sprint 20

### Browser / device widths attempted

- Desktop large
- Notebook
- Tablet width
- Mobile width

### Pages tested

- Browser navigation to the local app could not be completed in this environment because the browser runtime refused the local connection.
- No main page could be fully exercised in the browser smoke pass as a result.

### UI bugs found

- No new browser-verified UI regressions were captured in this environment.

### Functional bugs found

- The browser smoke pass could not reach the running app, so functional flows were not directly exercised here.

### Permission bugs found

- Not verified in-browser in this session.

### Data isolation result

- Not verified in-browser in this session.

### Fixes applied

- No code fix was applied from the browser smoke pass because the app could not be reached from the browser runtime here.

### Remaining risks

- Browser smoke verification remains incomplete until the local app can be opened from the browser runtime.
- Multi-user, farm isolation, permissions, and visual launch readiness should be rechecked in a live browser session.

### Final launch status

NOT READY FOR BETA

### Validation note

- `npm run e2e` is available, but it cannot run in this environment because the required credentials are missing:
  - `E2E_BASE_URL`
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
  - `E2E_USER_A_EMAIL`
  - `E2E_USER_A_PASSWORD`
  - `E2E_USER_B_EMAIL`
  - `E2E_USER_B_PASSWORD`
- Create `.env.e2e` from `.env.e2e.example` and fill real credentials before rerunning E2E.

## Browser Access + Smoke QA - Sprint 21

### Local URL tested

- `http://127.0.0.1:5173`

### Browser access result

- The local app server configuration was standardized for browser access, but the browser runtime in this environment still blocked/failed the connection to the local URL.
- Because of that, the real browser smoke pass could not be completed here.

### Widths tested

- Desktop large
- Notebook
- Tablet
- Mobile

### Pages tested

- No main application page could be fully exercised in-browser in this environment.

### Functional flows tested

- None in-browser, because the browser runtime could not reach the local app.

### E2E credential status

- Missing
- Required variables still need real values before `npm run e2e` can execute:
  - `E2E_BASE_URL`
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
  - `E2E_USER_A_EMAIL`
  - `E2E_USER_A_PASSWORD`
  - `E2E_USER_B_EMAIL`
  - `E2E_USER_B_PASSWORD`

### Permission result

- Not verified in-browser in this environment.

### Farm isolation result

- Not verified in-browser in this environment.

### Bugs found

- The browser smoke pass remains blocked by local browser access in this environment.
- Sprint 20 formatting issues were cleaned up.
- `E2E_BASE_URL` was standardized to match the local dev/browser setup.

### Fixes applied

- Changed the dev and preview commands to bind on `0.0.0.0`.
- Standardized Playwright fallback base URL to `http://127.0.0.1:5173`.
- Updated the Playwright web server command to match the real dev port.
- Added `docs/browser-smoke-checklist.md`.
- Added `server` and `preview` host settings in `vite.config.js`.
- Cleaned the QA report formatting.

### Remaining risks

- Real browser smoke validation is still blocked in this environment.
- Multi-user isolation and permission flows still need real browser confirmation with credentials.
- E2E cannot run until the required credentials are provided.

### Final launch status

NOT READY FOR BETA
