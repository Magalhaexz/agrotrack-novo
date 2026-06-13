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

## Sidebar Icon Visibility + Centered Cadastro Layout — Sprint 29

### Build / lint / test result

- `npm run lint` passed
- `npm run build` passed
- `npm test -- --run` passed

### Widths tested

- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

### Sidebar result

- Collapsed sidebar icons were fully visible at all tested widths.
- The compact rail kept a clean active state and no longer read as a clipped icon column.
- Scroll overflow stayed controlled, and the user card/avatar remained aligned at the bottom of the sidebar.
- The `Cadastros` section remained intact in expanded mode.

### Fixes applied

- Added stable scrollbar gutter spacing to the sidebar content and navigation container.
- Centered collapsed sidebar items so icon buttons no longer drift into the scrollbar area.
- Disabled the compact hover translation that was nudging icons into a visually cramped position.
- Offset modal overlay sizing by sidebar width so the Fazenda cadastro modal centers inside the content area.

### Dashboard result

- Dashboard shell metrics stayed stable with zero horizontal overflow in the tested widths.
- Topbar alignment remained clean against both expanded and collapsed sidebar states.

### Fazendas result

- The Fazenda cadastro modal recenters inside the content area instead of drifting too far to the right.
- The modal remained visually lighter and narrower than the full content width.
- The form and action row stayed aligned in both expanded and collapsed sidebar states.

### Dense modules result

- The densest shell surfaces inherited the same spacing rhythm and container rules from the layout standardization pass.
- No clipping or card overlap was observed in the dashboard and Fazendas checks used for this sprint.

### Remaining risks

- Live backend data states still need a real authenticated smoke pass before launch.
- The QA run used the local developer environment, so production-like records may still expose subtle spacing differences.
- The broader historical CSS surface remains a regression risk and should keep receiving notebook-width browser checks.

### Final beta impact

- This sprint materially improved sidebar legibility and form centering on notebook-sized screens.
- The product is still **NOT READY FOR BETA** because the authenticated smoke test, checkout, and user/farm isolation checks are still pending.

## Collapsed Sidebar + Tablet Login/Scroll Fix — Sprint 30

### Build / lint / test result

- `npm run lint` passed
- `npm run build` passed
- `npm test -- --run` passed

### Widths tested

- 768x1024
- 1024x768
- 820x1180
- 1180x820
- 834x1194
- 1194x834
- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

### Sidebar result

- Collapsed sidebar icons stayed fully visible and centered.
- The scrollbar no longer crossed the icon rail.
- Section labels, badges, and carets were hidden in collapsed mode so the rail read as intentional.
- The avatar/user circle remained aligned at the bottom.

### Login result

- Tablet portrait and tablet landscape login were both visible.
- The login form now scrolls inside the page when the viewport height is short.
- The brand side is hidden on narrower tablet widths so the form no longer sits below the fold.

### Scroll result

- The authenticated shell now keeps `main` as the active scroll container on tablet.
- `Lotes` scrolls naturally past the first visible items instead of freezing at the top.
- The main content area regains the full width on tablet because the stale desktop offset was removed.

### Bugs found

- Login was effectively clipped on tablet landscape because the page was taller than the viewport while the body remained scroll-locked.
- Tablet shell content was offset by the desktop sidebar margin, preventing full-width usage and contributing to the frozen feel.
- The collapsed sidebar still exposed a scrollbar gutter and did not yet read as a premium icon rail.

### Fixes applied

- Turned the login screen into a real scroll container with `100dvh`, touch-friendly overflow, and narrower-tablet brand suppression.
- Kept the tablet app shell in flex layout, zeroed the desktop left margin, and allowed `main` to scroll with touch-friendly settings.
- Rebuilt the collapsed sidebar into a fixed 48px icon rail and hid the scrollbar visually while preserving scroll.

### Remaining risks

- Live production data can still expose edge-case spacing issues that do not show up in the empty QA environment.
- Modal-heavy tablet interactions should keep getting rechecked before beta because they depend on the same shell/scroll rules.

### Final beta impact

- This sprint materially improved tablet usability and the collapsed sidebar experience.
- The product is still **NOT READY FOR BETA** because the authenticated smoke test, checkout, and user/farm isolation checks are still pending.

## Responsive Visual QA + Dense Module Polish — Sprint 27B

This pass completed the browser-based responsive sweep after the shell standardization work and verified that the main dense surfaces stay balanced across notebook and desktop widths.

### Validation result

- `npm run lint` passed
- `npm run build` passed
- `npm test -- --run` passed

### Widths tested

- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

### Pages tested

- Dashboard
- Fazendas modal
- Financeiro
- Minha Assinatura

### Sidebar result

- `Cadastros` rendered correctly in expanded mode.
- The collapsed sidebar kept a visible, intentional icon column instead of reading as an empty rail.
- The active state remained clean in both expanded and collapsed states.
- No sidebar clipping or icon cropping was observed in the tested widths.

### Dashboard result

- The dashboard kept its layout balance across notebook and desktop widths.
- No horizontal overflow was observed.
- The topbar stayed aligned with the main content container.

### Fazendas result

- The Fazendas modal kept clear section spacing and a lighter footer treatment.
- The action bar remained aligned and did not visually overpower the form.
- No hidden fields or footer overlap were observed in the tested viewport sizes.

### Dense modules result

- `Minha Assinatura` retained a balanced two-column desktop rhythm.
- Financeiro and the shared shell containers stayed stable at the tested widths.
- No full-width form stretching or overlapping cards were observed in the inspected states.

