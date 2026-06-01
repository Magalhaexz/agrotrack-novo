# HERDON Deep Beta Readiness Audit (Sprint 14)

Date: June 1, 2026  
Workspace: `D:\agrotrack-novo`

## Executive Summary
HERDON is **not yet safe for external beta users**.

The technical foundation improved significantly (local snapshot persistence, user-scoped pending queue, stable build/lint/tests), but deep real-account certification is still incomplete because authenticated E2E execution is blocked by missing runtime credentials. Without real multi-user, multi-session evidence, data trust and role safety cannot be fully certified for external users.

## Beta Readiness Verdict
**No**

## Critical P0 Blockers
1. **No full authenticated end-to-end certification with real accounts**
   - Evidence: `npm run e2e` skips due missing `E2E_*` variables (`E2E_ADMIN_*`, `E2E_USER_A_*`, `E2E_USER_B_*`, `E2E_BASE_URL`).
   - Impact: Core flows (CRUD, refresh, logout/login, RLS isolation, console/network behavior) are not runtime-certified.

2. **Deep data-trust stress scenarios are not fully proven in browser runtime**
   - Code-level protections exist, but no executed real-user evidence for:
     - cloud unstable during save + refresh + logout/login + reopen browser
     - queue reconciliation without duplicates in real Supabase runtime
   - Impact: external beta risk remains for trust-critical data continuity.

## P1 Issues (Must Fix Before External Users)
1. **Supabase schema governance still incomplete vs requested strategic scope**
   - `pastagens` and `cenarios` migration exists (`docs/supabase-strategic-tables-sprint12a.sql`).
   - `cenario_eventos` is requested in this audit scope but not found in active schema contract/migrations.
   - Impact: potential runtime gaps for scenario event history/expansion.

2. **E2E coverage breadth is still smoke-level**
   - Existing suite (`e2e/smoke.spec.js`) focuses on auth/fazenda persistence/RLS permission smoke.
   - Not covering full operational + strategic CRUD matrix required for beta signoff.

3. **Module persistence consistency risk (cloud vs local-only semantics)**
   - Example: Suplementação flow is heavily `setDb(...)` local-state driven, with limited direct operational persistence calls in that page.
   - With Sprint 13A snapshot, local continuity is better, but cloud durability behavior per entity is uneven and not fully certified.

4. **Text encoding quality still inconsistent**
   - Multiple UI labels/files show mojibake (`NutriÃ§Ã£o`, `FuncionÃ¡rios`, etc.).
   - Impact: user trust/professional quality for Portuguese UI.

## P2 Issues (Should Fix Soon)
1. **Planejamento tab composition is functionally dense**
   - Consolidated strategy area works, but embeds multiple full pages; can feel heavy/crowded.

2. **Global CSS size/complexity regression risk**
   - `dist/assets/index-*.css` around 151 KB indicates large styling surface and higher regression probability.

3. **Performance validation incomplete in real usage**
   - Build is fast locally, but no measured real-account timings for initial hydration under unstable network.

## P3 Polish
1. Improve hierarchy/visual rhythm consistency across strategic cards and tables.
2. Standardize empty-state helper language across modules.
3. Reduce repeated full-page headers when pages are rendered inside Planejamento tabs.

---

## Module-by-Module Test Results
Legend: `Pass (Automated/Static)`, `Partial`, `Blocked (Needs Real Auth Runtime)`

| Module | Status | Notes |
|---|---|---|
| Auth/login/logout/session recovery | Blocked | E2E auth tests exist but skipped due missing credentials. |
| Fazendas | Partial | Strong persistence code paths; runtime full certification blocked. |
| Lotes | Partial | Build/tests pass; full CRUD + refresh/logout/login not runtime-certified. |
| Animais | Partial | Domain tests pass; runtime E2E blocked. |
| Pesagens | Partial | Domain and build pass; runtime deep flow blocked. |
| Sanitário/IATF | Partial | UI exists; real-account end-to-end not certified here. |
| Estoque | Partial | Functional code paths exist; runtime certification blocked. |
| Nutrição/Suplementação | Partial | Local-state heavy flow; runtime/cloud durability not fully certified. |
| Financeiro | Partial | Core module active; no full authenticated deep cycle evidence. |
| Pastagens | Partial | Strategic table and page exist; real-account certification blocked. |
| Evolução do Rebanho | Pass (Automated) / Blocked (Runtime) | Formula tests pass; full runtime data-source validation blocked. |
| Indicadores | Pass (Automated) / Blocked (Runtime) | Formula safety validated; runtime certification blocked. |
| Cenários | Pass (Automated) / Blocked (Runtime) | Projection tests pass; runtime multi-session certification blocked. |
| Relatórios | Partial | Renders strategic data; depends on upstream runtime data trust. |
| Planejamento | Partial | Consolidated nav achieved; runtime usability/load behavior needs real-user validation. |

---

