import { permissoesPorPagina, perfilTemPermissao } from '../auth/perfis.js';
import {
  SUBSCRIPTION_STATUSES,
  canAccessModule,
  getCurrentSubscription,
  normalizeSubscription,
} from './subscriptions.js';
import { isBootstrapAdminUser } from './userAccess.js';

/**
 * Serviço central de acesso comercial do HERDON.
 *
 * Toda decisão "essa conta pode usar o app operacional?" passa por aqui —
 * nenhuma tela deve reimplementar regra de plano/assinatura por conta própria.
 *
 * Política comercial oficial (docs/PRONTIDAO_COMERCIAL_HERDON.md):
 * - PODE usar: assinatura `active`; `trialing` dentro do prazo; `past_due`
 *   dentro da tolerância; `internal_test` (piloto/beta); override interno
 *   (`override`/`internal_override`/`is_internal_override`); e-mail de admin
 *   bootstrap (exceção interna controlada).
 * - NÃO PODE usar: sem assinatura; trial vencido; pagamento vencido fora da
 *   tolerância; `canceled`; `blocked`.
 * - Subusuários herdam o status da assinatura do proprietário: a assinatura é
 *   gravada com `owner_user_id` da conta e o RLS `same_account` permite que o
 *   subusuário a leia — logo o gate avalia sempre a assinatura do dono.
 */
export const TRIAL_PADRAO_DIAS = 14;
export const TOLERANCIA_ATRASO_DIAS = 3;

export const MOTIVOS_BLOQUEIO = {
  SEM_PLANO: 'sem_plano',
  TRIAL_VENCIDO: 'trial_vencido',
  PAGAMENTO_VENCIDO: 'pagamento_vencido',
  CANCELADA: 'cancelada',
  BLOQUEADA: 'bloqueada',
};

const MENSAGENS_BLOQUEIO = {
  [MOTIVOS_BLOQUEIO.SEM_PLANO]: 'Sua conta ainda não tem um plano ativo. Escolha um plano para começar a usar o HERDON.',
  [MOTIVOS_BLOQUEIO.TRIAL_VENCIDO]: 'Seu período de teste terminou. Escolha um plano para continuar usando o HERDON.',
  [MOTIVOS_BLOQUEIO.PAGAMENTO_VENCIDO]: 'Sua assinatura está com pagamento vencido. Regularize para continuar usando o HERDON.',
  [MOTIVOS_BLOQUEIO.CANCELADA]: 'Sua assinatura foi cancelada. Escolha um plano para voltar a usar o HERDON.',
  [MOTIVOS_BLOQUEIO.BLOQUEADA]: 'Sua conta está bloqueada. Fale com o suporte para regularizar o acesso.',
};

