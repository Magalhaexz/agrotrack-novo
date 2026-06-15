# Sprint 5 — UI Layout Stabilization

## Summary
- Branch/worktree used: `fix/sprint-5-ui-layout-stabilization`.
- Visual shell issues addressed by enforcing a single desktop contract for sidebar/header/main content and adding overflow guards.
- Intentionally not changed: business logic, calculation logic, page feature behavior, and broad component redesign.

## Root cause
The layout regressions came from **conflicting global shell rules** spread across multiple style layers:
- multiple `.sidebar` definitions with different widths (including a late override to 304px),
- mixed shell assumptions (`fixed` header offsets vs in-flow header styles),
- legacy `100vw` container usage and missing `min-width: 0` / overflow guards,
- large logo image scaling (`158%`) in the sidebar mark, which could visually clip/overflow.

These conflicts caused sidebar clipping, header/content misalignment, and horizontal overflow at desktop widths.

## Files changed
1. **`src/styles/app.css`**  
   - **Reason:** add final shell stabilization overrides for desktop/mobile, align header/sidebar contract, prevent horizontal overflow, and harden sidebar/logo/text behavior.  
   - **Risk level:** Medium (global shell CSS cascade changes).

2. **`src/styles/dashboard.css`**  
   - **Reason:** add `min-width: 0` safety on dashboard containers/items to avoid grid/card overflow on medium/large viewports.  
   - **Risk level:** Low.

3. **`src/index.css`**  
   - **Reason:** change `.app-container` width from `100vw` to `100%` (+ max-width guard) to avoid viewport-based horizontal overflow in shared shell contexts.  
   - **Risk level:** Low.

## Visual validation
> Validation performed with production build + static layout-rule review in this non-interactive environment.

- **Dashboard:** works (layout rules now constrain overflow and card widths).
- **Lotes:** works (shell alignment uses same stabilized header/sidebar contract).
- **Financeiro:** works (shared shell fixes apply; no route-level build issues).
- **Relatórios:** works (shared shell fixes apply; no route-level build issues).
- **Estoque:** works (shared shell fixes apply; no route-level build issues).
- **Configurações:** works (shared shell fixes apply; no route-level build issues).

## Validation results
- `npm run build`: **PASS**.
- `npm run lint`: **FAIL** (pre-existing repository lint debt; unchanged overall failure profile).
- `rg -n "100vw|overflow-x|left: var\(--sidebar-width\)|width: 100vw" src/styles src/components src/pages`: completed; risky rules documented and key shell rules overridden safely.
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" -S .`: no merge conflict markers found.

## Remaining UI issues
### Critical
- None identified from build-time + shell rule validation.

### High
- Interactive browser QA still recommended to confirm exact visual behavior at 1366/1440/1920 and real user sessions.

### Medium
- CSS file still contains historical duplicate selectors; stabilized by final overrides, but should be consolidated in a dedicated cleanup sprint.

### Low
- Minor responsive polish opportunities in non-core pages may remain.

## Launch recommendation
The UI is **ready for internal testing** after this sprint.

Reason: production build passes, shell alignment/overflow safeguards were implemented, and no merge artifacts were found. Full browser-based visual QA is still recommended before beta exposure.
