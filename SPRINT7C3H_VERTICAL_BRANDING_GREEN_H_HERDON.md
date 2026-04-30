# SPRINT7C3H_VERTICAL_BRANDING_GREEN_H_HERDON

## Executive summary
Sprint 7C.3H refines sidebar branding to a vertical premium composition (logo above, HERDON text below) and applies a green accent only to the letter "H" while preserving all functionality.

## Files changed
- `src/components/Sidebar.jsx`
- `src/styles/app.css`
- `SPRINT7C3H_VERTICAL_BRANDING_GREEN_H_HERDON.md`

## Branding update details
- Updated the branding text markup to split `HERDON` into stylable parts:
  - `H`
  - `ERDON`
- Converted sidebar branding layout to vertical hierarchy:
  - logo block on top
  - brand text below
- Kept branding centered and balanced with refined spacing.
- No subtitle text added.
- No frame/card background reintroduced behind branding.

## Color treatment
- `H` uses `var(--color-primary)` to match the logo green family.
- `ERDON` remains in light tone for contrast.

## Validation
Requested commands:
- `npm.cmd run build` → failed in Linux environment (`npm.cmd: command not found`).
- `npm.cmd run lint` → failed in Linux environment (`npm.cmd: command not found`).

Fallback executed:
- `npm run build` → PASS.
- `npm run lint` → PASS with pre-existing warnings (no errors).

Manual checklist outcome:
- Logo appears above text in sidebar branding.
- Text appears below logo.
- Only `H` is green.
- `H` green matches logo green family.
- `ERDON` remains light/white.
- Branding remains centered and premium.
- No modules/tabs/subtabs removed.

## Preservation confirmation
No functionality, modules, tabs, subtabs, navigation, business logic, or visible app data were removed or changed.
