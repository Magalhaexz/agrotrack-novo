const ACTIVE_STATUSES = new Set(['active', 'trialing', 'internal_test']);
const ENTERABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'internal_test']);
const BLOCKED_STATUSES = new Set(['canceled', 'blocked']);

const MODULES_BASIC = [
  'dashboard',
  'decisoesFazenda',
  'fazendas',
  'lotes',
  'animais',
  'pesagens',
  'tarefas',
  'calendarioOperacional',
  'rotina',
  'perfil',
  'minhaAssinatura',
  'equipeAcessos',
  'configuracoes',
  'resultados',
  'comparativo',
  'relatorios',
  'relatorioLote',
  'relatorioPesagens',
  'relatorioFinanceiro',
  'relatorioPastagens',
  'relatorioResumoGeral',
  'guiaCriador',
  'suporte',
];

const MODULES_PRO = [
  ...MODULES_BASIC,
  'financeiro',
  'estoque',
  'sanitario',
  'relatoriosGerenciais',
];

const MODULES_PREMIUM = [
  ...MODULES_PRO,
  'pastagens',
  'indicadores',
  'cenarios',
  'dashboardPremium',
  'evolucaoRebanho',
];

export const SUBSCRIPTION_STATUSES = {
  TRIALING: 'trialing',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  BLOCKED: 'blocked',
  INTERNAL_TEST: 'internal_test',
};

const PLAN_CATALOG = {
  fundador: {
    planCode: 'fundador',
    planName: 'FUNDADOR',
    priceCents: 29700,
    currencyCode: 'BRL',
    billingInterval: 'month',
    status: 'active',
    description: 'Oferta de lançamento com acesso completo.',
    launchOffer: true,
    easyToDisable: true,
    limits: {
      farms: 50,
      animals: 10000,
      users: 50,
    },
    modules: ['*'],
  },
  essencial: {
    planCode: 'essencial',
    planName: 'ESSENCIAL',
    priceCents: 19700,
    currencyCode: 'BRL',
    billingInterval: 'month',
    status: 'active',
    description: 'Plano para operação enxuta e organizada.',
    limits: {
      farms: 1,
      animals: 300,
      users: 2,
    },
    modules: MODULES_BASIC,
  },
  pro: {
    planCode: 'pro',
    planName: 'PRO',
    priceCents: 39700,
    currencyCode: 'BRL',
    billingInterval: 'month',
    status: 'active',
    description: 'Plano completo para a operação diária da fazenda.',
    limits: {
      farms: 3,
      animals: 1000,
      users: 5,
    },
    modules: MODULES_PRO,
  },
  premium: {
    planCode: 'premium',
    planName: 'PREMIUM',
    priceCents: 69700,
    currencyCode: 'BRL',
    billingInterval: 'month',
    status: 'active',
    description: 'Plano avançado para gestão ampliada e indicadores.',
    limits: {
      farms: 10,
      animals: 3000,
      users: 10,
    },
    modules: MODULES_PREMIUM,
  },
  enterprise: {
    planCode: 'enterprise',
    planName: 'ENTERPRISE',
    priceCents: null,
    currencyCode: 'BRL',
    billingInterval: 'custom',
    status: 'active',
    description: 'Plano personalizado com ativação sob consulta.',
    customLimits: true,
    limits: {
      farms: null,
      animals: null,
      users: null,
    },
    modules: ['*'],
  },
};

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizePlanCode(value) {
  return normalizeText(value).toLowerCase();
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readSubscriptionCandidates(context = {}) {
  const subscriptionCollection = Array.isArray(context.db?.customer_subscriptions)
    ? [...context.db.customer_subscriptions].sort((a, b) => {
      const aLinked = Boolean(a?.provider_customer_id || a?.provider_subscription_id || a?.provider_payment_id);
      const bLinked = Boolean(b?.provider_customer_id || b?.provider_subscription_id || b?.provider_payment_id);
      if (aLinked !== bLinked) return aLinked ? -1 : 1;

      const aInternal = normalizePlanCode(a?.status) === SUBSCRIPTION_STATUSES.INTERNAL_TEST;
      const bInternal = normalizePlanCode(b?.status) === SUBSCRIPTION_STATUSES.INTERNAL_TEST;
      if (aInternal !== bInternal) return aInternal ? 1 : -1;

      const aUpdated = Number(new Date(a?.updated_at || a?.created_at || 0).getTime()) || 0;
      const bUpdated = Number(new Date(b?.updated_at || b?.created_at || 0).getTime()) || 0;
      return bUpdated - aUpdated;
    })[0] || null
    : null;

  return [
    context.subscription,
    context.currentSubscription,
    context.user?.subscription,
    context.user?.user_metadata?.subscription,
    context.user?.profile?.subscription,
    context.profile?.subscription,
    context.db?.assinatura,
    context.db?.assinaturaAtual,
    context.db?.subscription,
    context.db?.subscription_current,
    subscriptionCollection,
  ].filter(Boolean);
}

function formatPriceLabel(priceCents, currencyCode = 'BRL', billingInterval = 'month') {
  if (priceCents === null || priceCents === undefined) return 'Sob consulta';
  const value = Number(priceCents) / 100;
  const normalizedCurrency = String(currencyCode || 'BRL').toUpperCase();
  const intervalLabel = billingInterval === 'month' ? '/mês' : '';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + intervalLabel;
  } catch {
    return `R$ ${value.toFixed(2)}${intervalLabel}`;
  }
}

