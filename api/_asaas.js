/* global process */
import { getSupabaseAdminClient, resolveAuthenticatedUser } from './_supabaseAdmin.js';
import { getPlanLimits } from '../src/services/subscriptions.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function json(status, payload) {
  return { status, payload };
}

function getRuntimeEnv() {
  const baseUrl = normalizeText(process.env.ASAAS_API_BASE_URL || 'https://sandbox.asaas.com/api/v3');
  const apiKey = normalizeText(process.env.ASAAS_API_KEY);
  const webhookToken = normalizeText(process.env.ASAAS_WEBHOOK_TOKEN);
  const environment = normalizeLower(process.env.ASAAS_ENV || 'sandbox') || 'sandbox';
  return {
    baseUrl,
    apiKey,
    webhookToken,
    environment,
    configured: Boolean(baseUrl && apiKey),
  };
}

export function getAsaasServerEnvStatus() {
  const env = getRuntimeEnv();
  return {
    configured: env.configured,
    apiBaseUrlPresent: Boolean(env.baseUrl),
    apiKeyPresent: Boolean(env.apiKey),
    webhookTokenPresent: Boolean(env.webhookToken),
    environment: env.environment,
  };
}

function buildAsaasHeaders() {
  const env = getRuntimeEnv();
  if (!env.configured) {
    const error = new Error('missing_asaas_env');
    error.code = 'ASAAS_ENV_MISSING';
    throw error;
  }

  return {
    access_token: env.apiKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function asaasRequest(path, { method = 'GET', body = null } = {}) {
  const env = getRuntimeEnv();
  if (!env.configured) {
    const error = new Error('missing_asaas_env');
    error.code = 'ASAAS_ENV_MISSING';
    throw error;
  }

  const response = await fetch(`${env.baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: buildAsaasHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(normalizeText(payload?.message || payload?.errors?.[0]?.description || `asaas_${method.toLowerCase()}_failed`));
    error.code = normalizeText(payload?.errors?.[0]?.code || payload?.code || response.statusText || 'ASAAS_REQUEST_FAILED').toUpperCase();
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  return payload;
}

function extractString(value) {
  return normalizeText(value) || null;
}

function extractProviderUrl(payload = {}) {
  const candidates = [
    payload.checkoutUrl,
    payload.checkout_url,
    payload.hostedCheckoutUrl,
    payload.hosted_checkout_url,
    payload.invoiceUrl,
    payload.invoice_url,
    payload.paymentUrl,
    payload.payment_url,
    payload.url,
  ];

  return candidates.map(extractString).find(Boolean) || null;
}

function getUserProfileSeed(user, profile = null, body = {}) {
  const userMetadata = isObject(user?.user_metadata) ? user.user_metadata : {};
  const rawProfile = isObject(profile) ? profile : {};
  const name = extractString(body.name || body.nome || rawProfile.nome || userMetadata.nome || userMetadata.name || user?.name || user?.email?.split('@')[0]);
  const email = extractString(body.email || rawProfile.email || user?.email || userMetadata.email);
  const cpfCnpj = extractString(body.cpfCnpj || body.cpf_cnpj || rawProfile.cpf_cnpj || rawProfile.cpfCnpj || userMetadata.cpfCnpj || userMetadata.cpf_cnpj);
  const mobilePhone = extractString(body.mobilePhone || body.mobile_phone || rawProfile.mobile_phone || rawProfile.mobilePhone || rawProfile.telefone || userMetadata.mobilePhone || userMetadata.mobile_phone || userMetadata.telefone);

  return { name, email, cpfCnpj, mobilePhone };
}

export function validateWebhookToken(headers = {}, expectedToken = getRuntimeEnv().webhookToken) {
  const token = normalizeText(expectedToken);
  if (!token) return false;

  const candidates = [
    headers['asaas-access-token'],
    headers['Asaas-Access-Token'],
    headers['ASAAS-ACCESS-TOKEN'],
    headers['asaas-webhook-token'],
    headers['ASAAS-WEBHOOK-TOKEN'],
    headers['x-asaas-webhook-token'],
    headers['x-asaas-token'],
    headers['x-webhook-token'],
    headers['access_token'],
    headers.access_token,
    headers.authorization,
    headers.Authorization,
  ].map(normalizeText).filter(Boolean);

  return candidates.some((candidate) => {
    if (candidate === token) return true;
    if (candidate.toLowerCase().startsWith('bearer ')) {
      return candidate.slice(7).trim() === token;
    }
    return false;
  });
}

export function mapAsaasEventToSubscriptionStatus({ eventName = '', paymentStatus = '', subscriptionStatus = '' } = {}) {
  const event = normalizeLower(eventName);
  const payment = normalizeLower(paymentStatus);
  const subscription = normalizeLower(subscriptionStatus);
  const text = `${event} ${payment} ${subscription}`.trim();

  if (!text) {
    return {
      status: null,
      eventStatus: 'ignored',
      shouldUpdateSubscription: false,
      reason: 'unknown_event',
    };
  }

  if (
    text.includes('chargeback')
    || text.includes('dispute')
    || text.includes('fraud')
  ) {
    return {
      status: 'blocked',
      eventStatus: 'processed',
      shouldUpdateSubscription: true,
      reason: 'chargeback_like',
    };
  }

  if (
    text.includes('refund')
    || text.includes('cancel')
    || text.includes('deleted')
    || text.includes('delet')
  ) {
    return {
      status: 'canceled',
      eventStatus: 'processed',
      shouldUpdateSubscription: true,
      reason: 'canceled_like',
    };
  }

  if (
    text.includes('overdue')
    || text.includes('failed')
    || text.includes('refused')
    || text.includes('delinquent')
    || text.includes('unpaid')
    || text.includes('pending')
  ) {
    return {
      status: 'past_due',
      eventStatus: 'processed',
      shouldUpdateSubscription: true,
      reason: 'payment_problem',
    };
  }

  if (
    text.includes('received')
    || text.includes('confirmed')
    || text.includes('paid')
    || text.includes('settled')
    || text.includes('payment_received')
  ) {
    return {
      status: 'active',
      eventStatus: 'processed',
      shouldUpdateSubscription: true,
      reason: 'payment_confirmed',
    };
  }

  if (text.includes('trial')) {
    return {
      status: 'trialing',
      eventStatus: 'processed',
      shouldUpdateSubscription: true,
      reason: 'trial_event',
    };
  }

  return {
    status: null,
    eventStatus: 'ignored',
    shouldUpdateSubscription: false,
    reason: 'unknown_event',
  };
}

export function buildAsaasEventIdentity(event = {}) {
  const eventName = normalizeText(event.event || event.type || event.name || event.eventName);
  const paymentId = normalizeText(event?.payment?.id || event.paymentId || event.provider_payment_id);
  const subscriptionId = normalizeText(event?.subscription?.id || event.subscriptionId || event.provider_subscription_id);
  const customerId = normalizeText(event?.customer?.id || event.customerId || event.provider_customer_id);
  const occurredAt = normalizeText(event.dateCreated || event.occurredAt || event.createdAt || event.eventDate || event.payment?.dateCreated || new Date().toISOString());
  const sourceId = normalizeText(event.id || event.eventId || event.provider_event_id);

  return sourceId || `${eventName}:${paymentId || subscriptionId || customerId || 'unknown'}:${occurredAt}`;
}

export async function upsertBillingEvent(client, row) {
  const payload = {
    ...row,
    raw_payload: isObject(row.raw_payload) ? row.raw_payload : {},
  };

  const { data, error } = await client
    .from('billing_events')
    .upsert(payload, { onConflict: 'provider_event_id' })
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function upsertCheckoutSession(client, row) {
  const payload = {
    ...row,
    raw_payload: isObject(row.raw_payload) ? row.raw_payload : {},
  };

  if (payload.provider_checkout_session_id) {
    const { data, error } = await client
      .from('checkout_sessions')
      .upsert(payload, { onConflict: 'provider_checkout_session_id' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const { data, error } = await client
    .from('checkout_sessions')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function upsertCustomerSubscription(client, row) {
  const payload = {
    ...row,
    raw_payload: isObject(row.raw_payload) ? row.raw_payload : {},
  };

  if (payload.provider_subscription_id) {
    const { data, error } = await client
      .from('customer_subscriptions')
      .upsert(payload, { onConflict: 'provider_subscription_id' })
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  const { data, error } = await client
    .from('customer_subscriptions')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findLinkedSubscription(client, { providerCustomerId = null, providerSubscriptionId = null }) {
  let query = client.from('customer_subscriptions').select('*').order('updated_at', { ascending: false }).limit(5);
  if (providerSubscriptionId) {
    query = query.eq('provider_subscription_id', providerSubscriptionId);
  } else if (providerCustomerId) {
    query = query.eq('provider_customer_id', providerCustomerId);
  } else {
    return null;
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function resolveProfileForUser(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('id, owner_user_id, email, nome, telefone, cargo, perfil, updated_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function resolveOwnerUserIdFromCustomerReference(client, providerCustomerId) {
  const customerId = normalizeText(providerCustomerId);
  if (!customerId) return null;

  try {
    const customer = await asaasRequest(`/customers/${customerId}`, { method: 'GET' });
    const email = extractString(customer?.email);
    if (!email) return null;

    const { data, error } = await client
      .from('profiles')
      .select('id, owner_user_id, email')
      .eq('email', email)
      .maybeSingle();

    if (error || !data?.id) return null;
    return data.id;
  } catch {
    return null;
  }
}

function buildMissingCustomerFieldsMessage(fields = []) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return 'Precisamos conferir alguns dados do seu cadastro antes de continuar.';
  }
  return `Precisamos confirmar ${fields.join(', ')} antes de continuar.`;
}

async function createCustomerOnAsaas({ user, profile, body }) {
  const seed = getUserProfileSeed(user, profile, body.customer || body);
  const missingFields = [];
  if (!seed.name) missingFields.push('nome');
  if (!seed.email) missingFields.push('e-mail');

  if (missingFields.length > 0) {
    const error = new Error(buildMissingCustomerFieldsMessage(missingFields));
    error.code = 'MISSING_CUSTOMER_FIELDS';
    error.status = 422;
    error.details = { missingFields };
    throw error;
  }

  const payload = {
    name: seed.name,
    email: seed.email,
  };

  if (seed.cpfCnpj) payload.cpfCnpj = seed.cpfCnpj;
  if (seed.mobilePhone) payload.mobilePhone = seed.mobilePhone;

  return asaasRequest('/customers', {
    method: 'POST',
    body: payload,
  });
}

async function createMonthlySubscriptionOnAsaas({ customerId, plan, externalReference, body }) {
  const valueCents = Number(plan?.priceCents || 0);
  const value = Number.isFinite(valueCents) ? Number((valueCents / 100).toFixed(2)) : null;
  const nextDueDate = normalizeText(body?.nextDueDate || body?.dueDate || new Date().toISOString().slice(0, 10));
  const payload = {
    customer: customerId,
    billingType: normalizeText(body?.billingType || 'CREDIT_CARD') || 'CREDIT_CARD',
    cycle: 'MONTHLY',
    value,
    nextDueDate,
    description: `HERDON - ${plan?.planName || 'Plano'}`,
    externalReference: externalReference || null,
    notificationDisabled: false,
  };

  if (body?.endDate) payload.endDate = body.endDate;
  if (body?.maxPayments) payload.maxPayments = body.maxPayments;

  return asaasRequest('/subscriptions', {
    method: 'POST',
    body: payload,
  });
}

function buildCustomerSubscriptionPatch({ userId, plan, customer, subscription, body }) {
  const now = new Date().toISOString();
  const status = normalizeLower(subscription?.status || body?.status || 'trialing') || 'trialing';
  const currentPeriodStart = subscription?.currentPeriodStart || subscription?.billingDate || body?.currentPeriodStart || now;
  const currentPeriodEnd = subscription?.nextDueDate || subscription?.dueDate || body?.currentPeriodEnd || null;
  const rawPayload = isObject(subscription) ? subscription : {};

  return {
    owner_user_id: userId,
    user_id: userId,
    plan_code: plan?.planCode || body?.planCode || null,
    plan_name: plan?.planName || null,
    status,
    billing_provider: 'asaas',
    provider_customer_id: normalizeText(customer?.id || body?.providerCustomerId || customer?.providerCustomerId) || null,
    provider_subscription_id: normalizeText(subscription?.id || body?.providerSubscriptionId) || null,
    provider_payment_id: normalizeText(subscription?.payment?.id || body?.providerPaymentId || subscription?.latestInvoice?.payment?.id) || null,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    trial_ends_at: subscription?.trialEndsAt || body?.trialEndsAt || null,
    canceled_at: status === 'canceled' ? now : null,
    blocked_at: status === 'blocked' ? now : null,
    raw_payload: rawPayload,
  };
}

export function buildBillingEventRow({ userId, subscriptionRow, eventIdentity, eventName, mapped, event, providerCustomerId, providerSubscriptionId, providerPaymentId }) {
  return {
    owner_user_id: userId,
    user_id: userId,
    subscription_id: subscriptionRow?.id || null,
    event_type: normalizeText(eventName || 'asaas_event') || 'asaas_event',
    event_status: mapped?.eventStatus || 'received',
    billing_provider: 'asaas',
    provider_event_id: eventIdentity,
    provider_customer_id: providerCustomerId || null,
    provider_subscription_id: providerSubscriptionId || null,
    provider_payment_id: providerPaymentId || null,
    occurred_at: event?.dateCreated || event?.occurredAt || event?.createdAt || new Date().toISOString(),
    processed_at: mapped?.shouldUpdateSubscription ? new Date().toISOString() : null,
    raw_payload: event || {},
  };
}

export async function handleCreateCustomerRequest(req, { client = getSupabaseAdminClient() } = {}) {
  if (req.method !== 'POST') {
    return json(405, { ok: false, message: 'Metodo nao permitido.' });
  }

  const env = getAsaasServerEnvStatus();
  if (!env.configured) {
    return json(500, {
      ok: false,
      message: 'O recurso de assinatura ainda nao esta pronto. Tente novamente em alguns instantes.',
    });
  }

  const user = await resolveAuthenticatedUser(req);
  if (!user?.id) {
    return json(401, {
      ok: false,
      message: 'Sessao expirada. Entre novamente para continuar.',
    });
  }

  const profile = await resolveProfileForUser(client, user.id);
  const body = isObject(req.body) ? req.body : {};

  try {
    const customer = await createCustomerOnAsaas({ user, profile, body });
    return json(200, {
      ok: true,
      customer,
      customerId: customer?.id || null,
      message: 'Cadastro confirmado.',
    });
  } catch (error) {
    const missingFields = Array.isArray(error?.details?.missingFields) ? error.details.missingFields : [];
    if (error?.code === 'MISSING_CUSTOMER_FIELDS') {
      return json(422, {
        ok: false,
        code: 'MISSING_CUSTOMER_FIELDS',
        missingFields,
        message: buildMissingCustomerFieldsMessage(missingFields),
      });
    }

    return json(error?.status || 502, {
      ok: false,
      code: normalizeText(error?.code || 'ASAAS_CUSTOMER_ERROR').toUpperCase(),
      message: 'Nao foi possivel confirmar o cadastro agora. Verifique os dados e tente novamente.',
    });
  }
}

export async function handleCreateSubscriptionRequest(req, { client = getSupabaseAdminClient() } = {}) {
  if (req.method !== 'POST') {
    return json(405, { ok: false, message: 'Metodo nao permitido.' });
  }

  const env = getAsaasServerEnvStatus();
  if (!env.configured) {
    return json(500, {
      ok: false,
      message: 'O recurso de assinatura ainda nao esta pronto. Tente novamente em alguns instantes.',
    });
  }

  const user = await resolveAuthenticatedUser(req);
  if (!user?.id) {
    return json(401, {
      ok: false,
      message: 'Sessao expirada. Entre novamente para continuar.',
    });
  }

  const body = isObject(req.body) ? req.body : {};
  const planCode = normalizeLower(body.planCode || body.plan_code || body.plano || '');
  const selectedPlan = getPlanLimits(planCode);

  if (planCode === 'enterprise') {
    return json(200, {
      ok: true,
      manual: true,
      checkoutUrl: null,
      message: 'Plano sob atendimento. Fale com a equipe para continuar.',
      subscription: null,
      customer: null,
    });
  }

  const availablePlan = selectedPlan || null;
  if (!availablePlan?.planCode) {
    return json(400, {
      ok: false,
      code: 'INVALID_PLAN',
      message: 'Escolha um plano disponivel para continuar.',
    });
  }

  const profile = await resolveProfileForUser(client, user.id);
  const seed = getUserProfileSeed(user, profile, body.customer || body);
  const requiredFields = [];
  if (!seed.name) requiredFields.push('nome');
  if (!seed.email) requiredFields.push('e-mail');
  if (requiredFields.length > 0) {
    return json(422, {
      ok: false,
      code: 'MISSING_CUSTOMER_FIELDS',
      missingFields: requiredFields,
      message: buildMissingCustomerFieldsMessage(requiredFields),
    });
  }

  const existingLinkedSubscription = await findLinkedSubscription(client, {
    providerCustomerId: body.providerCustomerId || null,
    providerSubscriptionId: body.providerSubscriptionId || null,
  }).catch(() => null);

  let providerCustomer = existingLinkedSubscription?.provider_customer_id
    ? { id: existingLinkedSubscription.provider_customer_id }
    : null;

  if (!providerCustomer?.id) {
    providerCustomer = await createCustomerOnAsaas({ user, profile, body });
  }

  const subscription = await createMonthlySubscriptionOnAsaas({
    customerId: providerCustomer.id,
    plan: availablePlan,
    externalReference: user.id,
    body,
  });

  const checkoutUrl = extractProviderUrl(subscription);
  const mappedStatus = mapAsaasEventToSubscriptionStatus({
    eventName: body.eventName || 'subscription.created',
    paymentStatus: subscription?.status || 'trialing',
    subscriptionStatus: subscription?.status || 'trialing',
  });

  const subscriptionRow = await upsertCustomerSubscription(client, buildCustomerSubscriptionPatch({
    userId: user.id,
    plan: availablePlan,
    customer: providerCustomer,
    subscription,
    body,
  }));

  const checkoutSession = await upsertCheckoutSession(client, {
    owner_user_id: user.id,
    user_id: user.id,
    plan_code: availablePlan.planCode,
    status: checkoutUrl ? 'completed' : 'pending',
    billing_provider: 'asaas',
    provider_checkout_session_id: normalizeText(subscription?.id || body.providerCheckoutSessionId || providerCustomer?.id) || null,
    checkout_url: checkoutUrl,
    expires_at: body.expiresAt || null,
    completed_at: checkoutUrl ? new Date().toISOString() : null,
    raw_payload: subscription,
  }).catch(() => null);

  const billingEvent = await upsertBillingEvent(client, buildBillingEventRow({
    userId: user.id,
    subscriptionRow,
    eventIdentity: buildAsaasEventIdentity({
      id: subscription?.id,
      event: 'subscription.created',
      subscription,
      customer: providerCustomer,
    }),
    eventName: 'subscription.created',
    mapped: mappedStatus,
    event: {
      id: subscription?.id || null,
      event: 'subscription.created',
      subscription,
      customer: providerCustomer,
    },
    providerCustomerId: providerCustomer?.id || null,
    providerSubscriptionId: subscription?.id || null,
    providerPaymentId: subscription?.payment?.id || null,
  })).catch(() => null);

  return json(200, {
    ok: true,
    checkoutUrl,
    manual: false,
    customer: providerCustomer,
    subscription,
    checkoutSession,
    billingEvent,
    message: checkoutUrl
      ? 'Checkout preparado.'
      : 'Checkout em preparacao. Fale com a equipe se precisar de ajuda.',
  });
}

export async function handleWebhookRequest(req, { client = getSupabaseAdminClient() } = {}) {
  if (req.method !== 'POST') {
    return json(405, { ok: false, message: 'Metodo nao permitido.' });
  }

  const env = getAsaasServerEnvStatus();
  if (!env.configured) {
    return json(500, { ok: false, message: 'O recurso de assinatura ainda nao esta pronto. Tente novamente em alguns instantes.' });
  }

  if (!validateWebhookToken(req.headers || {}, getRuntimeEnv().webhookToken)) {
    return json(401, {
      ok: false,
      message: 'Token invalido.',
    });
  }

  const event = isObject(req.body) ? req.body : {};
  const eventName = normalizeText(event.event || event.type || event.name || 'unknown');
  const providerCustomerId = normalizeText(event?.payment?.customer || event?.subscription?.customer || event.customer?.id || event.customerId || event.provider_customer_id) || null;
  const providerSubscriptionId = normalizeText(event?.payment?.subscription || event?.subscription?.id || event.subscriptionId || event.provider_subscription_id) || null;
  const providerPaymentId = normalizeText(event?.payment?.id || event.paymentId || event.provider_payment_id) || null;
  const mapped = mapAsaasEventToSubscriptionStatus({
    eventName,
    paymentStatus: event?.payment?.status || event.paymentStatus || event.status,
    subscriptionStatus: event?.subscription?.status || event.subscriptionStatus,
  });
  const eventIdentity = buildAsaasEventIdentity(event);

  const subscriptionRow = await findLinkedSubscription(client, {
    providerCustomerId,
    providerSubscriptionId,
  }).catch(() => null);

  const ownerUserId = subscriptionRow?.owner_user_id
    || subscriptionRow?.user_id
    || await resolveOwnerUserIdFromCustomerReference(client, providerCustomerId).catch(() => null);

  if (!ownerUserId) {
    return json(200, {
      ok: true,
      stored: false,
      ignored: true,
      duplicateSafe: true,
      message: 'Evento recebido e ignorado com seguranca.',
    });
  }

  const billingEvent = await upsertBillingEvent(client, buildBillingEventRow({
    userId: ownerUserId,
    subscriptionRow,
    eventIdentity,
    eventName,
    mapped,
    event,
    providerCustomerId,
    providerSubscriptionId,
    providerPaymentId,
  }));

  if (!subscriptionRow || !mapped.shouldUpdateSubscription) {
    return json(200, {
      ok: true,
      stored: true,
      ignored: !mapped.shouldUpdateSubscription || !subscriptionRow,
      duplicateSafe: true,
      billingEvent,
      message: 'Evento recebido e armazenado com seguranca.',
    });
  }

  const patch = {
    ...subscriptionRow,
    status: mapped.status || subscriptionRow.status,
    billing_provider: 'asaas',
    provider_customer_id: providerCustomerId || subscriptionRow.provider_customer_id || null,
    provider_subscription_id: providerSubscriptionId || subscriptionRow.provider_subscription_id || null,
    provider_payment_id: providerPaymentId || subscriptionRow.provider_payment_id || null,
    raw_payload: event,
    current_period_start: event?.payment?.dateCreated || event?.subscription?.dateCreated || subscriptionRow.current_period_start || null,
    current_period_end: event?.payment?.dueDate || event?.subscription?.nextDueDate || subscriptionRow.current_period_end || null,
    canceled_at: mapped.status === 'canceled' ? new Date().toISOString() : subscriptionRow.canceled_at || null,
    blocked_at: mapped.status === 'blocked' ? new Date().toISOString() : subscriptionRow.blocked_at || null,
  };

  const { data, error } = await client
    .from('customer_subscriptions')
    .update(patch)
    .eq('id', subscriptionRow.id)
    .select('*')
    .maybeSingle();

  if (error) {
    return json(502, {
      ok: false,
      message: 'Nao foi possivel confirmar a atualizacao agora. Tente novamente em alguns instantes.',
      billingEvent,
      subscription: subscriptionRow,
    });
  }

  return json(200, {
    ok: true,
    stored: true,
    ignored: false,
    duplicateSafe: true,
    billingEvent,
    subscription: data || subscriptionRow,
    mappedStatus: mapped.status,
    message: 'Evento processado com sucesso.',
  });
}
