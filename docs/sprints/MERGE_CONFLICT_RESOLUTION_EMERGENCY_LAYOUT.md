# Merge Conflict Resolution — Emergency Startup/Layout

## Summary
- Branch: `fix/emergency-startup-layout`
- Conflicting files addressed:
  - `src/App.jsx`
  - `src/hooks/useOperationalData.js`
  - `src/styles/app.css`
- Strategy used:
  - keep emergency startup recovery behavior as source of truth,
  - keep emergency timeout/fallback logic as source of truth,
  - keep stabilized desktop shell overrides as source of truth,
  - remove/verify absence of conflict markers and revalidate build.

## Files resolved
### 1) `src/App.jsx`
- What conflicted:
  - bootstrap logging naming/shape and loading gate rendering paths.
- What was preserved:
  - DEV-only `[HERDON_BOOT]` debug payload (`loadingAuth`, `hasSession`, `dataReady`, `dataSource`, `dataErrorMessage`).
  - 6s recovery panel while loading gate is active.
  - Portuguese recovery text and actions:
    - "O carregamento está demorando mais que o normal."
    - "Tentar novamente"
    - "Limpar sessão e voltar ao login"
- What was changed:
  - ensured recovery panel behavior remains attached to loading gate and triggers after timer.

### 2) `src/hooks/useOperationalData.js`
- What conflicted:
  - timeout strategy and fallback sequencing during operational hydration.
- What was preserved:
  - guaranteed `dataReady` release in signed-out, success, timeout, and error flows.
  - fallback via `createOperationalFallbackDb(...)`.
  - timeout around 4.5s with `fallback_timeout` source.
  - `hydratingRef` release in `finally`.
- What was changed:
  - safe late-hydration behavior retained (`supabase_late`) so the UI unblocks quickly and upgrades data when/if snapshot arrives later.

### 3) `src/styles/app.css`
- What conflicted:
  - shell layering between historical `.sidebar/.header/.main` blocks and late overrides.
- What was preserved:
  - desktop contract: 260px sidebar, header aligned after sidebar, main offset and protected from overflow.
  - sidebar clipping protections (`min-width: 0`, safe logo sizing, horizontal overflow hidden).
  - responsive safety below 900px (drawer behavior and no desktop offset lock).
- What was changed:
  - ensured emergency override block remains authoritative for shell alignment and overflow control.

## Validation results
- `npm run build`: **PASS**
- `npm run lint`: **FAIL** (pre-existing repo-wide lint debt)
- Conflict marker search:
  - `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .`
  - result: no markers
- Loading recovery search:
  - `rg -n "Carregando sua operação|HERDON_BOOT|O carregamento está demorando|fallback_timeout" src`
  - result: required markers/text found
- Layout rule search:
  - `rg -n "100vw|width: 100vw|overflow-x|left: var\(--sidebar-width\)|main-content|app-container|sidebar|header" src/styles src/components src/pages`
  - result: shell selectors and override rules present; no parse/runtime blocker from search output

## Remaining risks
### Critical
- None identified from compile/static validation.

### High
- Visual behavior should still be validated in browser across target widths due historical CSS duplication.

### Medium
- Lint debt remains broad and unrelated to this conflict-resolution scope.

### Low
- Additional CSS consolidation can reduce long-term conflict risk in future PRs.
