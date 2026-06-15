# HOTFIX 6.3 — Supabase Cloud Root Cause (HERDON)

## 1. Executive summary

This hotfix focused on the cloud sync failure path for **Fazendas** in HERDON, with production/demo urgency.  
The code was updated to make sync safer and more resilient, prioritize Supabase SDK over fragile manual REST checks, preserve local usability, and improve diagnostics without exposing secrets.

Important: **cloud sync success is not claimed as fully resolved yet**, because a full interactive browser confirmation of successful cloud sync under real network/project conditions is still required.

---

## 2. Exact observed failure

Observed behavior when clicking **"Sincronizar fazendas com a nuvem"**:

- Error toast shown: cloud connection failed.
- Topbar switched to local mode state.
- Previously observed diagnostic pattern:
  - `stage: network_error`
  - `errorName: TypeError`
  - `errorMessage: Failed to fetch`
  - `status: null`
  - Host/path targeting Supabase REST `.../rest/v1/fazendas`

This pattern indicates browser/network-level failure before receiving an HTTP response.

---

## 3. Files inspected

- `src/pages/FazendasPage.jsx`
- `src/hooks/useOperationalData.js`
- `src/services/operationalPersistence.js`
- `src/lib/supabase.js`
- `src/services/supabaseDiagnostics.js`
- `src/components/AppHeader.jsx`
- `src/auth/AuthContext.jsx` (for admin/profile context integration)

---

## 4. Root cause found

Root cause was **not a single issue**; it was a combination of factors in the sync path:

1. Sync health and Fazendas sync path previously depended on a **custom REST fetch flow** vulnerable to browser-level fetch failures (`Failed to fetch`, `status null`).
2. Environment value handling needed stronger normalization/validation to reduce malformed/stale env edge cases.
3. Session readiness could fail with stale/mismatched session timing, requiring safer session-refresh handling.
4. Sync-state/fallback behavior needed hard guarantees to avoid ambiguous cloud status and to keep app usable locally.

Potential **external** root causes may still exist (Supabase project paused/unreachable, DNS/firewall/proxy, invalid Vercel env), and must be validated outside code.

---

## 5. Fix implemented

### A) Cloud sync path hardened

- Health check and Fazendas sync flow were shifted to **Supabase SDK-first** in operational flow.
- Reduced dependency on fragile custom REST manual checks in critical sync path.

### B) Session readiness reinforced

- `ensureSupabaseRequestReadiness(...)` now attempts `supabase.auth.refreshSession()` when stale/mismatch is detected before failing sync.
- If still invalid, user gets clear Portuguese re-login message.

### C) Emergency local-mode behavior improved

- App remains usable in local mode when cloud fails.
- No false cloud success state:
  - `dataSource='supabase'` and `lastSyncAt` only update on real successful sync completion.
- Partial snapshot failures now preserve local-safe cloud status (`fallback_error`/offline path), not false “Nuvem ativa”.

### D) Cloud status UX safety

- Topbar warning state refined to show **"Dados locais"** in fallback/error conditions.

### E) Diagnostics

- Added dedicated connectivity diagnostics utility:
  - `src/services/supabaseDiagnostics.js`
- Added gated action in Fazendas page:
  - visible in `DEV` or admin-capable context
  - safe summary for operators
  - safe console diagnostics for developers/admin

### F) Env normalization

- `src/lib/supabase.js` uses normalized env values (trim + quote stripping) before creating Supabase client.

---

## 6. Why the previous fallback was not enough

Previous behavior protected local data, but still had gaps:

- Critical path was still vulnerable to manual REST fetch failures.
- Cloud-state transitions could become ambiguous after partial failures.
- Session stale cases were not proactively refreshed before failing sync.
- Developers/admins lacked a clear in-app root-cause diagnostic summary.

The hotfix improves these points while preserving fallback/local behavior.

---

## 7. Current cloud sync behavior

When user clicks sync in Fazendas:

1. Readiness/session guard runs.
2. Cloud health is evaluated through SDK path.
3. Sync write/read for Fazendas uses SDK path.
4. Loading toast is cleaned in `finally`.
5. Status/timestamp update only on real successful completion.
6. On failure, cloud chip remains local/fallback state and retry remains available.

---

## 8. Local fallback behavior

If cloud fails or is unstable:

- App remains operational with local data.
- Topbar shows local/fallback status (`Dados locais` / paused state as applicable).
- User sees non-technical Portuguese guidance.
- No fake cloud-active state is shown.

Standard network-unavailable message used:

> "A nuvem está indisponível neste momento. Você pode continuar usando os dados locais e tentar sincronizar novamente depois."

---

## 9. Safe diagnostics added

### Utility

- `runSupabaseConnectivityDiagnostics(...)` in:
  - `src/services/supabaseDiagnostics.js`

Checks layers separately:

- Env configuration
- Session readiness
- REST reachability classification
- SDK reachability comparison

Returns structured safe object (`ok`, `stage`, `classification`, `message`, `safeDetails`) without token/secret exposure.

### UI action

- `Diagnosticar nuvem` button in Fazendas sync actions
- Visible only in `DEV` or admin context
- Shows Portuguese summary (non-raw for normal users)
- Safe console metadata under diagnostic tags

---

## 10. Validation commands and results

Executed:

1. `npm.cmd run build`  
   - **Passed**

2. `npm.cmd run lint`  
   - **No errors**
   - Existing repository warnings remain (`react-hooks/exhaustive-deps`, 30 warnings)

No new parse/runtime error was introduced by this hotfix set.

---

## 11. Manual browser validation checklist

Run on local/target environment before demo:

1. Open HERDON and authenticate.
2. Go to Fazendas.
3. Click **Sincronizar fazendas com a nuvem**.
4. Confirm loading toast appears and is removed in all outcomes.
5. On success:
   - chip becomes **Nuvem ativa**
   - `lastSyncAt` updates
6. On failure:
   - chip remains local-safe (**Dados locais** or paused mode)
   - retry button remains usable
   - user sees Portuguese non-technical failure guidance
7. Run **Diagnosticar nuvem** (DEV/admin):
   - confirm classification message is coherent
   - confirm no secrets/tokens in logs.

---

## 12. Remaining risks

1. **External infrastructure risk remains**:
   - Supabase project paused/unreachable
   - DNS/firewall/proxy blocking
   - stale/wrong env values in deployed platform
2. Full interactive cloud-success validation is pending in real browser/network conditions.
3. Existing lint warnings are technical debt (non-blocking for this hotfix).

---

## 13. Production/demo recommendation for tomorrow

Recommended go/no-go procedure:

1. Confirm deployment env values in platform (e.g., Vercel):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Confirm Supabase project status is **active**.
3. Run manual sync from Fazendas in deployed build.
4. If sync still fails with network classification:
   - treat as **external connectivity/project issue**, not local UI bug
   - proceed in local mode for demo and present cloud as temporarily unavailable.

If external issue persists, apply this operational fix outside app code:

- Reactivate Supabase project
- Correct deployment env variables
- Rebuild/redeploy to flush stale env
- Validate network path from client browser to `*.supabase.co`

Until the manual cloud-success check passes, this report classifies the result as:

**Code path hardened and fallback stabilized; real cloud availability still environment-dependent.**