### Remaining risks

- The browser QA used the documented offline-disabled data path so the authenticated shell could render without live Supabase hydration.
- Live backend data states still need a real authenticated smoke pass before launch.
- Permission and per-farm isolation still remain launch blockers until they are rechecked in a live environment.

### Final beta impact

- The responsive shell and dense module polish materially improve the notebook and desktop experience.
- The product is still **NOT READY FOR BETA** because the authenticated smoke test, checkout, and user/farm isolation checks are still pending.

## Sprint 25 - Asaas Subscription 500 Fix

### Issue observed

- The subscription creation route could surface a raw HTTP 500 when the Asaas provider or runtime setup failed.
- The local checkout flow could also continue opening the payment URL before fully honoring a failed backend response.

### Fixes applied

- Accepted `ASAAS_BASE_URL` as an alias for `ASAAS_API_BASE_URL` on the server side.
- Added structured server-side logging for subscription failures without exposing secrets.
- Added payload validation for subscription requests so missing or invalid plan data now returns a controlled 400 response.
- Wrapped the subscription handler in a top-level failure path so provider/runtime problems now return a structured error instead of a blind 500.
- Updated the frontend to show friendly Portuguese messages and only open the payment URL after a successful backend response.
- Added automated coverage for the env alias, provider rejection, and invalid payload cases.

### Validation result

- `npm run lint` passed
- `npm run build` passed
- `npm test -- --run` passed
- `npm run e2e` could not complete because the required local credentials are still missing:
  - `E2E_USER_A_EMAIL`
  - `E2E_USER_A_PASSWORD`
  - `E2E_USER_B_EMAIL`
  - `E2E_USER_B_PASSWORD`

### Final launch status

NOT READY FOR BETA

## Final Checkout + Asaas Validation — Sprint 28

### Local URL tested

- `http://127.0.0.1:4174/minha-assinatura`

### User used for checkout test

- `qa.sprint28.herdon@example.com`
- Created through the local HERDON signup flow in this workspace

### API status result

- The checkout click reached the local checkout path, but the server-side Asaas route is still blocked in this workspace by missing Asaas server env values.
- Result observed in the local runtime: `ASAAS_ENV_MISSING` before any provider checkout could be created.

### Duplicate request result

- The checkout flow now has a single-flight guard in the page layer, so one user action is meant to produce one submission path only.
- A full live provider-side request-count audit still needs a keyed Asaas environment to measure the final network call count end to end.

### Checkout URL result

- No Asaas checkout URL opened in this workspace because the local server stops at the missing-env gate before a provider link can be created.

### Asaas dashboard result

- Not verifiable in this environment because no Asaas server key is loaded for the local dev server.

### Supabase persistence result

- The new QA user was created successfully in the local app shell and the authenticated customer area loaded.
- Checkout initiation itself could not be persisted past the provider gate without a live Asaas configuration.

### Errors found

- Missing Asaas server env in the local runtime.
- No live provider checkout could be created or confirmed from this workspace.

### Fixes applied

- Added a safe default and validation for the Asaas due-date/business-days field before provider calls.
- Added a single-flight checkout lock in `MinhaAssinaturaPage` to reduce duplicate submissions from rapid clicks.
- Added test coverage for the new due-date validation and the payment-link payload.

### Remaining risks

- Live Asaas success-path confirmation is still missing.
- Provider dashboard persistence and real checkout opening still need a keyed sandbox/prod test.
- Final duplicate-request confirmation still needs an environment where the Asaas route can complete successfully.

### Final beta impact

- NOT READY FOR BETA
- Checkout validation improved, but the end-to-end live provider proof is still incomplete.

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

## Real Local QA + E2E Setup - Sprint 22

### Local URL tested

- `http://127.0.0.1:5173`

### Environment setup

- Created a local `.env.e2e` for this machine only.
- Added `.env.e2e` to `.gitignore` so it will not be committed.
- Configured the admin credentials that were provided.
- User A and User B credentials are still pending, so full multi-user E2E coverage remains incomplete.

### Browser access result

- The local app opened successfully in the in-app browser at `http://127.0.0.1:5173`.
- The login screen rendered cleanly at desktop, notebook, tablet, and mobile widths.

### Widths tested

- Desktop large
- Notebook
- Tablet
- Mobile

### Pages tested

- Main shell
- Login
- Core navigation
- QA report pages

### Functional flows tested

- Dev server startup and local app reachability
- Static validation and test suite execution
- E2E harness setup with local credentials file
- Login form submission with the provided admin credentials

### E2E credential status

- Partial
- Admin credentials are set locally
- User A and User B credentials are still missing

### Permission result

- Not fully verified with live E2E credentials

### Farm isolation result

- Not fully verified with live E2E credentials

### Bugs found

- The E2E runner still cannot complete the full matrix without the remaining test-user credentials.
- The provided admin login attempt returned `Invalid login credentials`.
- One browser console error was captured during that login attempt, matching the failed auth response.

### Fixes applied

- Added `.env.e2e` to the local ignore list.
- Created a local E2E env file for the provided admin account.
- Documented the remaining credential gap in the QA report.
- Verified the login screen at desktop, notebook, tablet, and mobile widths.

### Remaining risks

- Full E2E validation still depends on the missing user A/B credentials.
- Permission and farm-isolation coverage still need a real authenticated multi-user pass.
- The app still needs a successful login against a valid test account before the post-login flows can be verified end to end.

### Final launch status

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
