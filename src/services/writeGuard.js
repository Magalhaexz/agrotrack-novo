import { SubscriptionRequiredError, WRITE_BLOCKED_MESSAGE } from './accessControl.js';

export { SubscriptionRequiredError, WRITE_BLOCKED_MESSAGE };

/**
 * Ponte de runtime do paywall de escrita.
 *
 * O serviço central de persistência (operationalPersistence) não conhece a
 * assinatura da conta — ela vive no React (App.jsx). Este módulo guarda o
 * estado "esta conta pode escrever?" e um callback de redirecionamento, que o
 * App configura a cada mudança de assinatura. Assim a checagem é central: mesmo
 * que uma tela esqueça de bloquear o botão, a gravação é barrada aqui.
 *
 * Default permissivo (canWrite=true): contas pagantes, testes e qualquer
 * contexto sem App configurado não são afetados.
 */
let writeState = { canWrite: true, reason: null };
let blockedWriteHandler = null;

export function configureWriteAccess(next = {}) {
  if (Object.prototype.hasOwnProperty.call(next, 'canWrite')) {
    writeState = {
      canWrite: next.canWrite !== false,
      reason: next.reason ?? null,
    };
  }
  if (Object.prototype.hasOwnProperty.call(next, 'onBlockedWrite')) {
    blockedWriteHandler = typeof next.onBlockedWrite === 'function' ? next.onBlockedWrite : null;
  }
}

export function resetWriteAccess() {
  writeState = { canWrite: true, reason: null };
  blockedWriteHandler = null;
}

export function isWriteAllowed() {
  return writeState.canWrite !== false;
}

export function getWriteAccessState() {
  return { ...writeState };
}

/** Dispara o redirecionamento central para a página de assinatura. */
export function notifyBlockedWrite(info = {}) {
  if (typeof blockedWriteHandler === 'function') {
    try {
      blockedWriteHandler({ reason: writeState.reason, ...info });
    } catch {
      // Um erro no handler de UI nunca deve derrubar o fluxo de gravação.
    }
  }
}

/**
 * Uso na UI (botões "Novo/Cadastrar", ações rápidas): retorna true se pode
 * escrever; caso contrário aciona o redirecionamento e retorna false — o
 * chamador deve abortar a ação (não abrir modal, não gravar).
 */
export function guardWrite(feature = null) {
  if (isWriteAllowed()) return true;
  notifyBlockedWrite({ feature });
  return false;
}

/** Variante que lança (para chamadores baseados em try/catch). */
export function assertWriteAllowed(feature = null) {
  if (isWriteAllowed()) return;
  notifyBlockedWrite({ feature });
  throw new SubscriptionRequiredError();
}

/**
 * Resultado padrão de escrita bloqueada, no mesmo formato dos retornos de
 * operationalPersistence (persisted:false + code), para que os chamadores
 * existentes não quebrem e nenhum "sucesso falso" apareça.
 */
export function buildWriteBlockedResult(feature = null) {
  return {
    persisted: false,
    blocked: true,
    data: null,
    error: WRITE_BLOCKED_MESSAGE,
    syncStatus: 'blocked',
    code: 'SUBSCRIPTION_REQUIRED',
    feature: feature || null,
  };
}
