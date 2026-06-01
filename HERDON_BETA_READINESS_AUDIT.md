# HERDON Beta Readiness Audit (Sprint 13)

## Executive Summary
HERDON is **not ready for external beta testing yet**.

The app has strong progress in module breadth, navigation consolidation, strategic calculations, and automated unit/domain tests. However, there are still important data-trust and operational resilience gaps that can break confidence for real users, especially around persistence behavior when cloud sync is unstable.

## Is the app ready for beta?
**No**.

---

## P0 Blockers (must fix before any external beta)

1. **Unsynced/local-only operational edits are not durably persisted for reload continuity**
   - Evidence:
     - `src/hooks/useOperationalData.js` hydrates from cloud or empty fallback (`fallbackSeed = userId ? {} : initialDb`).
     - There is no durable local DB snapshot storage for operational entities (only pending sync queue + auth/profile keys in localStorage).
     - `src/services/operationalPersistence.js` persists pending queue, but not full local operational state.
   - Risk:
     - User may save data while cloud is unstable (`pending_sync/local_only`) and then lose visible records after refresh/logout/login until cloud eventually accepts queued payloads.
   - Why this is P0:
     - Violates core trust expectation: “I saved data and refreshed, it’s still there.”

2. **Full real-user flow validation is incomplete (no end-to-end proof for all critical flows)**
   - Evidence:
     - Unit/domain tests pass, but there is no audit evidence of end-to-end execution of all required CRUD + persistence flows in the same environment/session.
   - Risk:
     - Hidden integration regressions between UI, permissions, persistence queue, and cloud behavior.
   - Why this is P0:
     - External beta should not start without at least one full-system checklist run covering all core operations.

---

## P1 Issues (must fix before external users)

1. **Cloud missing-table handling is only partially hardened**
   - Evidence:
     - `src/hooks/useOperationalData.js` now skips known missing optional tables (`pastagens`, `cenarios`) after first schema-not-found.
     - `OPERACIONAL_TABLES` still includes many tables (`usuarios`, `configuracoes`, `rotinas`, etc.) that can still fail loudly in dev/runtime if schema is inconsistent.
   - Risk:
     - Recurrent partial hydration failures and unstable perceived reliability depending on Supabase schema maturity.

2. **Text encoding quality risk across UI strings (mojibake in source content)**
   - Evidence:
     - Multiple files contain visibly corrupted accented strings in source (`NutriÃ§Ã£o`, `EvoluÃ§Ã£o`, etc.).
   - Risk:
     - Unprofessional UX and potential support burden for Portuguese-speaking users.

3. **Planejamento composition can feel heavy due nested pages**
   - Evidence:
     - `src/pages/PlanejamentoPage.jsx` renders full strategic pages inside tabs (`PastagensPage`, `IndicadoresPage`, etc.), each with its own `PageHeader` and full card layout.
   - Risk:
     - Visual redundancy and perceived complexity in the consolidated strategic area.

4. **Cloud diagnostics/control paths are still spread through operational UI**
   - Evidence:
     - Diagnostic/reconnect/sync logic remains present in domain hooks and module flows (especially Fazenda orchestration).
   - Risk:
     - Hidden complexity and maintainability burden; potential accidental user exposure during future UI edits.

---

## P2 Issues (should fix soon)

1. **Empty/loading state consistency is uneven across modules**
   - Some modules use strong “Sem dados suficientes” handling; others still rely on numeric fallbacks (`0`) where missing-data semantics are more appropriate.

2. **Mobile layout resilience depends heavily on large global CSS overrides**
   - `src/styles/app.css` is very large and layered with many sprint hotfix sections, increasing regression risk.

3. **Strategic state lifecycle clarity**
   - Strategic screens are robust in formulas/tests, but lifecycle messaging (baseline vs projected, incomplete data context) is not consistently explicit across every card/table.

4. **Permission matrix breadth is good, but needs flow-level QA per role**
   - Role mappings exist (`src/auth/perfis.js`), but behavior still needs full click-path role QA (admin/gerente/operador/visualizador) for all newly consolidated areas.

---

## P3 Polish

1. Standardize card spacing/typography rhythm across all modules to reduce visual variance.
2. Normalize helper text style for “Sem dados suficientes” vs “Nenhum registro”.
3. Reduce duplicated inline style fragments in page components.
4. Continue shrinking header/notification complexity for maintainability.

---

## Module-by-Module Status

