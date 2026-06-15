# SPRINT20A Critical Stability, Schema, Text and Security - HERDON

## Scope delivered
Focused only on critical stability and governance hardening, without redesigning product modules.

## What was fixed
- Added text-integrity guard script:
  - `scripts/check-text-integrity.ps1`
- Added canonical schema contract document:
  - `SUPABASE_SCHEMA_CONTRACT_HERDON.md`
- Added Supabase RLS checklist document:
  - `HERDON_SUPABASE_RLS_CHECKLIST.md`
- Added DEV-only schema debug helper in persistence layer:
  - `window.HERDON_SCHEMA_DEBUG.getPendingSchemaErrors()`
  - `window.HERDON_SCHEMA_DEBUG.getExpectedTables()`
  - file: `src/services/operationalPersistence.js`
- Added minimal access guardrails:
  - block self-demotion in fallback user role edit
  - block invite delete when invite status is `aceito`
  - deterministic refresh (`await carregarDadosDeAcesso()`) after cancel/remove invite
  - clearer remove button label: `Remover convite`
  - file: `src/pages/ConfiguracoesPage.jsx`
- Improved production log hygiene in targeted points:
  - gated diagnostics in `FazendasPage` and `ConfiguracoesPage` with `import.meta.env.DEV`

## Files changed
- `scripts/check-text-integrity.ps1`
- `SUPABASE_SCHEMA_CONTRACT_HERDON.md`
- `HERDON_SUPABASE_RLS_CHECKLIST.md`
- `src/services/operationalPersistence.js`
- `src/pages/ConfiguracoesPage.jsx`
- `src/pages/FazendasPage.jsx`

## Corrupted text cleanup summary
- Partial cleanup was applied safely in selected files.
- A large historical mojibake cluster still exists, mainly in:
  - `src/pages/LotesPage.jsx`
  - `src/services/operationalPersistence.js`
- These files remain functional/buildable, but still contain legacy corrupted strings that require a dedicated controlled cleanup pass.

## Validation results
- `npm run lint`: PASS
- `npm run build`: PASS

Additional scans executed:
- text corruption scan (PowerShell pattern set): still returns many hits, including valid Portuguese accents (false positives) and real mojibake hotspots in critical legacy files.
- unsafe logging scan: diagnostics are mostly DEV-oriented; remaining consoles should be migrated to centralized safe logger in a follow-up hardening pass.

## Remaining known risks
- Mojibake is not fully eliminated yet in critical legacy files.
- `src/pages/LotesPage.jsx` still depends on `/* eslint-disable no-irregular-whitespace */` because of legacy hidden characters.
- Some cloud-sync status strings in `operationalPersistence.js` still need full normalization to Portuguese UTF-8.

## Recommended next sprint
- Continue with a dedicated **20A.1 text normalization pass** (no feature work):
  1. sanitize `LotesPage.jsx` hidden characters and remove `no-irregular-whitespace` disable safely,
  2. normalize remaining `operationalPersistence.js` user-facing strings,
  3. rerun integrity scan with stricter filters to separate false positives from true mojibake.
