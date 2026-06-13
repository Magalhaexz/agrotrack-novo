/* global process */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildBillingEventRow,
  buildAsaasEventIdentity,
  findRecentCheckoutSession,
  mapAsaasEventToSubscriptionStatus,
  getAsaasServerEnvStatus,
  upsertBillingEvent,
  validateWebhookToken,
  handleCreateSubscriptionRequest,
} from '../api/_asaas.js';
import createSubscriptionHandler from '../api/asaas-create-subscription.js';
import {
  getMissingAsaasCustomerFields,
  getSandboxCheckoutCopy,
  isSandboxCheckoutAllowed,
  resolveAsaasPaymentUrl,
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

function createCheckoutSessionsClient(rows) {
  return {
    from(table) {
      assert.equal(table, 'checkout_sessions');
      const state = {
        ownerUserId: null,
        planCode: null,
        providerReference: null,
        statuses: null,
      };

      return {
        select() {
          return this;
        },
        eq(column, value) {
          if (column === 'owner_user_id') state.ownerUserId = value;
          if (column === 'plan_code') state.planCode = value;
          if (column === 'provider_reference') state.providerReference = value;
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        in(column, values) {
          if (column === 'status') state.statuses = values;
          return this;
        },
        then(resolve) {
          const data = rows.filter((row) => {
            const ownerMatch = !state.ownerUserId || row.owner_user_id === state.ownerUserId;
            const planMatch = !state.planCode || row.plan_code === state.planCode;
            const providerMatch = !state.providerReference || row.provider_reference === state.providerReference;
            const statusMatch = !state.statuses || state.statuses.includes(row.status);
            return ownerMatch && planMatch && providerMatch && statusMatch;
          });
          resolve({ data, error: null });
        },
      };
    },
  };
}

function createMockResponse() {
  return {
    statusCode: null,
    headers: {},
    ended: false,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
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
  const officialHeaders = { 'asaas-access-token': 'secret-token' };
  const legacyHeaders = { 'asaas-webhook-token': 'secret-token' };

  assert.equal(validateWebhookToken(officialHeaders, 'secret-token'), true);
  assert.equal(validateWebhookToken(officialHeaders, 'wrong-token'), false);
  assert.equal(validateWebhookToken(legacyHeaders, 'secret-token'), true);
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

test('missing customer data is detected before checkout', () => {
  const missing = getMissingAsaasCustomerFields({
    name: 'Cliente Teste',
    email: 'cliente@teste.com',
  });

  assert.deepEqual(missing, ['cpfCnpj', 'mobilePhone']);
});

test('provider payment url resolution prefers the best available redirect target', () => {
  const url = resolveAsaasPaymentUrl({
    paymentLink: { url: 'https://sandbox.example/payment-link' },
    invoiceUrl: 'https://sandbox.example/invoice',
    checkoutUrl: 'https://sandbox.example/checkout',
  });

  assert.equal(url, 'https://sandbox.example/checkout');
});

test('provider payment url resolution falls back to invoice and payment link targets', () => {
  const invoiceUrl = resolveAsaasPaymentUrl({
    invoiceUrl: 'https://sandbox.example/invoice',
  });
  const paymentLinkUrl = resolveAsaasPaymentUrl({
    paymentLink: { url: 'https://sandbox.example/payment-link' },
  });
  const directUrl = resolveAsaasPaymentUrl({
    url: 'https://sandbox.example/direct',
  });

  assert.equal(invoiceUrl, 'https://sandbox.example/invoice');
  assert.equal(paymentLinkUrl, 'https://sandbox.example/payment-link');
  assert.equal(directUrl, 'https://sandbox.example/direct');
});

test('recent pending checkout sessions can be reused for the same plan', async () => {
  const client = createCheckoutSessionsClient([
    {
      id: 10,
      owner_user_id: '11111111-1111-1111-1111-111111111111',
      plan_code: 'pro',
      status: 'pending',
      provider_reference: 'herdon:11111111-1111-1111-1111-111111111111:pro',
      checkout_url: 'https://sandbox.example/checkout',
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);

  const result = await findRecentCheckoutSession(client, {
    ownerUserId: '11111111-1111-1111-1111-111111111111',
    planCode: 'pro',
    providerReference: 'herdon:11111111-1111-1111-1111-111111111111:pro',
  });

  assert.equal(result?.checkout_url, 'https://sandbox.example/checkout');
});

test('recent pending checkout sessions without a usable url are ignored', async () => {
  const client = createCheckoutSessionsClient([
    {
      id: 11,
      owner_user_id: '11111111-1111-1111-1111-111111111111',
      plan_code: 'pro',
      status: 'pending',
      provider_reference: 'herdon:11111111-1111-1111-1111-111111111111:pro',
      checkout_url: null,
      payment_url: null,
      invoice_url: null,
      bank_slip_url: null,
      transaction_receipt_url: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);

  const result = await findRecentCheckoutSession(client, {
    ownerUserId: '11111111-1111-1111-1111-111111111111',
    planCode: 'pro',
    providerReference: 'herdon:11111111-1111-1111-1111-111111111111:pro',
  });

  assert.equal(result, null);
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
        paymentUrl: 'https://sandbox.example/checkout',
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
    assert.equal(result.paymentUrl, 'https://sandbox.example/checkout');
    assert.equal(calls[0].url, '/api/asaas-create-subscription');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer jwt.token.value');
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.planCode, 'pro');
    assert.equal(body.customer.name, 'Cliente Teste');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('server rejects GET with 405 for checkout route', async () => {
  const response = createMockResponse();

  await createSubscriptionHandler({ method: 'GET' }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.message, 'Metodo nao permitido.');
});

test('Asaas env status accepts the ASAAS_BASE_URL alias', () => {
  const originalAsaasBaseUrl = process.env.ASAAS_API_BASE_URL;
  const originalAsaasBaseUrlAlias = process.env.ASAAS_BASE_URL;
  const originalAsaasApiKey = process.env.ASAAS_API_KEY;

  delete process.env.ASAAS_API_BASE_URL;
  process.env.ASAAS_BASE_URL = 'https://sandbox.asaas.com/api/v3';
  process.env.ASAAS_API_KEY = 'sandbox-key';

  try {
    const status = getAsaasServerEnvStatus();
    assert.equal(status.configured, true);
    assert.equal(status.apiBaseUrlPresent, true);
    assert.equal(status.apiBaseUrlAliasPresent, true);
  } finally {
    process.env.ASAAS_API_BASE_URL = originalAsaasBaseUrl;
    process.env.ASAAS_BASE_URL = originalAsaasBaseUrlAlias;
    process.env.ASAAS_API_KEY = originalAsaasApiKey;
  }
});

test('server accepts POST for checkout route', async () => {
  const originalFetch = globalThis.fetch;
  const originalAsaasBaseUrl = process.env.ASAAS_API_BASE_URL;
  const originalAsaasApiKey = process.env.ASAAS_API_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.ASAAS_API_BASE_URL = 'https://sandbox.asaas.com/api/v3';
  process.env.ASAAS_API_KEY = 'sandbox-key';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  globalThis.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('/auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({ id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', user_metadata: {} }),
      };
    }
    if (target.includes('/paymentLinks')) {
      return {
        ok: true,
        json: async () => ({
          id: 'paylink_123',
          url: 'https://sandbox.example/payment-link',
          paymentLink: { id: 'paylink_123', url: 'https://sandbox.example/payment-link' },
          status: 'pending',
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({}),
    };
  };

  const client = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: { id: '11111111-1111-1111-1111-111111111111', owner_user_id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', nome: 'Cliente Teste' }, error: null }),
        };
      }
      if (table === 'checkout_sessions') {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          in() { return this; },
          upsert(payload) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 1, ...payload }, error: null }),
                };
              },
            };
          },
          insert(payload) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 1, ...payload }, error: null }),
                };
              },
            };
          },
        };
      }
      if (table === 'customer_subscriptions' || table === 'billing_events') {
        return {
          upsert(payload) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 1, ...payload }, error: null }),
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer jwt.token.value' },
    body: {
      planCode: 'pro',
      customer: { name: 'Cliente Teste', email: 'cliente@teste.com', cpfCnpj: '12345678901', mobilePhone: '11999999999' },
    },
  };

  try {
    const result = await handleCreateSubscriptionRequest(req, { client });
    assert.equal(result.status, 200);
    assert.equal(result.payload.ok, true);
    assert.equal(result.payload.paymentUrl, 'https://sandbox.example/payment-link');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.ASAAS_API_BASE_URL = originalAsaasBaseUrl;
    process.env.ASAAS_API_KEY = originalAsaasApiKey;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRole;
  }
});

