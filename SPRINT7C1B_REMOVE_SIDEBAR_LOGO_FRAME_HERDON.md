# SPRINT7C1B_REMOVE_SIDEBAR_LOGO_FRAME_HERDON

## Summary
Micro Sprint 7C.1B applies a visual-only refinement to remove the visible logo frame/moldura in the sidebar while preserving logo visibility and navigation behavior.

## Component/classes changed
- `.sidebar .sidebar-logo-mark`
- `.sidebar-logo .sidebar-logo-mark`
- `.sidebar .shell-logo-mark.sidebar-logo-mark`
- Pseudo-elements for the classes above (`::before`, `::after`)
- `.sidebar .sidebar-logo-mark .shell-logo-image`

## Files changed
- `src/styles/app.css`
- `SPRINT7C1B_REMOVE_SIDEBAR_LOGO_FRAME_HERDON.md`

## Validation
Requested commands:
- `npm.cmd run build` → failed in Linux environment (`npm.cmd: command not found`).
- `npm.cmd run lint` → failed in Linux environment (`npm.cmd: command not found`).

Fallback executed:
- `npm run build` → PASS.
- `npm run lint` → PASS with pre-existing warnings (no new lint errors).

Manual checklist outcome:
- Sidebar logo remains visible.
- Moldura/frame effect removed from sidebar logo area.
- Sidebar navigation remains intact.
- No modules/tabs/subtabs removed.

## Preservation confirmation
No functionality, module, tab, subtab, route, business logic, or navigation behavior was removed/changed.
