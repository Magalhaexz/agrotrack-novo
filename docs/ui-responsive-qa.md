# HERDON Responsive Visual QA

Date: 2026-06-13

## Scope

- Responsive shell validation after the layout standardization pass
- Dense module visual sanity check
- Sidebar, topbar, dashboard, Fazendas modal, Financeiro, and Minha Assinatura

## Widths Tested

- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

## Pages Tested

- Dashboard
- Fazendas modal
- Financeiro
- Minha Assinatura

## Sidebar Result

- `Cadastros` rendered correctly in expanded mode.
- Icons stayed visible and aligned in expanded and collapsed modes.
- The compact sidebar kept a clear active state and did not collapse into an empty column.
- Scroll content remained contained; no clipping was observed in the tested widths.
- The user card and avatar remained anchored at the bottom of the sidebar.

## Visual Findings

- No horizontal overflow was observed at any tested width.
- No clipped icons were observed in the sidebar, topbar, or modal actions.
- The dashboard kept a stable notebook-to-desktop rhythm.
- The Fazenda modal maintained enough internal clearance for the footer and form sections.
- `Minha Assinatura` kept a balanced two-column layout on notebook and desktop widths.

## Bugs Found

- No new product UI regressions were found during the width sweep.
- The only QA-only issue was that live Supabase hydration would hold the app on a loading screen in this environment, so the browser pass used the documented offline-disabled data path to reach the authenticated shell.

## Fixes Applied

- Confirmed the responsive shell standardization already in the branch.
- Confirmed the lighter modal spacing and form rhythm on the Fazendas flow.
- Confirmed the dense card rhythm on the dashboard and Minha Assinatura pages.
- Used the documented offline-disabled QA path to complete authenticated visual inspection without changing product behavior.

## Remaining Visual Risks

- Live data-heavy states still need a real backend smoke pass.
- Some dense modules were checked through their empty or fallback states in this environment, so content-rich production records may still reveal micro-spacing issues.
- The historical CSS surface is large, so future regressions should keep using browser QA at the notebook widths listed above.

## Sidebar Icons + Centered Cadastro Layout — Sprint 29

## Widths Tested

- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

## Pages Tested

- Dashboard
- Fazendas modal
- Fazendas page

## Bugs Found

- Collapsed sidebar nav icons were partially crowded by the scrollbar gutter on notebook widths.
- The compact icon rail could read as visually compressed instead of intentional.
- The Fazenda cadastro modal sat too far to the right in the expanded shell because the overlay was centering against the full viewport instead of the content area.

## Fixes Applied

- Added stable scrollbar gutter spacing to the sidebar content and navigation.
- Centered collapsed sidebar items and disabled the hover shift that was nudging icons toward the scrollbar.
- Aligned the user card and avatar in the compact rail so the footer stayed intentional.
- Offset the modal overlay and width calculations by the sidebar width so the Fazenda cadastro form recenters inside the content area.

## Validation Result

- No horizontal overflow was observed in the tested dashboard states.
- Sidebar icons remained fully visible in both expanded and collapsed states.
- The `Cadastros` section stayed readable and the compact rail kept a clean active state.
- The Fazenda modal was centered within the available content area in both expanded and collapsed sidebar states.

## Remaining Visual Risks

- The shell still depends on the broader historical CSS surface, so future page-specific regressions should keep using the same notebook-width sweep.
- Live data-heavy pages can still shift slightly once real records are present, so production-like QA remains important before beta.
