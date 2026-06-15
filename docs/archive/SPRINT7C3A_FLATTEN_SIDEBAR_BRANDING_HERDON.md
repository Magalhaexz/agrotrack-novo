# SPRINT7C3A_FLATTEN_SIDEBAR_BRANDING_HERDON

## Executive summary
Sprint 7C.3A refines sidebar branding to sit directly on the true-black sidebar surface, removes residual box/card treatments, and enlarges both logo and HERDON text for stronger premium branding presence.

## Files changed
- `src/styles/app.css`
- `SPRINT7C3A_FLATTEN_SIDEBAR_BRANDING_HERDON.md`

## Branding selectors/components changed
- `.sidebar-logo`
- `.sidebar-logo-content`
- `.sidebar .sidebar-logo-mark`
- `.sidebar-logo .sidebar-logo-mark`
- `.sidebar .shell-logo-mark.sidebar-logo-mark`
- `.sidebar .sidebar-logo-copy`
- `.sidebar .sidebar-logo-text`
- `.sidebar .sidebar-logo-sub`
- `.sidebar .sidebar-logo-caption`
- `.sidebar .sidebar-brand-badge`

## What was removed visually
- Removed visible gray/dark card/background treatment from sidebar branding container.
- Removed border/shadow/box chrome around logo/name block.
- Kept only logo + HERDON as visible branding essentials.
- Kept subtitle/caption/badge hidden in sidebar branding.

## Visual adjustments applied
- Enlarged logo container to `64x64`.
- Enlarged HERDON text to `1.18rem` with stronger letter-spacing.
- Refined spacing/alignment (`grid-template-columns: 64px + text`, gap `12px`) for premium composition.

## Validation
Requested commands:
- `npm.cmd run build` → failed in Linux environment (`npm.cmd: command not found`).
- `npm.cmd run lint` → failed in Linux environment (`npm.cmd: command not found`).

Fallback executed:
- `npm run build` → PASS.
- `npm run lint` → PASS with pre-existing warnings (no new lint errors).

Manual checklist outcome:
- Sidebar branding no longer appears inside a gray/dark card box.
- Only logo + HERDON remain visible in sidebar branding.
- Logo appears larger.
- HERDON text appears larger.
- Dashboard/Lotes/Animais/Pesagem/Sanitário/Suplementação/Estoque/Financeiro/Tarefas/Relatórios remain visible and accessible.

## Preservation confirmation
No functionality, modules, tabs, subtabs, routes, navigation behavior, buttons/actions, or business logic were removed/changed.
