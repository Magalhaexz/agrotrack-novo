# Hotfix — Infinite Loading Screen

## Summary
- **Branch used:** `fix/infinite-loading-screen`.
- **Root cause:** the app loading gate depended only on `loadingAuth` and had no operational-data readiness contract; additionally, auth/profile async flows could remain pending too long without a defensive fallback.
- **Fixed state:** loading gate now depends on both `loadingAuth` and operational `dataReady` for signed-in sessions.
- **Timeout fallback added:** yes, 8-second operational timeout now forces safe fallback (`fallback_timeout`) instead of infinite loading.

## Files changed
- **`src/hooks/useOperationalData.js`**
  - reason: added dedicated operational hydration lifecycle with resilient fallback paths (`supabase`, `fallback`, `fallback_error`, `fallback_timeout`, `signed_out`), try/catch/finally protection, and guaranteed `dataReady` completion.
  - risk level: **Medium** (new data hydration layer used by app bootstrap).

- **`src/App.jsx`**
  - reason: integrated `useOperationalData`, updated loading condition to `loadingAuth || (session && !dataReady)`, and added DEV-only loading diagnostics (`[HERDON_LOADING_STATE]`).
  - risk level: **Medium** (app bootstrap path).

- **`src/auth/AuthContext.jsx`**
  - reason: hardened auth/profile async flow so `loadingAuth` is always released via `finally`, including auth-state listener and session bootstrap; added profile-load timeout protection.
  - risk level: **Low/Medium**.

## Validation results
- **`npm run build`**
  - ✅ Passed.

- **`npm run lint`**
  - ⚠️ Fails due to pre-existing strict/quality rules.
  - ✅ Hotfix introduced no new parsing blockers in modified files.

- **Search results**
  - `rg -n "Carregando sua operação|dataReady|loadingAuth|fallback_timeout" src`
  - ✅ Confirmed loading text, loading states, and timeout fallback path are present in source.

- **Manual test notes**
  - 1) **Signed out user**
    - Code-path expectation validated: `useOperationalData` sets `signed_out` + `dataReady=true`; app route falls to login when session is absent.
  - 2) **Signed in user with Supabase working**
    - Code-path expectation validated: snapshot hydration sets `dataSource="supabase"` and `dataReady=true`.
  - 3) **Signed in user with blocked/missing operational tables**
    - Code-path expectation validated: known module errors map to `dataSource="fallback"` and unblock UI.
  - 4) **Slow Supabase response**
    - Code-path expectation validated: after 8s timeout, fallback database is used with `dataSource="fallback_timeout"` and `dataReady=true`.

## Remaining risks
- **Critical**
  - None identified in hotfix scope.

- **High**
  - Operational snapshot currently loads multiple tables directly; backend schema drift can increase fallback frequency.

- **Medium**
  - Lint debt remains project-wide and can hide future regressions if not addressed in dedicated cleanup sprint.

- **Low**
  - DEV diagnostics are render-level and intentionally verbose during development.

## Next recommended sprint
Sprint 3 — Executive Lot Summary UI
