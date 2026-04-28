# Emergency Sprint — Startup Speed and Layout Fix

## Summary
- Starting branch: `work`.
- Final branch: `fix/emergency-startup-layout`.
- Sprint 5 had to be re-applied manually because commit `26e8102` / branch `fix/sprint-5-ui-layout-stabilization` were not available in this clone.
- Fixed:
  - startup recovery behavior (faster operational timeout + fallback + visible recovery UI)
  - startup diagnostics (`[HERDON_BOOT]` in DEV)
  - shell/layout stabilization reinforcement for sidebar/header/main alignment and overflow safety.
- Intentionally not changed:
  - business calculations and domain formulas
  - product features
  - broad CSS redesign/refactor of all duplicated legacy blocks.

## Startup fixes
- **Auth timeout behavior**
  - Added timeout protection to auth session bootstrap path (`supabase.auth.getSession`) to avoid long blocking waits.
  - `loadingAuth` remains guarded by existing `finally` release flow.
- **Operational data fallback behavior**
  - Reduced operational timeout race to ~4.5s.
  - On timeout: app immediately switches to fallback DB and marks `dataReady=true`.
  - Late successful Supabase snapshot is applied safely (`supabase_late`) without blocking the first render.
- **Visible recovery loading behavior**
  - After 6 seconds of loading gate, recovery panel appears with Portuguese UI:
    - "O carregamento está demorando mais que o normal."
    - "Você pode tentar novamente ou limpar a sessão local para voltar ao login."
    - Buttons: "Tentar novamente" and "Limpar sessão e voltar ao login"
  - "Tentar novamente" reloads.
  - "Limpar sessão e voltar ao login" clears local/session storage, signs out if possible, and reloads.
- **Expected max wait before recovery UI**
  - 6 seconds.

## Layout fixes
- **Root cause**
  - Conflicting historical shell CSS layers were still present and could cause clipping/offset regressions depending on cascade order.
- **Sidebar fix**
  - Reinforced desktop sidebar contract (`260px`, fixed column, vertical scroll, horizontal clipping off).
  - Added `min-width: 0` protections for logo/copy/user containers and safe logo sizing.
- **Header fix**
  - Reinforced fixed header alignment after sidebar with safe width compression in farm selector/tabs/actions.
  - Added flex sizing controls to reduce right-side overflow pressure.
- **Dashboard fix**
  - Existing min-width safety for dashboard grid items preserved.
- **Overflow fix**
  - Main/root overflow-x protections preserved and reinforced where needed.

## Files changed
1. `src/App.jsx`
   - **Reason:** add emergency boot diagnostics, 6s recovery UI, and recovery actions.
   - **Risk level:** Medium.
2. `src/hooks/useOperationalData.js`
   - **Reason:** reduce timeout window, unblock with fallback sooner, and apply late snapshot safely.
   - **Risk level:** Medium.
3. `src/auth/AuthContext.jsx`
   - **Reason:** timeout protection for session bootstrap race.
   - **Risk level:** Low/Medium.
4. `src/styles/app.css`
   - **Reason:** reinforce desktop shell contract and clipping/overflow protections.
   - **Risk level:** Medium.

## Validation results
- `npm run build`: **PASS**.
- `npm run lint`: **FAIL** (pre-existing repo-wide lint debt; still present).
- Layout rule search:
  - `rg -n "100vw|width: 100vw|overflow-x|left: var\(--sidebar-width\)|main-content|app-container|sidebar|header" src/styles src/components src/pages`
  - Results show expected shell selectors plus existing legacy definitions; emergency overrides remain present.
- Loading recovery search:
  - `rg -n "Carregando sua operação|HERDON_BOOT|fallback_timeout|O carregamento está demorando" src`
  - Required strings and debug marker found.
- Merge conflict marker search:
  - `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .`
  - No matches.

## Manual QA checklist for user
1. Hard refresh
2. Browser zoom 100%
3. Login
4. Dashboard
5. Sidebar navigation
6. Lotes
7. Financeiro
8. Relatórios
9. Estoque
10. Configurações

## Remaining risks
### Critical
- None identified from build/static checks.

### High
- Full visual QA in real browser sessions is still required because style duplication history is extensive.

### Medium
- Repository lint debt remains high and may hide non-critical quality issues.

### Low
- Further shell CSS consolidation is recommended in a dedicated cleanup sprint.

## Launch recommendation
Ready for **internal testing** after this emergency fix.

Reason: startup unblocking path is now faster and recoverable, build passes, and layout shell safeguards are reinforced. Interactive QA is still required before beta/public exposure.