test('server returns structured failure when Asaas provider rejects the request', async () => {
  const originalFetch = globalThis.fetch;
  const originalAsaasBaseUrl = process.env.ASAAS_API_BASE_URL;
  const originalAsaasApiKey = process.env.ASAAS_API_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.ASAAS_API_BASE_URL = 'https://sandbox.asaas.com/api/v3';
  process.env.ASAAS_API_KEY = 'sandbox-key';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  globalThis.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('/auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({ id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', user_metadata: {} }),
      };
    }
    if (target.includes('/customers')) {
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          message: 'Provider offline',
          code: 'SERVICE_UNAVAILABLE',
          errors: [{ code: 'service_unavailable', description: 'Provider offline' }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({}),
    };
  };

  const client = {
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: { id: '11111111-1111-1111-1111-111111111111', owner_user_id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', nome: 'Cliente Teste' }, error: null }),
        };
      }
      if (table === 'checkout_sessions' || table === 'customer_subscriptions' || table === 'billing_events') {
        return {
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          limit() { return this; },
          in() { return this; },
          upsert(payload) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 1, ...payload }, error: null }),
                };
              },
            };
          },
          insert(payload) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({ data: { id: 1, ...payload }, error: null }),
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer jwt.token.value' },
    body: {
      planCode: 'pro',
      customer: { name: 'Cliente Teste', email: 'cliente@teste.com', cpfCnpj: '12345678901', mobilePhone: '11999999999' },
    },
  };

  try {
    const result = await handleCreateSubscriptionRequest(req, { client });
    assert.equal(result.status, 502);
    assert.equal(result.payload.ok, false);
    assert.equal(result.payload.code, 'ASAAS_SUBSCRIPTION_FAILED');
    assert.equal(result.payload.message, 'Não foi possível criar a assinatura no Asaas. Tente novamente em alguns instantes.');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.ASAAS_API_BASE_URL = originalAsaasBaseUrl;
    process.env.ASAAS_API_KEY = originalAsaasApiKey;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRole;
  }
});

