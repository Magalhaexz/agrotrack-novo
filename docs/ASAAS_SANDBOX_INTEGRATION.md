# HERDON Asaas Sandbox Integration

This document describes the customer-facing sandbox billing flow added for commercial review before production billing is enabled.

## Scope

- Customer-facing route: `/minha-assinatura`
- Server-side Asaas routes:
  - `POST /api/asaas-create-customer`
  - `POST /api/asaas-create-subscription`
  - `POST /api/asaas-webhook`
- Storage tables used:
  - `customer_subscriptions`
  - `billing_events`
  - `checkout_sessions`

## Environment variables

Use server-side variables for the Asaas integration:

```env
ASAAS_ENV=sandbox
ASAAS_API_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=YOUR_PRIVATE_SANDBOX_KEY
ASAAS_WEBHOOK_TOKEN=YOUR_PRIVATE_WEBHOOK_TOKEN
VITE_APP_URL=http://localhost:5173
VITE_CHECKOUT_URL=http://localhost:5173/minha-assinatura
```

Important:

- `ASAAS_API_KEY` must never be exposed to the frontend.
- `ASAAS_WEBHOOK_TOKEN` is only used on the server route that receives webhook calls.
- The customer UI uses the app route, not the provider secret.
- In the Asaas webhook panel, the "Token de autenticação" must use the same value as `ASAAS_WEBHOOK_TOKEN`.
- Asaas sends that value in the `asaas-access-token` header.
- The webhook URL for Vercel is `/api/asaas-webhook`.

## Flow overview

1. The customer opens `/minha-assinatura`.
2. The page shows the current plan, usage, and the commercial CTA.
3. When checkout is allowed, the frontend calls `POST /api/asaas-create-subscription`.
4. The server creates or reuses the Asaas customer and then creates the subscription in the sandbox.
5. If Asaas returns a checkout URL, the customer is redirected.
6. Webhook calls are received by `POST /api/asaas-webhook`.
7. Webhook events are mapped to `customer_subscriptions` and stored in `billing_events` with idempotency.

## Status and CTA rules

- `active`, `trialing`, and `internal_test`
  - do not show `Regularizar assinatura`
  - show `Gerenciar assinatura` or `Ver planos`
- `past_due`
  - show `Regularizar assinatura`
- `canceled` and `blocked`
  - show `Regularizar assinatura`
- no subscription
  - show `Escolher plano`
- checkout not configured
  - show a friendly preparation message

## Webhook behavior

Webhook payloads are treated safely:

- `PAYMENT_RECEIVED` and `PAYMENT_CONFIRMED` map to `active`
- `PAYMENT_OVERDUE` and `PAYMENT_FAILED` map to `past_due`
- chargeback-like events map to `blocked`
- canceled-like events map to `canceled`
- unknown events are stored safely and ignored for status changes

Webhook requests are rejected when the token does not match `ASAAS_WEBHOOK_TOKEN`.

## Idempotency

- Billing events are stored with a unique `provider_event_id`.
- Repeated webhook deliveries do not create duplicate billing history rows.
- Provider-linked subscription rows are preferred over local internal-test placeholders.

## Recommended test flow

1. Start the app in sandbox mode.
2. Open `/minha-assinatura`.
3. Confirm the page shows the plan cards and current subscription summary.
4. Test a checkout from a user with no subscription.
5. Confirm the server route returns a checkout URL only after the provider responds successfully.
6. Send a test webhook to `/api/asaas-webhook`.
7. Confirm the subscription status and billing history update correctly.

## Notes

- This integration is sandbox-only.
- Production billing should be enabled later with separate environment review.
- The user interface stays in Portuguese.