export function getBillingIntervalLabel(interval) {
  if (normalizePlanCode(interval) === 'month') return 'Mensal';
  return 'Sob consulta';
}

export function getAvailablePlans() {
  return Object.values(PLAN_CATALOG).map((plan) => ({
    ...plan,
    priceLabel: formatPriceLabel(plan.priceCents, plan.currencyCode, plan.billingInterval),
    billingIntervalLabel: getBillingIntervalLabel(plan.billingInterval),
  }));
}

export function getPlanLimits(planCode) {
  const normalized = normalizePlanCode(planCode);
  const plan = PLAN_CATALOG[normalized];
  if (!plan) return null;

  return {
    ...plan,
    priceLabel: formatPriceLabel(plan.priceCents, plan.currencyCode, plan.billingInterval),
    billingIntervalLabel: getBillingIntervalLabel(plan.billingInterval),
  };
}

export function getSubscriptionStatusLabel(status) {
  const normalized = normalizePlanCode(status);
  switch (normalized) {
    case SUBSCRIPTION_STATUSES.TRIALING:
      return 'Em teste';
    case SUBSCRIPTION_STATUSES.ACTIVE:
      return 'Ativa';
    case SUBSCRIPTION_STATUSES.PAST_DUE:
      return 'Pendente';
    case SUBSCRIPTION_STATUSES.CANCELED:
      return 'Cancelada';
    case SUBSCRIPTION_STATUSES.BLOCKED:
      return 'Bloqueada';
    case SUBSCRIPTION_STATUSES.INTERNAL_TEST:
      return 'Acesso de teste ativo';
    default:
      return 'Assinatura em preparação';
  }
}

export function hasSubscriptionBillingReady(subscription) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return false;
  const billingProvider = normalizeText(normalized.billing_provider).toLowerCase();

  return Boolean(
    (billingProvider && billingProvider !== 'manual')
    || normalized.provider_customer_id
    || normalized.provider_subscription_id
    || normalized.provider_payment_id
  );
}

export function getSubscriptionDisplayCopy(subscription, options = {}) {
  const normalized = normalizeSubscription(subscription);
  const status = normalizePlanCode(normalized?.status);
  const checkoutReady = options.checkoutReady ?? hasSubscriptionBillingReady(normalized);
  const plan = normalized?.plan || getPlanLimits(normalized?.plan_code);

  let message = normalized
    ? 'Sua assinatura está em preparação.'
    : 'Escolha um plano para continuar usando o HERDON.';
  let primaryLabel = 'Escolher plano';
  let secondaryLabel = 'Falar com o suporte';
  let helperText = checkoutReady ? null : 'Checkout em preparação';

  if (status === SUBSCRIPTION_STATUSES.TRIALING) {
    message = 'Sua assinatura está em teste.';
    primaryLabel = checkoutReady ? 'Gerenciar assinatura' : 'Ver planos';
  } else if (status === SUBSCRIPTION_STATUSES.ACTIVE) {
    message = 'Sua assinatura está ativa.';
    primaryLabel = checkoutReady ? 'Gerenciar assinatura' : 'Ver planos';
  } else if (status === SUBSCRIPTION_STATUSES.INTERNAL_TEST) {
    message = 'Você está usando o HERDON em acesso piloto. A cobrança ainda não está ativa.';
    primaryLabel = checkoutReady ? 'Gerenciar assinatura' : 'Ver planos';
  } else if (status === SUBSCRIPTION_STATUSES.PAST_DUE) {
    message = 'Sua assinatura está pendente.';
    primaryLabel = 'Regularizar assinatura';
    helperText = null;
  } else if (status === SUBSCRIPTION_STATUSES.CANCELED || status === SUBSCRIPTION_STATUSES.BLOCKED) {
    message = 'Regularize sua assinatura para continuar usando o HERDON.';
    primaryLabel = 'Regularizar assinatura';
    helperText = null;
  }

  return {
    status,
    statusLabel: getSubscriptionStatusLabel(status),
    message,
    primaryLabel,
    secondaryLabel,
    helperText,
    planName: plan?.planName || 'Plano em preparação',
    priceLabel: plan?.priceLabel || 'Sob consulta',
    checkoutReady,
  };
}