test('server rejects incomplete subscription payload with 400', async () => {
  const originalFetch = globalThis.fetch;
  const originalAsaasBaseUrl = process.env.ASAAS_API_BASE_URL;
  const originalAsaasApiKey = process.env.ASAAS_API_KEY;
  const originalSupabaseUrl = process.env.SUPABASE_URL;
  const originalSupabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.ASAAS_API_BASE_URL = 'https://sandbox.asaas.com/api/v3';
  process.env.ASAAS_API_KEY = 'sandbox-key';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

  globalThis.fetch = async (url) => {
    const target = String(url || '');
    if (target.includes('/auth/v1/user')) {
      return {
        ok: true,
        json: async () => ({ id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', user_metadata: {} }),
      };
    }
    return {
      ok: true,
      json: async () => ({}),
    };
  };

  const result = await handleCreateSubscriptionRequest({
    method: 'POST',
    headers: { authorization: 'Bearer jwt.token.value' },
    body: {},
  }, {
    client: {
      from(table) {
        if (table === 'profiles') {
          return {
            select() { return this; },
            eq() { return this; },
            maybeSingle: async () => ({ data: { id: '11111111-1111-1111-1111-111111111111', owner_user_id: '11111111-1111-1111-1111-111111111111', email: 'cliente@teste.com', nome: 'Cliente Teste' }, error: null }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    },
  });

  try {
    assert.equal(result.status, 400);
    assert.equal(result.payload.ok, false);
    assert.equal(result.payload.code, 'INVALID_SUBSCRIPTION_PAYLOAD');
  } finally {
    globalThis.fetch = originalFetch;
    process.env.ASAAS_API_BASE_URL = originalAsaasBaseUrl;
    process.env.ASAAS_API_KEY = originalAsaasApiKey;
    process.env.SUPABASE_URL = originalSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseServiceRole;
  }
});

test('OPTIONS does not create checkout and responds safely', async () => {
  const response = createMockResponse();

  await createSubscriptionHandler({ method: 'OPTIONS' }, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
});

test('paymentLinks response with top-level url is treated as a browser payment url', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      url: 'https://sandbox.example/payment-link',
      paymentLink: { id: 'plink_123' },
      message: 'Checkout preparado.',
    }),
  });

  try {
    const result = await requestAsaasSandboxCheckout({
      session: { access_token: 'jwt.token.value' },
      planCode: 'pro',
      customer: { name: 'Cliente Teste', email: 'cliente@teste.com' },
    });

    assert.equal(result.ok, true);
    assert.equal(result.paymentUrl, 'https://sandbox.example/payment-link');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('frontend checkout request reports a friendly failure when the provider does not return a url', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        ok: false,
        code: 'CHECKOUT_URL_MISSING',
        message: 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes ou fale com o suporte.',
      }),
    });

  try {
    const result = await requestAsaasSandboxCheckout({
      session: { access_token: 'jwt.token.value' },
      planCode: 'pro',
      customer: { name: 'Cliente Teste', email: 'cliente@teste.com' },
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, 'CHECKOUT_URL_MISSING');
    assert.equal(result.message, 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes ou fale com o suporte.');
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

test('webhook token still validates the official header', () => {
  const headers = { 'asaas-access-token': 'secret-token' };
  assert.equal(validateWebhookToken(headers, 'secret-token'), true);
  assert.equal(validateWebhookToken({}, 'secret-token'), false);
});
