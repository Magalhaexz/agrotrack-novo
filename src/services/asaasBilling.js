import { supabase } from '../lib/supabase.js';
import { normalizeSubscription } from './subscriptions.js';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeCustomerValue(value) {
  return normalizeText(value);
}

function resolveFriendlyCheckoutErrorMessage(payload = {}, fallback = 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes ou fale com o suporte.') {
  const code = normalizeText(payload?.code).toUpperCase();

  if (code === 'SESSION_MISSING') {
    return 'Sua sessão expirou. Entre novamente para continuar.';
  }

  if (code === 'INVALID_SUBSCRIPTION_PAYLOAD' || code === 'INVALID_PLAN') {
    return 'Revise os dados do plano antes de continuar.';
  }

  if (code === 'MISSING_CUSTOMER_FIELDS') {
    return payload?.message || 'Precisamos conferir alguns dados antes de continuar.';
  }

  if (code === 'ASAAS_SUBSCRIPTION_FAILED' || code === 'ASAAS_ENV_MISSING') {
    return 'Não foi possível criar sua assinatura agora. Tente novamente em alguns instantes.';
  }

  if (code === 'CHECKOUT_URL_MISSING') {
    return payload?.message || fallback;
  }

  return payload?.message || fallback;
}

export function getMissingAsaasCustomerFields(customer = {}) {
  const seed = isPlainObject(customer) ? customer : {};
  const missing = [];

  if (!normalizeCustomerValue(seed.name || seed.nome)) missing.push('name');
  if (!normalizeCustomerValue(seed.email)) missing.push('email');
  if (!normalizeCustomerValue(seed.cpfCnpj || seed.cpf_cnpj)) missing.push('cpfCnpj');
  if (!normalizeCustomerValue(seed.mobilePhone || seed.mobile_phone || seed.telefone)) missing.push('mobilePhone');

  return missing;
}

export function isAsaasCustomerDataComplete(customer = {}) {
  return getMissingAsaasCustomerFields(customer).length === 0;
}

export function resolveAsaasPaymentUrl(payload = {}) {
  const candidates = [
    payload.checkoutUrl,
    payload.paymentUrl,
    payload.invoiceUrl,
    payload.bankSlipUrl,
    payload.transactionReceiptUrl,
    payload.paymentLink?.url,
    payload.payment_link?.url,
    payload.hostedCheckoutUrl,
    payload.hosted_checkout_url,
    payload.invoice_url,
    payload.payment_url,
    payload.url,
    payload.payment?.url,
    payload.payment?.invoiceUrl,
    payload.payment?.bankSlipUrl,
    payload.payment?.transactionReceiptUrl,
    payload.invoice?.url,
    payload.invoice?.invoiceUrl,
    payload.invoice?.paymentUrl,
    payload.data?.checkoutUrl,
    payload.data?.paymentUrl,
  ];

  return candidates.map(normalizeText).find(Boolean) || null;
}

export function extractAccessToken(session = null) {
  const direct = session?.access_token || session?.session?.access_token || session?.data?.session?.access_token || null;
  return normalizeText(direct) || null;
}

export function isSandboxCheckoutAllowed(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return true;

  const status = normalizeText(normalized.status).toLowerCase();
  return ['past_due', 'canceled', 'blocked', ''].includes(status);
}

export function getSandboxCheckoutCopy(subscription) {
  const normalized = normalizeSubscription(subscription);
  const status = normalizeText(normalized?.status).toLowerCase();
  if (!normalized) {
    return {
      canCheckout: true,
      label: 'Escolher plano',
    };
  }
  if (['past_due', 'canceled', 'blocked'].includes(status)) {
    return {
      canCheckout: true,
      label: 'Regularizar assinatura',
    };
  }
  return {
    canCheckout: false,
    label: 'Gerenciar assinatura',
  };
}

export async function requestAsaasSandboxCheckout({ session = null, planCode, customer = {} } = {}) {
  const accessToken = extractAccessToken(session) || (await supabase.auth.getSession()).data?.session?.access_token || null;

  if (!accessToken) {
    return {
      ok: false,
      code: 'SESSION_MISSING',
      message: 'Não foi possível confirmar o acesso agora. Entre novamente e tente outra vez.',
    };
  }

  const response = await fetch('/api/asaas-create-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      planCode,
      customer: isPlainObject(customer) ? customer : {},
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    return {
      ok: false,
      code: payload?.code || null,
      missingFields: Array.isArray(payload?.missingFields) ? payload.missingFields : [],
      message: resolveFriendlyCheckoutErrorMessage(payload, 'Não foi possível confirmar o salvamento agora. Tente novamente em alguns instantes.'),
    };
  }

  const resolvedPaymentUrl = resolveAsaasPaymentUrl(payload);

  if (payload.ok === false) {
    return {
      ok: false,
      code: payload?.code || null,
      missingFields: Array.isArray(payload?.missingFields) ? payload.missingFields : [],
      reused: Boolean(payload?.reused),
      manual: Boolean(payload?.manual),
      checkoutUrl: resolvedPaymentUrl,
      paymentUrl: resolvedPaymentUrl,
      message: resolveFriendlyCheckoutErrorMessage(payload),
      ...payload,
    };
  }

  if (!resolvedPaymentUrl && !payload.manual) {
    return {
      ok: false,
      code: payload?.code || 'CHECKOUT_URL_MISSING',
      missingFields: Array.isArray(payload?.missingFields) ? payload.missingFields : [],
      reused: Boolean(payload?.reused),
      manual: Boolean(payload?.manual),
      checkoutUrl: null,
      paymentUrl: null,
      message: resolveFriendlyCheckoutErrorMessage(payload),
      ...payload,
    };
  }

  return {
    ok: true,
    paymentUrl: resolvedPaymentUrl,
    ...payload,
  };
}