export function normalizeSubscription(subscription) {
  if (!isPlainObject(subscription)) return null;

  const planCode = normalizePlanCode(subscription.plan_code || subscription.planCode);
  const plan = getPlanLimits(planCode);
  const normalizedStatus = normalizePlanCode(subscription.status);
  const status = normalizedStatus || 'active';

  return {
    ...subscription,
    id: subscription.id ?? null,
    owner_user_id: subscription.owner_user_id ?? subscription.ownerUserId ?? null,
    user_id: subscription.user_id ?? subscription.userId ?? null,
    farm_id: subscription.farm_id ?? subscription.farmId ?? null,
    fazenda_id: subscription.fazenda_id ?? subscription.fazendaId ?? null,
    plan_code: plan?.planCode || planCode || null,
    plan_name: normalizeText(subscription.plan_name || subscription.planName || plan?.planName || null) || null,
    status,
    billing_provider: normalizeText(subscription.billing_provider || subscription.billingProvider || 'manual') || 'manual',
    provider_customer_id: subscription.provider_customer_id ?? subscription.providerCustomerId ?? null,
    provider_subscription_id: subscription.provider_subscription_id ?? subscription.providerSubscriptionId ?? null,
    provider_payment_id: subscription.provider_payment_id ?? subscription.providerPaymentId ?? null,
    current_period_start: subscription.current_period_start ?? subscription.currentPeriodStart ?? null,
    current_period_end: subscription.current_period_end ?? subscription.currentPeriodEnd ?? null,
    trial_ends_at: subscription.trial_ends_at ?? subscription.trialEndsAt ?? null,
    canceled_at: subscription.canceled_at ?? subscription.canceledAt ?? null,
    blocked_at: subscription.blocked_at ?? subscription.blockedAt ?? null,
    raw_payload: isPlainObject(subscription.raw_payload) ? subscription.raw_payload : (isPlainObject(subscription.rawPayload) ? subscription.rawPayload : {}),
    plan: plan ? {
      planCode: plan.planCode,
      planName: plan.planName,
      priceCents: plan.priceCents,
      priceLabel: plan.priceLabel,
      currencyCode: plan.currencyCode,
      billingInterval: plan.billingInterval,
      billingIntervalLabel: plan.billingIntervalLabel,
      description: plan.description,
      launchOffer: Boolean(plan.launchOffer),
      easyToDisable: Boolean(plan.easyToDisable),
      customLimits: Boolean(plan.customLimits),
      limits: plan.limits,
      modules: plan.modules,
    } : null,
  };
}

export function getCurrentSubscription(context = {}) {
  const explicit = readSubscriptionCandidates(context)[0] || null;
  return normalizeSubscription(explicit);
}

export function hasActiveSubscription(subscription, options = {}) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return options.allowMissing !== false;
  if (normalized.override === true || normalized.internal_override === true || normalized.is_internal_override === true) {
    return true;
  }
  return ACTIVE_STATUSES.has(normalizePlanCode(normalized.status));
}

export function canEnterApp(subscription, options = {}) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return options.allowMissing !== false;
  if (normalized.override === true || normalized.internal_override === true || normalized.is_internal_override === true) {
    return true;
  }
  return ENTERABLE_STATUSES.has(normalizePlanCode(normalized.status));
}

export function buildSubscriptionAccessState(subscription, options = {}) {
  const normalized = normalizeSubscription(subscription);
  const status = normalizePlanCode(normalized?.status);
  const hasSubscription = Boolean(normalized);
  const blocked = hasSubscription
    && !canEnterApp(normalized, options)
    && !hasActiveSubscription(normalized, options);
  const warning = status === SUBSCRIPTION_STATUSES.PAST_DUE;
  const display = getSubscriptionDisplayCopy(normalized, options);

  return {
    subscription: normalized,
    hasSubscription,
    status,
    statusLabel: display.statusLabel,
    canEnterApp: canEnterApp(normalized, options),
    blocked,
    warning,
    message: display.message,
    badgeTone: blocked ? 'danger' : warning ? 'warning' : 'success',
    actionCopy: display,
  };
}

