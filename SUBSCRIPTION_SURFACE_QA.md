# Subscription Surface QA

## Scope completed

- Created dedicated authenticated customer route: `/minha-assinatura`
- Added visible navigation entry in the sidebar: `Minha Assinatura`
- Enabled collapsed-sidebar access through the existing icon/title behavior
- Reused subscription helpers from `src/services/subscriptions.js`
- Reused the shared summary surface from `src/components/subscription/SubscriptionSummary.jsx`

## Route created

- Client route added through `src/navigation/routes.js`
- App navigation now resolves `/minha-assinatura` to `minhaAssinatura`
- Internal navigation highlights the active entry and opens the new page

## Navigation entry

- Added `Minha Assinatura` to the visible sidebar configuration
- Added the same entry to secondary account navigation metadata
- Protected the page with the existing `perfil:ver` permission

## Status and CTA review

- `active`: does not show `Regularizar assinatura`
- `trialing`: does not show `Regularizar assinatura`
- `internal_test`: user sees `Acesso de teste ativo`
- `past_due`: shows warning state and `Regularizar assinatura`
- `canceled`: shows blocked state and `Regularizar assinatura`
- `blocked`: shows blocked state and `Regularizar assinatura`
- no subscription: shows `Escolher plano`
- checkout not connected yet: shows `Checkout em preparação`

## Plan display review

- `FUNDADOR`: `R$297/mês`
- `ESSENCIAL`: `R$197/mês`
- `PRO`: `R$397/mês`
- `PREMIUM`: `R$697/mês`
- `ENTERPRISE`: `Sob consulta`

## Tests updated

- CTA behavior for active, internal test, past due, canceled and blocked
- No-subscription state uses `Escolher plano`
- Plan price formatting and billing labels
- Route helper for `/minha-assinatura`
- Sidebar/navigation entry presence
- Page permission mapping

## Remaining issues

- I could not complete a live browser smoke check in this environment because the local dev server did not stay reachable on `127.0.0.1:5173` after background startup attempts.
- Direct deep-link refresh for `/minha-assinatura` assumes the production hosting already serves the SPA entrypoint for custom paths.

## GO / NO-GO

**GO** for Asaas Sandbox integration.

Reasoning:

- The customer-facing subscription area now exists
- Navigation and route exposure are explicit
- CTA behavior is test-covered and aligned with status requirements
- Lint, build and tests pass

## Validation

- `npm.cmd run lint` ✅
- `npm.cmd run build` ✅
- `npm.cmd test -- --runInBand` ✅
