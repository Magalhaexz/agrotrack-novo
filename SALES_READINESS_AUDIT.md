# HERDON Sales Readiness Audit

UI text was not changed. This report is in English, as requested.

## Verdict
HERDON is **not yet ready for paid beta**.

The app has solid functional coverage across the core modules, and the current workspace passes lint, build, and test checks. The main blockers are around production trust: bundled demo seed data, incomplete repository schema coverage for a fresh Supabase setup, and cloud persistence paths that can still degrade into local/fallback behavior during normal user flows.

## Scope Reviewed
- Fazendas
- Lotes
- Animais
- Pesagens
- Sanitario
- Estoque
- Suplementacao
- Financeiro
- Pastagens
- Indicadores
- Relatorios
- Login/logout/session behavior
- Role permissions
- Mobile responsiveness
- Cloud sync and persistence behavior

## Critical Blockers

1. Bundled demo seed data is still part of the production code path.
   - Evidence: [src/data/mockData.js](D:/agrotrack-novo/src/data/mockData.js#L1) still contains the demo seed and the comment that it should be removed before production.
   - Evidence: [src/App.jsx](D:/agrotrack-novo/src/App.jsx#L2) imports `initialDb`, and the operational hook bootstraps from that seed when signed out.
   - Evidence: [src/hooks/useOperationalData.js](D:/agrotrack-novo/src/hooks/useOperationalData.js#L591) uses `fallbackSeed = userId ? {} : initialDb`.
   - Risk: demo records can still surface during auth transitions, sign-out states, or recovery paths. For a paid SaaS, that is a trust blocker.

2. The repository does not include a complete production SQL bundle for all operational tables.
   - Evidence: the repo contains partial SQL docs such as [docs/supabase-perfis-e-convites.sql](D:/agrotrack-novo/docs/supabase-perfis-e-convites.sql#L1) and [docs/supabase-strategic-tables-sprint12a.sql](D:/agrotrack-novo/docs/supabase-strategic-tables-sprint12a.sql#L1).
   - Evidence: [src/hooks/useOperationalData.js](D:/agrotrack-novo/src/hooks/useOperationalData.js#L4) expects many operational tables at runtime, including `fazendas`, `lotes`, `pastagens`, `animais`, `pesagens`, `sanitario`, `estoque`, `movimentacoes_*`, `funcionarios`, `rotinas`, `usuarios`, `configuracoes`, and `cenarios`.
   - Risk: a fresh production environment can fail or partially hydrate if the customer does not already have a matching schema. That is a launch blocker for a sellable SaaS.

3. Cloud persistence is still best-effort and can fall back to local mode under normal failures.
   - Evidence: [src/hooks/useOperationalData.js](D:/agrotrack-novo/src/hooks/useOperationalData.js#L627) explicitly falls back to local data when sync is disabled, delayed, timed out, or unstable.
   - Evidence: the same file sets user-facing error states such as "Sincronizacao demorou mais que o esperado. O app segue em modo local." and "Sincronizacao instavel. Seus dados locais continuam disponiveis."
   - Evidence: [src/services/operationalPersistence.js](D:/agrotrack-novo/src/services/operationalPersistence.js#L261) and related code paths still emit local-only/fallback sync states when cloud writes are not guaranteed.
   - Risk: a paid customer can believe they saved to the cloud when the app is actually operating locally. For production sales readiness, that is too risky until the behavior is fully tightened and clearly gated.

## Medium Issues

1. Auth and session bootstrap can still show fallback state while the app is deciding whether the session is valid.
   - Evidence: [src/auth/AuthContext.jsx](D:/agrotrack-novo/src/auth/AuthContext.jsx#L140) accepts a session and resolves profile fallback before optional profile sync finishes.
   - Evidence: [src/App.jsx](D:/agrotrack-novo/src/App.jsx#L249) treats the app as boot-loading while auth is unresolved, and the operational data hook may publish fallback state during that window.
   - Risk: brief flashes of local/fallback state or stale user context can confuse a paying user, even if the final data is correct.

2. Technical cloud/sync language is still visible in user-facing controls.
   - Evidence: [src/hooks/useCloudControls.js](D:/agrotrack-novo/src/hooks/useCloudControls.js#L13) shows user-facing sync and reconnect prompts, plus other operational diagnostics.
   - Evidence: [src/pages/ConfiguracoesPage.jsx](D:/agrotrack-novo/src/pages/ConfiguracoesPage.jsx#L675) explicitly surfaces migration-oriented copy for the access module.
   - Risk: the product feels less like a polished SaaS and more like an internal tool with technical plumbing exposed.

3. Role/permission logic exists, but production QA still needs full click-path validation per role.
   - Evidence: [src/auth/perfis.js](D:/agrotrack-novo/src/auth/perfis.js#L30) defines the permission matrix, and pages such as [src/pages/ConfiguracoesPage.jsx](D:/agrotrack-novo/src/pages/ConfiguracoesPage.jsx#L71) enforce access checks.
   - Evidence: the tests already cover matrix behavior, but the UI still needs full role-by-role manual validation in the critical modules.
   - Risk: permission regressions are easy to miss in a multi-module app with fallback behaviors.

4. Initial data hydration and recovery timers can make the dashboard feel slow.
   - Evidence: [src/hooks/useOperationalData.js](D:/agrotrack-novo/src/hooks/useOperationalData.js#L30) uses a hydration delay and later a 6-second boot recovery timer in the app shell.
   - Evidence: [src/App.jsx](D:/agrotrack-novo/src/App.jsx#L272) shows a recovery state if boot loading persists.
   - Risk: even if the app is working, the perceived startup quality can be weak during cloud latency or session recovery.

5. Optional-table handling is only partially explicit.
   - Evidence: [src/hooks/useOperationalData.js](D:/agrotrack-novo/src/hooks/useOperationalData.js#L41) only marks `pastagens` and `cenarios` as optional strategic tables.
   - Risk: future schema drift in other operational tables can still create partial hydration instability unless the schema contract is fully consolidated.

## Low Priority Polish

1. Mobile layout should get one more full-width QA pass on the most complex forms and tables.
   - The repo has already invested heavily in mobile hardening, but the remaining work is likely edge polish rather than a launch blocker.

2. Developer-oriented console/log messaging should be minimized further where it is still visible in runtime code paths.
   - Most of the logging is dev-only, but the audit found enough operational diagnostics to justify a final cleanup pass.

3. Demo maintenance controls in settings should be reconsidered after production launch.
   - The cleanup tooling is useful during migration, but it should not remain a prominent part of the normal paid-beta mental model.

## Recommended Execution Order

1. Remove bundled demo seed exposure from production startup and confirm no authenticated path can surface mock records.
2. Deliver a complete, versioned Supabase schema/migration bundle for the operational tables.
3. Tighten cloud persistence guarantees so paid users never mistake local fallback for successful cloud save.
4. Re-run full login/logout/session and role-permission QA across the critical modules.
5. Remove or soften technical sync/migration messaging that leaks internal implementation details.
6. Finish mobile/table/form polish on the modules with the densest layouts.
7. Run final regression checks after the above are complete.

## Validation Status

- `npm.cmd run lint` passed
- `npm.cmd run build` passed
- `npm.cmd test -- --runInBand` passed

## Bottom Line
The app is functionally broad and the current codebase is stable, but the production sales story is not yet strong enough for paid beta. The main work now is trust hardening: no demo leakage, complete schema provisioning, and clearer cloud-vs-local persistence guarantees.