function evaluateLimit(subscription, key, currentCount = 0, requestedCount = 1) {
  const normalized = normalizeSubscription(subscription);
  const plan = normalized?.plan || getPlanLimits(normalized?.plan_code);
  const limit = plan?.limits?.[key];
  const current = Number(currentCount || 0);
  const requested = Number(requestedCount || 0) || 0;

  if (!normalized) {
    return {
      allowed: true,
      limit: null,
      currentCount: current,
      requestedCount: requested,
      remaining: null,
      reason: 'no_subscription',
      planCode: null,
    };
  }

  if (normalized.override === true || normalized.internal_override === true || normalized.is_internal_override === true) {
    return {
      allowed: true,
      limit: limit ?? null,
      currentCount: current,
      requestedCount: requested,
      remaining: limit === null || limit === undefined ? null : Math.max(Number(limit) - current - requested, 0),
      reason: 'internal_override',
      planCode: normalized.plan_code || null,
    };
  }

  if (BLOCKED_STATUSES.has(normalizePlanCode(normalized.status))) {
    return {
      allowed: false,
      limit: limit ?? null,
      currentCount: current,
      requestedCount: requested,
      remaining: null,
      reason: 'subscription_blocked',
      planCode: normalized.plan_code || null,
    };
  }

  if (limit === null || limit === undefined) {
    return {
      allowed: true,
      limit: null,
      currentCount: current,
      requestedCount: requested,
      remaining: null,
      reason: 'unlimited',
      planCode: normalized.plan_code || null,
    };
  }

  const allowed = current + requested <= Number(limit);
  return {
    allowed,
    limit: Number(limit),
    currentCount: current,
    requestedCount: requested,
    remaining: Math.max(Number(limit) - current - requested, 0),
    reason: allowed ? 'within_limit' : 'limit_exceeded',
    planCode: normalized.plan_code || null,
  };
}

export function canAccessModule(subscription, moduleId) {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return true;
  if (normalized.override === true || normalized.internal_override === true || normalized.is_internal_override === true) {
    return true;
  }
  if (BLOCKED_STATUSES.has(normalizePlanCode(normalized.status))) {
    return false;
  }
  const plan = normalized.plan || getPlanLimits(normalized.plan_code);
  if (!plan) return true;
  if (plan.modules?.includes('*') || plan.customLimits) return true;
  if (!moduleId) return true;
  return Array.isArray(plan.modules) ? plan.modules.includes(moduleId) : true;
}

export function canCreateFarm(subscription, currentCount = 0) {
  return evaluateLimit(subscription, 'farms', currentCount, 1);
}

export function canCreateAnimal(subscription, currentCount = 0, requestedCount = 1) {
  return evaluateLimit(subscription, 'animals', currentCount, requestedCount);
}

export function canInviteUser(subscription, currentCount = 0) {
  return evaluateLimit(subscription, 'users', currentCount, 1);
}

export function getSubscriptionLimitMessage(kind, evaluation) {
  if (!evaluation || evaluation.allowed) return null;

  if (evaluation.reason === 'subscription_blocked') {
    return 'Regularize sua assinatura para continuar usando o HERDON.';
  }

  const limit = evaluation.limit;
  const limitText = limit === null || limit === undefined ? 'ilimitado' : String(limit);

  if (kind === 'farms') {
    const plural = limit === 1 ? 'fazenda' : 'fazendas';
    return `Seu plano atual permite ${limitText} ${plural}. Para cadastrar mais fazendas, escolha um plano superior.`;
  }

  if (kind === 'animals') {
    return 'Seu plano atual atingiu o limite de cabeças ativas. Para continuar cadastrando animais, escolha um plano superior.';
  }

  if (kind === 'users') {
    const plural = limit === 1 ? 'usuário' : 'usuários';
    return `Seu plano atual permite até ${limitText} ${plural}. Para convidar mais pessoas, escolha um plano superior.`;
  }

  return `Seu plano atual permite até ${limitText} ${kind}. Escolha um plano superior para continuar.`;
}

export function getModuleBlockedMessage() {
  return 'Este recurso está disponível em outro plano. Veja Planos e Assinatura para escolher um plano superior.';
}
