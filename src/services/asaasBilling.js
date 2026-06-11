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
      message: 'Nao foi possivel confirmar o acesso agora. Entre novamente e tente outra vez.',
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
      message: payload?.message || 'Nao foi possivel confirmar o salvamento agora. Tente novamente em alguns instantes.',
    };
  }

  return {
    ok: true,
    paymentUrl: resolveAsaasPaymentUrl(payload),
    ...payload,
  };
}