- **Login/Auth**: **Needs work** (core works; needs full multi-role flow QA + session edge-case QA).
- **Dashboard**: **Needs work** (functional, but depends on broader data trust/persistence guarantees).
- **Cadastros (general)**: **Needs work** (usable; compactness improved; requires persistence confidence in unstable cloud paths).
- **Fazendas**: **Needs work** (strong logic; still tied to complex cloud orchestration paths).
- **Lotes**: **Needs work** (rich flow; requires end-to-end persistence and role validation).
- **Animais**: **Needs work** (individual/group flows implemented; requires full operational QA sequence).
- **Pesagens**: **Needs work** (feature-rich; needs integrated regression pass with Lotes/Animais).
- **Sanitário/IATF**: **Needs work** (UX improved in Sprint 12B; persistence + reminders regression QA still required).
- **Estoque**: **Needs work** (usable; role + persistence + mobile table checks needed).
- **Nutrição/Suplementação**: **Needs work** (broadly functional; requires stronger UX consistency and integrated financial impact QA).
- **Financeiro**: **Needs work** (complex and central; requires deeper scenario/data isolation QA).
- **Planejamento (consolidated)**: **Needs work** (navigation solved; still heavy composition and consistency polish needed).
- **Pastagens**: **Needs work** (implemented; cloud optional-table lifecycle must be stable).
- **Evolução do Rebanho**: **Needs work** (formula validated by tests; needs full source-data movement QA).
- **Indicadores**: **Needs work** (good safeguards; cross-module data quality QA still needed).
- **Cenários**: **Needs work** (tests pass; must confirm strict isolation from operational writes in all UI paths).
- **Relatórios**: **Needs work** (reads strategic outputs; quality tied to upstream data trust).
- **Configurações**: **Needs work** (backup tooling exists; requires cloud governance clarity for beta users).

---

## Supabase/Cloud Status

- Current status: **Partially stabilized, not fully beta-safe**.
- Positives:
  - Optional table skip logic added for missing strategic tables in `useOperationalData`.
  - Pending sync queue exists and retries.
- Gaps:
  - No durable local operational snapshot for refresh continuity when cloud is unstable.
  - Schema mismatch handling is not uniformly explicit for every table in hydration set.
  - Complex cloud control logic remains distributed across app layers.

---

## Data Trust Status

- Current status: **Not yet sufficient for external beta**.
- Positives:
  - Logged-in fallback no longer injects sample/mock dataset as visible operational seed.
  - Owner-scoped persistence behavior has test coverage.
- Gaps:
  - Saved-but-unsynced visibility may be lost after reload/logout due missing durable local operational cache.
  - Must validate user isolation with real multi-user Supabase accounts in manual end-to-end runs.

---

## UX/Navigation Status

- Current status: **Improved but still inconsistent**.
- Positives:
  - Sidebar simplified and Planejamento consolidated.
  - Cloud technical messaging hidden from normal top-level usage.
  - Sanitário/IATF visual structure improved.
- Gaps:
  - Some modules still show uneven hierarchy and density.
  - Strategic tab content can feel “stacked”/redundant (full-page-in-tab pattern).

---

## Mobile Status

- Current status: **Usable but high regression risk**.
- Positives:
  - Extensive mobile-specific CSS handling exists.
- Gaps:
  - Heavy global CSS layering makes future regressions likely.
  - Needs structured manual test matrix on common device widths and long-content forms/tables.

---

## Calculation Status

- Current status: **Technically strong at domain level**.
- Evidence:
  - `npm test` passed all 41 tests, including:
    - UA and capacity diagnostics
    - Evolução do rebanho
    - Indicadores técnicos/econômicos
    - Cenários projections
    - Lote financial summaries
    - NaN/Infinity safety checks in core domains
- Remaining concern:
  - UI-level consistency for missing-data semantics still needs manual review module-by-module.

---

## Recommended Final Sprint Sequence Before Beta

1. **Sprint 13A – Data Trust & Persistence Hardening (P0)**
   - Implement durable local operational snapshot strategy for pending/local-only saves.
   - Guarantee refresh continuity for unsynced edits.
   - Add explicit reconciliation UX after cloud recovery.

2. **Sprint 13B – Full E2E Critical Flow Certification (P0/P1)**
   - Execute and document all critical flows from creation to refresh/logout/login persistence.
   - Validate per-role behavior for admin/gerente/operador/visualizador.

3. **Sprint 13C – Cloud Schema Governance (P1)**
   - Finalize required Supabase tables/migrations.
   - Classify optional vs required hydration tables formally.
   - Ensure no repeated schema errors in normal operation.

4. **Sprint 13D – UX Consistency & Encoding Cleanup (P1/P2)**
   - Fix text encoding artifacts globally.
   - Harmonize empty/loading states and card/table density.
   - Polish Planejamento tab content hierarchy.

5. **Sprint 13E – Mobile Regression Sweep (P2)**
   - Structured device-width checklist.
   - Table/action/footer overlap checks.
   - Final spacing/interaction adjustments.

---

## What Should Not Be Built Yet

1. New strategic simulation complexity (advanced multi-scenario engines, Monte Carlo, etc.).
2. Additional premium pages/features that expand navigation again.
3. New cloud diagnostics UX for end users.
4. Major redesign of auth/permissions model before persistence trust is finalized.
5. Non-essential integrations (exports/connectors) before P0/P1 reliability is closed.

---

## Commands Run for This Audit

- `npm test` -> **Pass (41/41)**
- Existing recent verification context also indicates `npm run lint` and `npm run build` passing in current branch state.

---

## Final Readiness Verdict

HERDON is **close**, but **not yet beta-ready for real external users** due to P0 data persistence trust risk and incomplete full-flow end-to-end certification.