function parseDateMs(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function addDaysMs(timeMs, days) {
  return timeMs + days * 24 * 60 * 60 * 1000;
}

function hasInternalOverride(subscription) {
  return (
    subscription?.override === true
    || subscription?.internal_override === true
    || subscription?.is_internal_override === true
  );
}

function buildGate({ status, allowed, reason = null, warning = false, message = null, subscription = null }) {
  return {
    status,
    allowed,
    blocked: !allowed,
    warning,
    reason,
    message: message || (reason ? MENSAGENS_BLOQUEIO[reason] : null),
    subscription,
  };
}

/**
 * Núcleo do gate comercial. Recebe a assinatura da conta (ou null) e devolve
 * a decisão de acesso: { status, allowed, blocked, warning, reason, message }.
 *
 * Opções:
 * - `user`: usuário autenticado — usado só para a exceção interna de admin
 *   bootstrap (não bloquear administrador interno sem exceção controlada).
 * - `now`: timestamp de referência (injetável para testes).
 * - `subscriptionLoadError`: se a CONSULTA da assinatura falhou (rede/RLS),
 *   o gate falha aberto com aviso em vez de trancar o produtor no campo —
 *   decisão documentada: bloqueio forte vale para o caso normal online;
 *   endurecer via RLS é a evolução recomendada (ver relatório de prontidão).
 */
export function buildAccountAccessGate(subscription, options = {}) {
  const now = Number(options.now) || Date.now();

  if (options.user && isBootstrapAdminUser(options.user)) {
    return buildGate({
      status: 'admin_override',
      allowed: true,
      subscription: normalizeSubscription(subscription),
    });
  }

  const normalized = normalizeSubscription(subscription);

  if (!normalized) {
    if (options.subscriptionLoadError) {
      return buildGate({
        status: 'indefinido',
        allowed: true,
        warning: true,
        message: 'Não foi possível confirmar sua assinatura agora. Verifique sua conexão — o acesso pode ser bloqueado na próxima sincronização.',
      });
    }
    return buildGate({ status: 'none', allowed: false, reason: MOTIVOS_BLOQUEIO.SEM_PLANO });
  }

  if (hasInternalOverride(normalized)) {
    return buildGate({ status: 'admin_override', allowed: true, subscription: normalized });
  }

  const status = String(normalized.status || '').toLowerCase();

  if (status === SUBSCRIPTION_STATUSES.INTERNAL_TEST) {
    return buildGate({ status, allowed: true, subscription: normalized });
  }

  if (status === SUBSCRIPTION_STATUSES.ACTIVE) {
    return buildGate({ status, allowed: true, subscription: normalized });
  }

  if (status === SUBSCRIPTION_STATUSES.TRIALING) {
    // Fim do teste: trial_ends_at quando existe; senão o fim do período
    // corrente. Trial legado sem nenhuma data não bloqueia (documentado).
    const trialEnd = parseDateMs(normalized.trial_ends_at) ?? parseDateMs(normalized.current_period_end);
    if (trialEnd !== null && trialEnd < now) {
      return buildGate({ status, allowed: false, reason: MOTIVOS_BLOQUEIO.TRIAL_VENCIDO, subscription: normalized });
    }
    return buildGate({ status, allowed: true, subscription: normalized });
  }

  if (status === SUBSCRIPTION_STATUSES.PAST_DUE) {
    // Tolerância de atraso: TOLERANCIA_ATRASO_DIAS após o fim do período pago.
    // Sem data de referência (legado), mantém acesso com aviso permanente.
    const baseline = parseDateMs(normalized.current_period_end) ?? parseDateMs(normalized.updated_at);
    if (baseline !== null && addDaysMs(baseline, TOLERANCIA_ATRASO_DIAS) < now) {
      return buildGate({ status, allowed: false, reason: MOTIVOS_BLOQUEIO.PAGAMENTO_VENCIDO, subscription: normalized });
    }
    return buildGate({
      status,
      allowed: true,
      warning: true,
      message: 'Sua assinatura está com pagamento pendente. Regularize para não perder o acesso.',
      subscription: normalized,
    });
  }

  if (status === SUBSCRIPTION_STATUSES.CANCELED) {
    return buildGate({ status, allowed: false, reason: MOTIVOS_BLOQUEIO.CANCELADA, subscription: normalized });
  }

  if (status === SUBSCRIPTION_STATUSES.BLOCKED) {
    return buildGate({ status, allowed: false, reason: MOTIVOS_BLOQUEIO.BLOQUEADA, subscription: normalized });
  }

  // Status fora do catálogo (a CHECK do banco só permite os 6 conhecidos):
  // trata como conta sem plano válido.
  return buildGate({ status, allowed: false, reason: MOTIVOS_BLOQUEIO.SEM_PLANO, subscription: normalized });
}

export function getAccountStatus(profile, subscription, options = {}) {
  return buildAccountAccessGate(subscription, options).status;
}

export function canAccessApp(user, profile, subscription, options = {}) {
  return buildAccountAccessGate(subscription, { ...options, user }).allowed;
}

export function isAccountBlocked(profile, subscription, options = {}) {
  return buildAccountAccessGate(subscription, options).blocked;
}

export function getBlockedReason(profile, subscription, options = {}) {
  return buildAccountAccessGate(subscription, options).reason;
}

export function getBlockedMessage(reason) {
  return MENSAGENS_BLOQUEIO[reason] || MENSAGENS_BLOQUEIO[MOTIVOS_BLOQUEIO.SEM_PLANO];
}

// ============================================================
// Paywall de escrita / modo visualização
//
// Modelo comercial (a partir de 2026-07-02): o usuário logado SEMPRE pode
// VER o app (modo visualização), para conhecer o produto antes de pagar.
// Já a ESCRITA (cadastrar/salvar/editar/excluir/importar) exige plano ativo.
// A decisão de escrita reaproveita exatamente o gate de conta — ou seja, o
// que antes liberava/bloqueava a ENTRADA agora libera/bloqueia a ESCRITA.
// ============================================================

export const WRITE_BLOCKED_MESSAGE = 'Para salvar dados no HERDON, escolha um plano.';

export class SubscriptionRequiredError extends Error {
  constructor(message = WRITE_BLOCKED_MESSAGE) {
    super(message);
    this.name = 'SubscriptionRequiredError';
    this.code = 'SUBSCRIPTION_REQUIRED';
  }
}

/**
 * Pode visualizar o app (modo leitura) se está logado com um profile válido.
 * Não depende de assinatura — é o novo comportamento comercial padrão.
 */
export function canViewApp(profile = null, subscription = null, options = {}) {
  // `subscription` é aceito por simetria com canWriteData, mas a visualização
  // nunca depende de assinatura — logado com profile já pode ver.
  void subscription;
  if (options.user && isBootstrapAdminUser(options.user)) return true;
  return Boolean(profile?.id || profile || options.user?.id);
}

/**
 * Pode escrever (gravar dados) se a conta tem acesso comercial ativo:
 * `active`, `trialing` no prazo, `past_due` na tolerância, `internal_test`,
 * override interno ou e-mail de admin bootstrap. Subusuários herdam a
 * assinatura do proprietário (avaliada via owner_user_id / RLS same_account).
 */
export function canWriteData(profile, subscription, options = {}) {
  return buildAccountAccessGate(subscription, options).allowed;
}

export function requiresSubscriptionForWrite(profile, subscription, options = {}) {
  return !canWriteData(profile, subscription, options);
}

export function getWriteBlockedReason(profile, subscription, options = {}) {
  const gate = buildAccountAccessGate(subscription, options);
  return gate.allowed ? null : gate.reason;
}

/** Mensagem comercial única do paywall de escrita (independe do motivo). */
export function getWriteBlockedMessage() {
  return WRITE_BLOCKED_MESSAGE;
}

/**
 * Feature = módulo/página ('cenarios', 'financeiro'...) ou permissão
 * explícita ('financeiro:editar'). A resposta combina as três camadas:
 * 1. conta pode usar o app (assinatura);
 * 2. plano inclui o módulo;
 * 3. papel do usuário tem a permissão.
 */
export function canUseFeature(featureKey, profile, subscription, options = {}) {
  const gate = buildAccountAccessGate(subscription, options);
  if (!gate.allowed) return false;

  const key = String(featureKey || '');
  const isPermissionKey = key.includes(':');
  if (!isPermissionKey && !canAccessModule(subscription, key || null)) {
    return false;
  }

  const permissao = isPermissionKey ? key : (permissoesPorPagina[key] || null);
  const perfil = profile?.perfil ?? profile ?? null;
  return perfilTemPermissao(perfil, permissao);
}

/**
 * Busca a assinatura da conta direto do Supabase (RLS `same_account` garante
 * que subusuários enxergam a assinatura do proprietário). `customer_subscriptions`
 * NÃO faz parte do sync operacional local — é fonte de verdade só da nuvem,
 * gravada pelo checkout/webhook Asaas ou manualmente pelo admin.
 */
export async function fetchAccountSubscription(session) {
  if (!session?.user?.id) {
    return { subscription: null, rows: [], error: null };
  }

  try {
    const { supabase } = await import('../lib/supabase.js');
    const { data, error } = await supabase
      .from('customer_subscriptions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      return { subscription: null, rows: [], error };
    }

    const rows = Array.isArray(data) ? data : [];
    const subscription = getCurrentSubscription({ db: { customer_subscriptions: rows } });
    return { subscription, rows, error: null };
  } catch (error) {
    return { subscription: null, rows: [], error };
  }
}
