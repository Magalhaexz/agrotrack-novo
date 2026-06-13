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
# Use ASAAS_API_BASE_URL or ASAAS_BASE_URL (alias) for the provider API host.
ASAAS_API_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=YOUR_PRIVATE_SANDBOX_KEY
ASAAS_WEBHOOK_TOKEN=YOUR_PRIVATE_WEBHOOK_TOKEN
VITE_APP_URL=http://localhost:5173
VITE_CHECKOUT_URL=http://localhost:5173/minha-assinatura
```

Important:

- `ASAAS_API_KEY` must never be exposed to the frontend.
- `ASAAS_WEBHOOK_TOKEN` is only used on the server route that receives webhook calls.
- The server accepts `ASAAS_API_BASE_URL` and `ASAAS_BASE_URL` as aliases for the Asaas host.
- The customer UI uses the app route, not the provider secret.
- In the Asaas webhook panel, the "Token de autenticação" must use the same value as `ASAAS_WEBHOOK_TOKEN`.
- Asaas sends that value in the `asaas-access-token` header.
- The webhook URL for Vercel is `/api/asaas-webhook`.

## Flow overview

1. The customer opens `/minha-assinatura`.
2. The page shows the current plan, usage, and the commercial CTA.
3. If customer data is incomplete, HERDON opens a clean Portuguese form for:
   - Nome completo
   - E-mail
   - CPF/CNPJ
   - Telefone/WhatsApp
4. When checkout starts, the frontend calls `POST /api/asaas-create-subscription`.
5. The server creates or reuses the Asaas customer and then creates a recurring hosted payment link in the sandbox.
6. HERDON persists the checkout session and provider references, including the hosted payment link id when available.
7. If Asaas returns a usable URL, HERDON redirects the customer to the hosted payment URL returned by the provider.
8. Webhook calls are received by `POST /api/asaas-webhook`.
9. Webhook events are mapped to `customer_subscriptions` and stored in `billing_events` with idempotency.

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
Asaas sends the configured token in the `asaas-access-token` header.
The webhook URL for Vercel is `/api/asaas-webhook`.

## Idempotency

- Billing events are stored with a unique `provider_event_id`.
- Repeated webhook deliveries do not create duplicate billing history rows.
- Provider-linked subscription rows are preferred over local internal-test placeholders.
- Recent pending checkout sessions are reused for the same user and plan so repeated clicks do not create duplicate charges.
- The checkout flow stores a stable `provider_reference` / `external_reference` pair for reuse.

## Redirect targets

When Asaas returns a response, HERDON looks for the best usable browser target in this order:

1. `checkoutUrl`
2. `paymentUrl`
3. `invoiceUrl`
4. `bankSlipUrl`
5. `transactionReceiptUrl`
6. `paymentLink.url`
7. top-level `url`
8. nested payment or invoice URLs returned by the provider

The customer is redirected to the first usable URL found.

If browser navigation does not happen automatically, the page shows a button labeled `Abrir pagamento`.

## Recommended test flow

1. Start the app in sandbox mode.
2. Open `/minha-assinatura`.
3. Confirm the page shows the plan cards and current subscription summary.
4. Test a checkout from a user with no subscription.
5. Confirm the customer data form appears when required data is missing.
6. Confirm the app redirects to the payment URL after the provider responds successfully.
7. Click the same plan again while the checkout is still recent and confirm HERDON reuses the pending checkout instead of creating a new charge.
8. Send a test webhook to `/api/asaas-webhook`.
9. Confirm the subscription status and billing history update correctly.

## Chosen hosted payment approach

HERDON now uses the Asaas hosted payment link flow for sandbox checkout because it reliably returns a browser-ready URL.

- Endpoint: `POST /v3/paymentLinks`
- Recurring charge type: `RECURRENT`
- Recurrence: `MONTHLY`
- The URL returned by Asaas is stored and used for redirect/open behavior.
- If a recent pending checkout already exists for the same user and plan, HERDON reuses it instead of creating another provider record.
- If the provider response does not include a usable URL, HERDON shows a clear Portuguese error and does not claim success.

## Notes

- This integration is sandbox-only.
- Production billing should be enabled later with separate environment review.
- The user interface stays in Portuguese.
