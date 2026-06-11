import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildBillingEventRow,
  buildAsaasEventIdentity,
  mapAsaasEventToSubscriptionStatus,
  upsertBillingEvent,
  validateWebhookToken,
} from '../api/_asaas.js';
import {
  getSandboxCheckoutCopy,
  isSandboxCheckoutAllowed,
  requestAsaasSandboxCheckout,
} from '../src/services/asaasBilling.js';

async function walkFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function createBillingEventsClient() {
  const store = new Map();
  const calls = [];

  return {
    store,
    calls,
    from(table) {
      assert.equal(table, 'billing_events');
      return {
        upsert(payload, options) {
          return {
            select() {
              return {
                async maybeSingle() {
                  calls.push({ payload, options });
                  const key = payload.provider_event_id;
                  const next = { ...(store.get(key) || {}), ...payload };
                  store.set(key, next);
                  return { data: next, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('frontend source does not expose Asaas private env names', async () => {
  const srcRoot = path.resolve('src');
  const files = (await walkFiles(srcRoot)).filter((file) => file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx'));
  const matches = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (content.includes('ASAAS_API_KEY') || content.includes('ASAAS_WEBHOOK_TOKEN')) {
      matches.push(file);
    }
  }

  assert.equal(matches.length, 0);
});

test('webhook token validation accepts the configured token and rejects mismatches', () => {
  const headers = { 'asaas-webhook-token': 'secret-token' };
  assert.equal(validateWebhookToken(headers, 'secret-token'), true);
  assert.equal(validateWebhookToken(headers, 'wrong-token'), false);
  assert.equal(validateWebhookToken({}, 'secret-token'), false);
});

test('Asaas event mapping covers payment states and unknown events safely', () => {
  const received = mapAsaasEventToSubscriptionStatus({ eventName: 'PAYMENT_RECEIVED' });
  const confirmed = mapAsaasEventToSubscriptionStatus({ eventName: 'PAYMENT_CONFIRMED', paymentStatus: 'CONFIRMED' });
  const overdue = mapAsaasEventToSubscriptionStatus({ eventName: 'PAYMENT_OVERDUE', paymentStatus: 'OVERDUE' });
  const failed = mapAsaasEventToSubscriptionStatus({ eventName: 'PAYMENT_FAILED', paymentStatus: 'FAILED' });
  const chargeback = mapAsaasEventToSubscriptionStatus({ eventName: 'PAYMENT_CHARGEBACK_REQUESTED' });
  const unknown = mapAsaasEventToSubscriptionStatus({ eventName: 'SOMETHING_NEW' });

  assert.equal(received.status, 'active');
  assert.equal(confirmed.status, 'active');
  assert.equal(overdue.status, 'past_due');
  assert.equal(failed.status, 'past_due');
  assert.equal(chargeback.status, 'blocked');
  assert.equal(unknown.shouldUpdateSubscription, false);
  assert.equal(unknown.eventStatus, 'ignored');
});

test('billing event storage is idempotent by provider event id', async () => {
  const client = createBillingEventsClient();
  const row = buildBillingEventRow({
    userId: '11111111-1111-1111-1111-111111111111',
    subscriptionRow: { id: 10 },
    eventIdentity: 'evt_123',
    eventName: 'PAYMENT_RECEIVED',
    mapped: { eventStatus: 'processed', shouldUpdateSubscription: true },
    event: { id: 'evt_123', event: 'PAYMENT_RECEIVED' },
    providerCustomerId: 'cus_123',
    providerSubscriptionId: 'sub_123',
    providerPaymentId: 'pay_123',
  });

  await upsertBillingEvent(client, row);
  await upsertBillingEvent(client, row);

  assert.equal(client.store.size, 1);
  assert.equal(client.calls.length, 2);
  assert.equal(client.calls[0].options.onConflict, 'provider_event_id');
  assert.equal(client.calls[1].options.onConflict, 'provider_event_id');
});

test('unknown webhook events are stored safely and ignored by the mapper', async () => {
  const client = createBillingEventsClient();
  const mapped = mapAsaasEventToSubscriptionStatus({ eventName: 'SOMETHING_NEW' });
  const row = buildBillingEventRow({
    userId: '11111111-1111-1111-1111-111111111111',
    subscriptionRow: { id: 10 },
    eventIdentity: 'evt_unknown',
    eventName: 'SOMETHING_NEW',
    mapped,
    event: { id: 'evt_unknown', event: 'SOMETHING_NEW' },
    providerCustomerId: 'cus_123',
    providerSubscriptionId: 'sub_123',
    providerPaymentId: 'pay_123',
  });

  await upsertBillingEvent(client, row);

  assert.equal(client.store.size, 1);
  assert.equal(client.store.get('evt_unknown').event_status, 'ignored');
});

test('checkout helper only allows sandbox checkout for eligible states', async () => {
  assert.equal(isSandboxCheckoutAllowed(null), true);
  assert.equal(isSandboxCheckoutAllowed({ plan_code: 'pro', status: 'active' }), false);
  assert.equal(isSandboxCheckoutAllowed({ plan_code: 'pro', status: 'trialing' }), false);
  assert.equal(isSandboxCheckoutAllowed({ plan_code: 'pro', status: 'internal_test' }), false);
  assert.equal(isSandboxCheckoutAllowed({ plan_code: 'pro', status: 'past_due' }), true);
  assert.equal(getSandboxCheckoutCopy(null).label, 'Escolher plano');
  assert.equal(getSandboxCheckoutCopy({ plan_code: 'pro', status: 'past_due' }).label, 'Regularizar assinatura');
});

test('frontend checkout request uses the server route and Authorization header', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        checkoutUrl: 'https://sandbox.example/checkout',
        message: 'Checkout preparado.',
      }),
    };
  };

  try {
    const result = await requestAsaasSandboxCheckout({
      session: { access_token: 'jwt.token.value' },
      planCode: 'pro',
      customer: { name: 'Cliente Teste', email: 'cliente@teste.com' },
    });

    assert.equal(result.ok, true);
    assert.equal(calls[0].url, '/api/asaas-create-subscription');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer jwt.token.value');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.planCode, 'pro');
    assert.equal(body.customer.name, 'Cliente Teste');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('event identity remains stable for repeated webhook deliveries', () => {
  const event = {
    id: 'evt_123',
    event: 'PAYMENT_RECEIVED',
    payment: { id: 'pay_123' },
    subscription: { id: 'sub_123' },
    customer: { id: 'cus_123' },
    dateCreated: '2026-06-11T12:00:00.000Z',
  };

  assert.equal(buildAsaasEventIdentity(event), buildAsaasEventIdentity(event));
});