## Data Persistence Test Results
### What is validated now
- Local snapshot persistence added and tested:
  - save/load snapshot tests pass
  - user-scoped snapshot isolation tests pass
- Pending queue behavior improved and tested:
  - user-scoped queue snapshot test passes
  - queue dedup for repeated failed create test passes

### What remains unverified in real runtime
- Full browser workflow with real authenticated user:
  - save during cloud instability
  - refresh
  - close/reopen browser
  - logout/login
  - successful reconciliation without duplicates

Result: **Improved but not fully certified for external beta**.

---

## Supabase / Schema / RLS Status
### Positive
- Owner scoping patterns are widespread in persistence layer.
- Optional strategic table handling exists (`pastagens`, `cenarios`) in hydration logic.
- E2E smoke includes RLS scenario scaffold (User A vs User B).

### Gaps
- No executed RLS runtime proof in this environment due missing credentials.
- `cenario_eventos` not found in current strategic migration/contracts.
- Some module persistence surfaces remain uneven (local snapshot dependence vs cloud-first durability).

Overall status: **Partially ready, not certifiable for external beta yet**.

---

## Fresh User Experience Results
### Validated by code/tests
- Authenticated fallback seed is empty (`fallbackSeed = userId ? {} : initialDb`), reducing mock data leakage risk.
- Snapshot hydration prefers user-scoped local snapshot for signed users.

### Not fully runtime-certified
- Fresh account first-run onboarding clarity under real cloud/session conditions.
- No scary cloud language in all normal paths for fresh users.

Result: **Promising, but runtime-certified result is blocked**.

---

## Mobile Results
- No deep device-matrix execution in this audit run.
- Structural risk remains due large global styling surface and dense page compositions.

Status: **Not certified for external beta quality bar**.

---

## Performance Findings
### Measured
- `npm run build` passed quickly in local environment.
- Bundle includes heavy assets/chunks (notably large shared CSS and app chunk sizes).

### Not measured with real-user workload
- initial authenticated hydration latency
- retries under unstable cloud
- perceived lag in large tables/forms

Status: **Partial evidence only**.

---

## Console / Network Findings
### Measured
- Automated E2E run indicates harness available but skipped due missing credentials.

### Not measured due blocked runtime auth
- repeated 404 behavior in real usage
- production-like console warnings during authenticated navigation
- network retry storms under unstable connectivity

Status: **Not certified**.

---

## Data Trust Stress Test (Requested Scenarios)
| Scenario | Result |
|---|---|
| Stable cloud create/edit/save | Blocked (needs real account run) |
| Cloud temporarily failing during save | Partial (code/tests), blocked runtime proof |
| Refresh after local-only save | Partial (snapshot tests), blocked runtime proof |
| Logout/login continuity | Blocked runtime proof |
| Close/reopen browser continuity | Blocked runtime proof |
| Queue survives refresh | Pass (code/test evidence) |
| No duplicates after recovery | Partial (queue dedup tests), blocked runtime proof |
| User isolation | Partial (tests), blocked multi-user runtime proof |
| No mock data for authenticated users | Partial (code path), blocked full runtime proof |

---

## Recommended Final Sprint Sequence Before Beta
1. **Sprint 14A — Real-Account E2E Enablement (P0)**
   - Provision `E2E_*` credentials and base URL in secure test environment.
   - Run headed + CI e2e with artifact retention.

2. **Sprint 14B — Full Critical CRUD + Persistence E2E Expansion (P0/P1)**
   - Cover each required module flow (create/edit/delete/refresh/logout/login/reopen).
   - Add explicit cloud-failure/recovery scenarios.

3. **Sprint 14C — Schema/RLS Closure (P1)**
   - Validate all required tables in scope, including `cenario_eventos` decision (create or de-scope explicitly).
   - Final RLS runtime verification with at least 3 profiles.

4. **Sprint 14D — UX/Encoding/Clarity Cleanup (P1/P2)**
   - Fix encoding artifacts.
   - Harmonize empty/loading states and strategic visual hierarchy.

5. **Sprint 14E — Mobile + Performance Certification (P2)**
   - Device-width matrix and long-form/table flows.
   - Baseline performance thresholds and console/network clean pass.

---

## Exact Fixes Needed Before Beta
1. Provide and wire secure E2E credentials/env for real authenticated runs.
2. Execute and pass full module CRUD+persistence E2E matrix.
3. Add runtime-verified cloud-failure/recovery test cases (no loss, no duplicates).
4. Confirm cross-user isolation in runtime with real distinct accounts/roles.
5. Resolve schema scope mismatch for `cenario_eventos` (implement table + contract, or remove requirement).
6. Normalize Portuguese text encoding issues across UI.
7. Run final console/network clean sweep on authenticated full navigation.

---

## Commands Executed in This Audit
1. `npm run lint` -> **Pass**
2. `npm run build` -> **Pass**
3. `npm test` -> **Pass (45/45)**
4. `npm run e2e` -> **Skipped** (missing `E2E_*` variables)
