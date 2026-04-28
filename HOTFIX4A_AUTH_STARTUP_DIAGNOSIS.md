# HOTFIX 4A — Authenticated Startup Bottleneck Diagnosis

## Current branch
- `fix/emergency-startup-layout`

## What blocks login-to-app
1. **Dual startup gate in `App.jsx`**
   - App blocks on `isBootLoading = loadingAuth || (session && !dataReady)`.
   - After login, both auth/profile and operational hydration must clear enough to release gate.

2. **AuthContext keeps `loadingAuth` tied to `profileReady`**
   - `loadingAuth` exported as `loadingAuth || !profileReady`.
   - Even with a valid session, app can wait for profile fetch path.
   - Profile path has timeout fallback, but this still adds wait budget before gate opens.

3. **Operational hydration races all operational tables**
   - `loadOperationalSnapshot()` calls `Promise.all` across many tables.
   - Any slow table holds the aggregate until timeout/error.
   - Timeout (~4.5s) is bounded, but still contributes directly to blocked authenticated startup.

## What blocks saved-session startup
Saved-session path skips LoginPage and immediately enters the same gate:
- `loadingAuth || (session && !dataReady)`.
- Profile bootstrap + operational snapshot race happen on startup.
- If network/database is slow, user waits until timeout/fallback path completes.

## Additional non-gate startup cost after first unlock
1. **Alerts generation in App shell**
   - `buildAlerts(db)` + `gerarAlertas*` execute over full DB collections.
2. **Dashboard CPU pressure**
   - `lotesStats` calls `getResumoLote(db, lote.id)` per active lot.
   - `getResumoLote` composes `calcLote` + financial calculations that each scan DB subsets.
   - For many lots/animals/custos, this becomes O(lotes * dataset scans).

These do not fully block the loading gate, but they can delay perceived interactivity immediately after entry.

## DEV timing logs added (diagnosis only)
- `[HERDON_AUTH_TIMING]` in `AuthContext.jsx`
- `[HERDON_DATA_TIMING]` in `useOperationalData.js`
- `[HERDON_DASHBOARD_TIMING]` in `App.jsx` and `DashboardPage.jsx`

All logs are DEV-only (`import.meta.env.DEV`).

## Recommended fix order (next prompt)
1. **Gate release policy first**
   - Decouple first shell render from non-critical profile wait.
   - Keep profile hydration async post-shell when safe.
2. **Operational snapshot strategy**
   - Reduce blocking scope: allow partial table readiness for shell-critical modules.
   - Keep fallback_timeout fast and deterministic.
3. **Post-gate CPU flattening**
   - Memoize/cached resumo calculations by lote+version.
   - Avoid recomputing full-lote summaries multiple times in first dashboard paint.
4. **Alerts cost trimming**
   - Move heavy alert derivation off first paint or schedule after initial render.

## Files that should be changed in the next prompt
- `src/App.jsx`
- `src/auth/AuthContext.jsx`
- `src/hooks/useOperationalData.js`
- `src/pages/DashboardPage.jsx`
- (Optional perf helper extraction) `src/domain/resumoLote.js`

## Build result
- `npm run build` — PASS

## Notes
- `src/services/operationalData.js` is currently missing in this clone; startup data flow is implemented in `src/hooks/useOperationalData.js`.
