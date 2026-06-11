# HERDON Asaas Sandbox QA

## What was reviewed

- Customer-facing route: `/minha-assinatura`
- Sidebar navigation entry: `Minha Assinatura`
- Status and CTA behavior for:
  - `active`
  - `trialing`
  - `internal_test`
  - `past_due`
  - `canceled`
  - `blocked`
  - no subscription
- Server-side checkout creation
- Server-side webhook handling
- Webhook idempotency
- Frontend secret exposure

## QA checklist

- The page is accessible to authenticated users.
- The page shows plan name, status, price, billing period, and current usage.
- The page does not show `Regularizar assinatura` for `active`, `trialing`, or `internal_test`.
- The page shows `Regularizar assinatura` for `past_due`, `canceled`, and `blocked`.
- The page shows `Escolher plano` when no subscription exists.
- Checkout creation uses the server route only.
- The frontend does not contain the private Asaas API key or webhook token.
- Webhook events are stored once per unique provider event.
- Unknown webhook events are stored safely.
- Provider-linked subscriptions are preferred over internal test placeholders.

## Validation results

- Lint: pass
- Build: pass
- Tests: pass

## Remaining issues

- Sandbox checkout still depends on a valid Asaas sandbox key and webhook token being configured in the server environment.
- Production checkout is intentionally not enabled yet.

## GO / NO-GO

- GO for Asaas Sandbox integration review.
- NO-GO for production billing until the production key, webhook, and checkout rollout are explicitly configured.
