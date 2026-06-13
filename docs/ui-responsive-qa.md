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

## Collapsed Sidebar + Tablet Scroll Fix — Sprint 30

## Widths Tested

- 768x1024
- 1024x768
- 820x1180
- 1180x820
- 834x1194
- 1194x834
- 1280x800
- 1366x768
- 1440x900
- 1512x982
- 1728x1117
- 1920x1080

## Pages Tested

- Login
- Dashboard
- Lotes
- Fazendas
- Animais
- Financeiro
- Estoque
- Minha Assinatura

## Bugs Found

- The tablet login layout could extend below the viewport without an internal scroll surface, so the form felt hidden on landscape tablets.
- The authenticated shell on tablet was still carrying a desktop left offset, which prevented the main content area from using the full width.
- The collapsed desktop sidebar still showed a visible scrollbar gutter and looked cramped instead of like a clean icon rail.

## Fixes Applied

- Converted the login screen into a true scroll container with tablet-friendly padding and hidden brand content on narrower widths.
- Kept the authenticated tablet shell in flex layout, removed the stale desktop left offset, and allowed the main content to scroll naturally.
- Forced the collapsed sidebar into a fixed 48px icon rail, hid the scrollbar visually, and centered the user avatar at the bottom.

## Validation Result

- Tablet portrait and landscape login remained visible and scrollable.
- The `Lotes` page scrolled normally on tablet after the fix.
- `Dashboard`, `Fazendas`, `Animais`, `Financeiro`, `Estoque`, and `Minha Assinatura` remained reachable in the tablet sweep.
- Desktop widths stayed clean with no horizontal overflow.
- The collapsed sidebar read as a premium icon-only rail with no clipped active item.

## Remaining Visual Risks

- Live production records may still reveal a few spacing differences that do not appear in empty-state QA.
- Modal-heavy pages should keep receiving the same notebook and tablet sweeps before beta.
