import { getSupabaseEnvStatus, supabase, validateSupabaseSessionForCloud } from '../lib/supabase.js';
const NETWORK_CIRCUIT_OPEN_MS = 45000;
const moduleNetworkCircuit = new Map();
const OWNER_SCOPE_OPTIONAL_TABLES = new Set([]);
const tableCapabilityCache = new Map();
const PENDING_SYNC_QUEUE_KEY = 'herdon-pending-sync-queue';
const AUTO_RETRY_EVENT = 'herdon-pending-sync-updated';
const BLOCKED_SCHEMA_ERROR_CODE = 'blocked_schema_error';

function getSessionUserId(session) {
  return session?.user?.id || null;
}

function toNullableId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const asNumber = Number(text);
  return Number.isFinite(asNumber) && text === String(asNumber) ? asNumber : text;
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function isNetworkError(error) {
  if (Number(error?.status)) return false;
  const message = String(getErrorMessage(error) || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('err_connection')
    || message.includes('timeout')
    || message.includes('err_http2_protocol_error')
    || message.includes('err_connection_reset');
}

function getHttpStatus(error) {
  const status = Number(error?.status);
  return Number.isFinite(status) && status > 0 ? status : null;
}

function getPostgrestCode(error) {
  const code = String(error?.code || '').toUpperCase();
  return code || null;
}

function getSafeErrorDetails(error) {
  const safeMessage = getErrorMessage(error) ? String(getErrorMessage(error)) : null;
  const details = error?.details ? String(error.details) : null;
  const hint = error?.hint ? String(error.hint) : null;
  return { safeMessage, details, hint };
}

function isSchemaCompatibilityError(error) {
  const status = getHttpStatus(error);
  const code = String(error?.code || '').toUpperCase();
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    status === 400
    || code === 'PGRST204'
    || code === '42703'
    || message.includes('column')
    || message.includes('schema cache')
    || details.includes('column')
    || details.includes('schema cache')
  );
}

function logSupabase400Diagnostic(event = {}) {
  if (!import.meta.env.DEV) return;
  console.warn('[HERDON_SUPABASE_400_DIAGNOSTIC]', {
    table: event.table || null,
    action: event.action || null,
    status: event.status || null,
    postgrestCode: event.postgrestCode || null,
    safeMessage: event.safeMessage || null,
    details: event.details || null,
    hint: event.hint || null,
    payloadKeys: Array.isArray(event.payloadKeys) ? event.payloadKeys : [],
    removedKeys: Array.isArray(event.removedKeys) ? event.removedKeys : [],
  });
}

function getTableCapability(table) {
  const key = String(table || '').toLowerCase();
  return tableCapabilityCache.get(key) || {
    ownerScope: !OWNER_SCOPE_OPTIONAL_TABLES.has(key),
    metadata: true,
    createdAt: true,
  };
}

function updateTableCapability(table, patch = {}) {
  const key = String(table || '').toLowerCase();
  const current = getTableCapability(key);
  tableCapabilityCache.set(key, { ...current, ...patch });
}

function tableSupportsOwnerScope(table) {
  return Boolean(getTableCapability(table).ownerScope);
}

function tableSupportsMetadata(table) {
  return Boolean(getTableCapability(table).metadata);
}

function tableSupportsCreatedAt(table) {
  return Boolean(getTableCapability(table).createdAt);
}

function isOwnerColumnSchemaError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    code === '42703'
    || code === 'PGRST204'
    || message.includes('owner_user_id')
    || details.includes('owner_user_id')
  );
}

function isCreatedAtSchemaError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    code === '42703'
    || code === 'PGRST204'
    || message.includes('created_at')
    || details.includes('created_at')
  );
}

function shouldOpenNetworkCircuit(error) {
  return isNetworkError(error);
}

function isNetworkCircuitOpen(moduleName) {
  const openedAt = moduleNetworkCircuit.get(moduleName) || 0;
  return (Date.now() - openedAt) < NETWORK_CIRCUIT_OPEN_MS;
}

function openNetworkCircuit(moduleName) {
  moduleNetworkCircuit.set(moduleName, Date.now());
}

function closeNetworkCircuit(moduleName) {
  moduleNetworkCircuit.delete(moduleName);
}

export function getCloudSyncCooldownState(moduleName) {
  const openedAt = moduleNetworkCircuit.get(moduleName) || 0;
  if (!openedAt) {
    return {
      module: moduleName,
      open: false,
      remainingMs: 0,
    };
  }
  const elapsed = Date.now() - openedAt;
  const remainingMs = Math.max(0, NETWORK_CIRCUIT_OPEN_MS - elapsed);
  return {
    module: moduleName,
    open: remainingMs > 0,
    remainingMs,
  };
}

function buildModuleSyncResult({
  module,
  status,
  message,
  code = null,
  httpStatus = null,
  data = [],
  syncedCount = 0,
  failedCount = 0,
  selectedCount = 0,
}) {
  return {
    module,
    status,
    message,
    code,
    httpStatus,
    ok: status === 'success',
    data: Array.isArray(data) ? data : [],
    syncedCount,
    failedCount,
    selectedCount,
  };
}

function logModuleSyncEvent({
  module,
  stage,
  table,
  host = null,
  httpStatus = null,
  postgrestCode = null,
  safeMessage = null,
}, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.info;
  logger('[HERDON_CLOUD_MODULE_SYNC]', {
    module: module || null,
    stage: stage || null,
    table: table || null,
    host,
    httpStatus,
    postgrestCode,
    safeMessage,
  });
}

function getSchemaMissingMessageByTable(table) {
  if (table === 'lotes') {
    return 'Tabela de lotes n\u00E3o encontrada na nuvem. Verifique a estrutura do Supabase.';
  }
  if (table === 'funcionarios') {
    return 'Tabela de funcion\u00E1rios n\u00E3o encontrada na nuvem. Verifique a estrutura do Supabase.';
  }
  return 'Estrutura da base nao compativel com o app. Use o modo local e valide a configuracao.';
}

function classifyOperationalError(error, fallbackMessage, table = null) {
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  if (isNetworkError(error)) {
    return 'N\u00E3o foi poss\u00EDvel conectar \u00E0 nuvem. Verifique sua conex\u00E3o e tente novamente.';
  }
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Permiss\u00E3o insuficiente para sincronizar este registro.';
  }
  if (code === 'CONFIG_ERROR' || message.includes('missing_rest_config_or_token')) {
    return 'Configura\u00E7\u00E3o da nuvem incompleta. Verifique as vari\u00E1veis do Supabase.';
  }
  if (code === 'PGRST204' || code === '42703' || code === '42P01' || message.includes('schema') || message.includes('column') || message.includes('relation')) {
    return getSchemaMissingMessageByTable(table);
  }
  return fallbackMessage;
}

function logOperationalSync(event = {}, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_OPERATIONAL_SYNC]', {
    stage: event.stage || null,
    requestStage: event.requestStage || null,
    action: event.action || null,
    table: event.table || null,
    hasSessionUser: Boolean(event.hasSessionUser),
    hasAccessToken: Boolean(event.hasAccessToken),
    envConfigured: Boolean(event.envConfigured),
    errorType: event.errorType || null,
    errorCode: event.errorCode || null,
    httpStatus: event.httpStatus || null,
    syncStatus: event.syncStatus || null,
    safeDetails: event.safeDetails || null,
    safeHint: event.safeHint || null,
  });
}

function classifyCloudSaveCode(rawCode, error = null, status = null) {
  const code = String(rawCode || error?.code || '').toUpperCase();
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const httpStatus = Number(status || error?.status) || null;
  if (code.includes('ENV') || code.includes('CONFIG')) return 'config_error';
  if (code.includes('SESSION') || code.includes('AUTH')) return 'auth_not_ready';
  if (httpStatus === 401) return 'auth_not_ready';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) return 'permission_denied';
  if (httpStatus === 403) return 'permission_denied';
  if (httpStatus === 400) return 'schema_error';
  if (code === 'PGRST204' || code === '42703' || code === '42P01' || message.includes('schema') || message.includes('column') || message.includes('relation')) return 'schema_error';
  if (isNetworkError(error) || message.includes('network')) return 'network_error';
  return 'unknown';
}

function emitCloudSaveState({ table, action, syncStatus, code, message, session, cloudConfigured }) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('herdon-cloud-save-state', {
    detail: {
      table: table || null,
      action: action || null,
      syncStatus: syncStatus || 'local_only',
      code: code || 'unknown',
      message: message || '',
      checkedAt: Date.now(),
      cloudConfigured: Boolean(cloudConfigured),
      sessionPresent: Boolean(session),
      userIdPresent: Boolean(getSessionUserId(session)),
    },
  }));
}

function logCloudRuntime(event = {}, level = 'debug') {
  if (!import.meta.env.DEV) return;
  const logger = level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_CLOUD_RUNTIME]', {
    hasSession: Boolean(event.hasSession),
    hasUserId: Boolean(event.hasUserId),
    envReady: Boolean(event.envReady),
    dataSource: event.dataSource || null,
    cloudStatus: event.cloudStatus || null,
    pendingCount: Number(event.pendingCount || 0),
    syncStatus: event.syncStatus || null,
    code: event.code || null,
  });
}

function readPendingSyncQueue() {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingSyncQueue(queue) {
  try {
    localStorage.setItem(PENDING_SYNC_QUEUE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
  } catch {
    // noop
  }
}

function removePendingSyncItems(matcher) {
  const queue = readPendingSyncQueue();
  const next = queue.filter((item) => !matcher(item));
  if (next.length !== queue.length) {
    writePendingSyncQueue(next);
    emitPendingSyncState(next, 'cleanup');
  }
}

function buildQueueFingerprint(item) {
  const selectorType = item?.selector?.type || '';
  const selectorValue = item?.selector?.value || item?.selector?.identityKey || '';
  const target = `${item?.table || ''}:${item?.action || ''}:${item?.cloudId || ''}:${item?.localId || ''}:${selectorType}:${selectorValue}`;
  return target.toLowerCase();
}

function emitPendingSyncState(queue = [], reason = 'updated') {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(AUTO_RETRY_EVENT, {
    detail: {
      pendingCount: Array.isArray(queue) ? queue.length : 0,
      reason,
      checkedAt: Date.now(),
    },
  }));
}

function enqueuePendingSync(item = {}) {
  const current = readPendingSyncQueue();
  const nextItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    table: item.table || null,
    action: item.action || null,
    localId: item.localId ?? null,
    cloudId: item.cloudId ?? null,
    payload: isObject(item.payload) ? item.payload : {},
    selector: isObject(item.selector) ? item.selector : null,
    createdAt: item.createdAt || new Date().toISOString(),
    lastAttemptAt: item.lastAttemptAt || null,
    retryCount: Number(item.retryCount || 0),
    code: item.code || 'unknown',
    message: item.message || 'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.',
  };
  const fingerprint = buildQueueFingerprint(nextItem);
  const deduped = current.filter((queued) => buildQueueFingerprint(queued) !== fingerprint);
  const queue = [...deduped, nextItem];
  writePendingSyncQueue(queue);
  emitPendingSyncState(queue, 'enqueue');
  return nextItem;
}

export function getPendingSyncQueueSnapshot() {
  const queue = readPendingSyncQueue();
  const schemaErrorTables = [...new Set(
    queue
      .filter((item) => String(item?.code || '').includes('schema_error'))
      .map((item) => String(item?.table || '').trim())
      .filter(Boolean)
  )];
  return {
    queue,
    pendingCount: queue.length,
    schemaErrorTables,
    checkedAt: Date.now(),
  };
}

const EXPECTED_SCHEMA_TABLES = Object.freeze([
  'fazendas',
  'lotes',
  'animais',
  'pesagens',
  'movimentacoes_animais',
  'movimentacoes_financeiras',
  'estoque',
  'sanitario',
  'tarefas',
  'funcionarios',
  'profiles',
  'invites',
  'alertas_resolvidos',
  'alertas_adiados',
]);

function registerSchemaDebugHelpers() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  if (window.HERDON_SCHEMA_DEBUG) return;
  window.HERDON_SCHEMA_DEBUG = {
    getPendingSchemaErrors() {
      return getPendingSyncQueueSnapshot().schemaErrorTables;
    },
    getExpectedTables() {
      return [...EXPECTED_SCHEMA_TABLES];
    },
  };
}

registerSchemaDebugHelpers();

export async function ensureSupabaseRequestReadiness(session, context = {}) {
  const envStatus = getSupabaseEnvStatus();
  if (!envStatus.configured) {
    logOperationalSync({
      stage: 'env_missing',
      ...context,
      envConfigured: false,
    }, 'warn');
    return {
      ok: false,
      code: 'SUPABASE_ENV_MISSING',
      message: envStatus.message || 'ConfiguraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da nuvem ausente neste ambiente.',
    };
  }

  const sessionUserId = getSessionUserId(session);
  if (!sessionUserId) {
    logOperationalSync({
      stage: 'session_missing',
      ...context,
      hasSessionUser: false,
      envConfigured: true,
    }, 'warn');
    return {
      ok: false,
      code: 'SESSION_MISSING',
      message: 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.',
    };
  }

  try {
    const validated = await validateSupabaseSessionForCloud();
    const activeSession = validated?.session ?? null;
    const activeUserId = activeSession?.user?.id || null;
    const hasAccessToken = Boolean(activeSession?.access_token);
    if (!validated?.ok || !activeUserId || !hasAccessToken || String(activeUserId) !== String(sessionUserId)) {
      if (!validated?.ok && import.meta.env.DEV) {
        console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
          hasSession: Boolean(validated?.authState?.hasSession),
          hasAccessToken: Boolean(validated?.authState?.hasAccessToken),
          tokenLooksJwt: Boolean(validated?.authState?.tokenLooksJwt),
          tokenExpired: Boolean(validated?.authState?.tokenExpired),
          refreshAttempted: Boolean(validated?.authState?.refreshAttempted),
          refreshSucceeded: Boolean(validated?.authState?.refreshSucceeded),
          safeMessage: validated?.safeMessage || 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.',
        });
      }
      logOperationalSync({
        stage: 'session_stale',
        ...context,
        hasSessionUser: true,
        hasAccessToken,
        envConfigured: true,
      }, 'warn');
      return {
        ok: false,
        code: validated?.code || 'SESSION_STALE',
        message: validated?.safeMessage || 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.',
      };
    }
    return {
      ok: true,
      code: null,
      message: null,
      activeSession,
    };
  } catch (error) {
    logOperationalSync({
      stage: 'session_read_error',
      ...context,
      hasSessionUser: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
    }, 'warn');
    return {
      ok: false,
      code: 'SESSION_READ_ERROR',
      message: classifyOperationalError(error, 'Falha ao validar sessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o com a nuvem. Seus dados locais continuam disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis.', context?.table || null),
    };
  }
}

function buildFallback(message, data = null, code = 'LOCAL_FALLBACK', syncStatus = 'local_only') {
  return {
    persisted: false,
    data,
    error: message,
    syncStatus,
    code,
  };
}

function notifyCloudHealthy(message = 'Nuvem ativa com salvamento confirmado.') {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('herdon-cloud-diagnostic-state', {
    detail: {
      verified: true,
      checkedAt: Date.now(),
      message,
    },
  }));
}

function sanitizeRecord(record = {}) {
  if (!record || typeof record !== 'object') return {};
  const { owner_user_id: _ignoredOwner, ...safeRecord } = record;
  return safeRecord;
}
function buildFazendaIdentityKey(record = {}) {
  const nome = toNullableString(record?.nome)?.toLowerCase() || '';
  const cidade = toNullableString(record?.cidade)?.toLowerCase() || '';
  const estado = toNullableString(record?.estado)?.toLowerCase() || '';
  return `${nome}|${cidade}|${estado}`;
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function buildAlertResolvedPayload(record, userId) {
  const safe = sanitizeRecord(record);
  const chave = String(safe?.chave || safe?.ackKey || safe?.id || '').trim();
  const payload = {
    chave,
    ack_key: chave || null,
    resolved_at: toIsoDate(safe?.resolvedAt),
    origem: String(safe?.origem || 'app_header').trim() || 'app_header',
    metadata: isObject(safe?.metadata)
      ? safe.metadata
      : {
          local_id: safe?.id ?? null,
          source: 'herdon_alert_resolve',
        },
  };
  if (!payload.chave) return null;
  if (tableSupportsCreatedAt('alertas_resolvidos')) {
    payload.created_at = toIsoDate(safe?.created_at);
    payload.updated_at = toIsoDate(safe?.updated_at);
  }
  if (tableSupportsOwnerScope('alertas_resolvidos') && userId) {
    payload.owner_user_id = userId;
  }
  return payload;
}

function buildAlertSnoozedPayload(record, userId) {
  const safe = sanitizeRecord(record);
  const chave = String(safe?.chave || safe?.ackKey || safe?.id || '').trim();
  const ateRaw = String(safe?.ate || safe?.snoozeUntil || '').trim();
  const ate = ateRaw ? toIsoDate(ateRaw) : '';
  if (!chave || !ate) return null;
  const payload = {
    chave,
    ate,
    snooze_until: ate,
    origem: String(safe?.origem || 'app_header').trim() || 'app_header',
    metadata: isObject(safe?.metadata)
      ? safe.metadata
      : {
          local_id: safe?.id ?? null,
          source: 'herdon_alert_snooze',
        },
  };
  if (tableSupportsCreatedAt('alertas_adiados')) {
    payload.created_at = toIsoDate(safe?.created_at);
    payload.updated_at = toIsoDate(safe?.updated_at);
  }
  if (tableSupportsOwnerScope('alertas_adiados') && userId) {
    payload.owner_user_id = userId;
  }
  return payload;
}

function buildOperationalCreatePayload(table, record, userId) {
  const normalizedTable = String(table || '').toLowerCase();
  if (normalizedTable === 'alertas_resolvidos') {
    return buildAlertResolvedPayload(record, userId);
  }
  if (normalizedTable === 'alertas_adiados') {
    return buildAlertSnoozedPayload(record, userId);
  }
  if (normalizedTable === 'fazendas') {
    const safe = sanitizeRecord(record);
    const nome = toNullableString(safe?.nome);
    if (!nome) return null;
    const localId = safe?.id ?? null;
    const cloudUuid = normalizeCloudUuid(safe?.cloud_id ?? safe?.metadata?.cloud_id);
    const metadata = {
      ...(isObject(safe?.metadata) ? safe.metadata : {}),
      local_id: localId,
      source: 'herdon_fazendas_create',
    };
    const payload = {
      nome,
      proprietario: toNullableString(safe?.proprietario),
      responsavel: toNullableString(safe?.responsavel),
      cidade: toNullableString(safe?.cidade),
      estado: toNullableString(safe?.estado),
      area_total_ha: toNullableNumber(safe?.area_total_ha),
      area_pastagem_ha: toNullableNumber(safe?.area_pastagem_ha),
      capacidade_ua: toNullableNumber(safe?.capacidade_ua),
      tipo_producao: toNullableString(safe?.tipo_producao),
      inscricao_estadual: toNullableString(safe?.inscricao_estadual),
      cnpj_cpf: toNullableString(safe?.cnpj_cpf),
      telefone: toNullableString(safe?.telefone),
      email: toNullableString(safe?.email),
      endereco: toNullableString(safe?.endereco),
      status: toNullableString(safe?.status) || 'ativa',
      observacoes: toNullableString(safe?.observacoes),
      metadata,
      hectares: toNullableNumber(safe?.hectares),
      area: toNullableNumber(safe?.area),
      hectares_pastagem: toNullableNumber(safe?.hectares_pastagem),
      capacidade_lotacao: toNullableNumber(safe?.capacidade_lotacao),
      synced_from: toNullableString(safe?.synced_from) || 'herdon_app',
    };
    if (cloudUuid) {
      payload.cloud_id = cloudUuid;
    }
    // bigint `id` is generated by Supabase; never send local `id` in create payload.
    delete payload.id;
    if (tableSupportsMetadata('fazendas')) {
      payload.metadata = isObject(payload.metadata) ? payload.metadata : {};
    } else {
      delete payload.metadata;
    }
    payload.owner_user_id = userId || null;
    return payload;
  }
  if (normalizedTable === 'estoque') {
    const safe = sanitizeRecord(record);
    const localId = safe?.id ?? safe?.metadata?.local_id ?? null;
    const payload = {
      nome: toNullableString(safe?.nome),
      categoria: toNullableString(safe?.categoria),
      unidade: toNullableString(safe?.unidade),
      quantidade: toNullableNumber(safe?.quantidade),
      quantidade_minima: toNullableNumber(safe?.quantidade_minima),
      custo_unitario: toNullableNumber(safe?.custo_unitario),
      valor_total: toNullableNumber(safe?.valor_total),
      validade: toNullableDateString(safe?.validade),
      fornecedor: toNullableString(safe?.fornecedor),
      observacoes: toNullableString(safe?.observacoes),
      metadata: isObject(safe?.metadata) ? { ...safe.metadata, local_id: localId } : { local_id: localId },
    };
    if (tableSupportsOwnerScope('estoque') && userId) payload.owner_user_id = userId;
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  }
  if (normalizedTable === 'pesagens') {
    const safe = sanitizeRecord(record);
    const cloudUuid = normalizeCloudUuid(safe?.cloud_id ?? safe?.metadata?.cloud_id);
    const metadata = isObject(safe?.metadata) ? { ...safe.metadata } : {};
    if (!Object.prototype.hasOwnProperty.call(metadata, 'local_id')) {
      metadata.local_id = safe?.id ?? null;
    }
    const payload = {
      owner_user_id: userId || null,
      lote_id: toNullableNumber(safe?.lote_id),
      animal_id: toNullableId(safe?.animal_id),
      data: toNullableDateString(safe?.data ?? safe?.data_pesagem),
      peso_medio: toNullableNumber(safe?.peso_medio ?? safe?.peso ?? safe?.peso_kg),
      tipo: toNullableString(safe?.tipo),
      origem: toNullableString(safe?.origem),
      rendimento_carcaca: toNullableNumber(safe?.rendimento_carcaca),
      preco_arroba: toNullableNumber(safe?.preco_arroba),
      observacao: toNullableString(safe?.observacao),
      metadata,
      cloud_id: cloudUuid || undefined,
    };
    delete payload.id;
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  }
  if (normalizedTable === 'animais') {
    const safe = sanitizeRecord(record);
    const cloudUuid = normalizeCloudUuid(safe?.cloud_id ?? safe?.metadata?.cloud_id);
    const metadata = isObject(safe?.metadata) ? { ...safe.metadata } : {};
    if (!Object.prototype.hasOwnProperty.call(metadata, 'local_id')) {
      metadata.local_id = safe?.id ?? null;
    }
    const payload = {
      owner_user_id: userId || null,
      lote_id: toNullableNumber(safe?.lote_id),
      identificacao: toNullableString(safe?.identificacao ?? safe?.nome),
      tipo_registro: toNullableString(safe?.tipo_registro),
      qtd: toNullableNumber(safe?.qtd ?? safe?.quantidade),
      status: toNullableString(safe?.status),
      p_ini: toNullableNumber(safe?.p_ini),
      p_at: toNullableNumber(safe?.p_at),
      metadata,
      cloud_id: cloudUuid || undefined,
    };
    delete payload.id;
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  }
  if (normalizedTable === 'lotes') {
    const safe = sanitizeRecord(record);
    const cloudUuid = normalizeCloudUuid(safe?.cloud_id ?? safe?.metadata?.cloud_id);
    const metadataBase = isObject(safe?.metadata) ? { ...safe.metadata } : {};
    if (!Object.prototype.hasOwnProperty.call(metadataBase, 'local_id')) {
      metadataBase.local_id = safe?.id ?? null;
    }
    const metadata = buildLotePlanningMetadata(safe, metadataBase);
    const payload = {
      owner_user_id: userId || null,
      nome: toNullableString(safe?.nome),
      faz_id: toNullableNumber(safe?.faz_id),
      entrada: toNullableDateString(safe?.entrada),
      saida: toNullableDateString(safe?.saida),
      status: toNullableString(safe?.status),
      tipo: toNullableString(safe?.tipo),
      sistema: toNullableString(safe?.sistema),
      gmd_meta: toNullableNumber(safe?.gmd_meta),
      preco_arroba: toNullableNumber(safe?.preco_arroba),
      rendimento_carcaca: toNullableNumber(safe?.rendimento_carcaca),
      investimento: toNullableNumber(safe?.investimento),
      peso_alvo: toNullableNumber(safe?.peso_alvo),
      obs: toNullableString(safe?.obs),
      p_ini: toNullableNumber(safe?.p_ini),
      p_at: toNullableNumber(safe?.p_at),
      ultima_pesagem: toNullableDateString(safe?.ultima_pesagem),
      data_saida: toNullableDateString(safe?.data_saida),
      fechamento: isObject(safe?.fechamento) ? safe.fechamento : null,
      metadata,
      cloud_id: cloudUuid || undefined,
    };
    delete payload.id;
    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  }
  const safe = sanitizeRecord(record);
  if (tableSupportsOwnerScope(normalizedTable)) {
    return {
      ...safe,
      owner_user_id: userId,
    };
  }
  return safe;
}

function buildOperationalUpdatePayload(table, patch, userId) {
  const safe = sanitizeRecord(patch);
  const payload = buildOperationalCreatePayload(table, safe, userId);
  if (!payload || typeof payload !== 'object') return payload;
  return payload;
}

async function tryInsertPayloadVariants(table, payloadOrVariants) {
  const variants = Array.isArray(payloadOrVariants) ? payloadOrVariants : [payloadOrVariants];
  let lastError = null;
  for (let index = 0; index < variants.length; index += 1) {
    const payload = variants[index];
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select('*')
      .single();
    if (!error) {
      return { data, error: null };
    }
    lastError = error;
    if (isOwnerColumnSchemaError(error)) {
      updateTableCapability(table, { ownerScope: false });
    }
    if (String(table || '').toLowerCase() === 'fazendas' && isCreatedAtSchemaError(error)) {
      updateTableCapability(table, { createdAt: false });
    }
  }
  return { data: null, error: lastError };
}

function pruneKeys(payload, keys = []) {
  const next = { ...(payload || {}) };
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) delete next[key];
  });
  return next;
}

function buildAdaptiveVariants(table, payload = {}) {
  const normalizedTable = String(table || '').toLowerCase();
  const variants = [];
  const pushVariant = (nextPayload, removedKeys = []) => {
    variants.push({
      payload: Object.fromEntries(Object.entries(nextPayload || {}).filter(([, value]) => value !== undefined)),
      removedKeys,
    });
  };

  pushVariant(payload, []);
  if (normalizedTable === 'animais') {
    const v1 = pruneKeys(payload, ['owner_user_id']);
    pushVariant(v1, ['owner_user_id']);
    const v2 = pruneKeys(v1, ['cloud_id']);
    pushVariant(v2, ['owner_user_id', 'cloud_id']);
    const v3 = pruneKeys(v2, ['metadata']);
    pushVariant(v3, ['owner_user_id', 'cloud_id', 'metadata']);
    const v4 = {
      lote_id: v3.lote_id,
      identificacao: v3.identificacao,
      tipo_registro: v3.tipo_registro,
      qtd: v3.qtd,
      status: v3.status,
      p_ini: v3.p_ini,
      p_at: v3.p_at,
    };
    pushVariant(v4, ['owner_user_id', 'cloud_id', 'metadata', 'minimal']);
  } else if (normalizedTable === 'pesagens') {
    const v1 = pruneKeys(payload, ['owner_user_id']);
    pushVariant(v1, ['owner_user_id']);
    const v2 = pruneKeys(v1, ['cloud_id']);
    pushVariant(v2, ['owner_user_id', 'cloud_id']);
    const v3 = pruneKeys(v2, ['metadata']);
    pushVariant(v3, ['owner_user_id', 'cloud_id', 'metadata']);
    const v4 = pruneKeys(v3, ['origem']);
    pushVariant(v4, ['owner_user_id', 'cloud_id', 'metadata', 'origem']);
    const v5 = pruneKeys(v4, ['rendimento_carcaca']);
    pushVariant(v5, ['owner_user_id', 'cloud_id', 'metadata', 'origem', 'rendimento_carcaca']);
    const v6 = pruneKeys(v5, ['preco_arroba']);
    pushVariant(v6, ['owner_user_id', 'cloud_id', 'metadata', 'origem', 'rendimento_carcaca', 'preco_arroba']);
    const v7 = {
      lote_id: v6.lote_id,
      animal_id: v6.animal_id,
      data: v6.data,
      tipo: v6.tipo,
      peso_medio: v6.peso_medio,
      observacao: v6.observacao,
    };
    pushVariant(v7, ['owner_user_id', 'cloud_id', 'metadata', 'origem', 'rendimento_carcaca', 'preco_arroba', 'minimal']);
  } else if (normalizedTable === 'lotes') {
    const v1 = pruneKeys(payload, ['owner_user_id']);
    pushVariant(v1, ['owner_user_id']);
    const v2 = pruneKeys(v1, ['cloud_id']);
    pushVariant(v2, ['owner_user_id', 'cloud_id']);
    const v3 = pruneKeys(v2, ['metadata']);
    pushVariant(v3, ['owner_user_id', 'cloud_id', 'metadata']);
    const v4 = pruneKeys(v3, ['fechamento', 'ultima_pesagem', 'data_saida']);
    pushVariant(v4, ['owner_user_id', 'cloud_id', 'metadata', 'fechamento', 'ultima_pesagem', 'data_saida']);
    const v5 = pruneKeys(v4, ['investimento', 'peso_alvo', 'rendimento_carcaca']);
    pushVariant(v5, ['owner_user_id', 'cloud_id', 'metadata', 'fechamento', 'ultima_pesagem', 'data_saida', 'investimento', 'peso_alvo', 'rendimento_carcaca']);
    const v6 = {
      nome: v5.nome,
      faz_id: v5.faz_id,
      entrada: v5.entrada,
      saida: v5.saida,
      status: v5.status,
      tipo: v5.tipo,
      sistema: v5.sistema,
      gmd_meta: v5.gmd_meta,
      preco_arroba: v5.preco_arroba,
      obs: v5.obs,
      p_ini: v5.p_ini,
      p_at: v5.p_at,
    };
    pushVariant(v6, ['owner_user_id', 'cloud_id', 'metadata', 'fechamento', 'ultima_pesagem', 'data_saida', 'investimento', 'peso_alvo', 'rendimento_carcaca', 'minimal']);
  } else if (normalizedTable === 'alertas_resolvidos') {
    const v1 = pruneKeys(payload, ['owner_user_id']);
    pushVariant(v1, ['owner_user_id']);
    const v2 = pruneKeys(v1, ['metadata']);
    pushVariant(v2, ['owner_user_id', 'metadata']);
    const v3 = pruneKeys(v2, ['ack_key']);
    pushVariant(v3, ['owner_user_id', 'metadata', 'ack_key']);
    const v4 = pruneKeys(v3, ['origem']);
    pushVariant(v4, ['owner_user_id', 'metadata', 'ack_key', 'origem']);
    const v5 = { chave: v4.chave, resolved_at: v4.resolved_at };
    pushVariant(v5, ['owner_user_id', 'metadata', 'ack_key', 'origem', 'minimal']);
  }

  const seen = new Set();
  return variants.filter((variant) => {
    const key = JSON.stringify(Object.keys(variant.payload || {}).sort());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function findExistingFazendaRecord(payload, userId) {
  const cloudId = normalizeCloudUuid(payload?.cloud_id ?? payload?.metadata?.cloud_id);
  const localId = payload?.metadata?.local_id ?? null;
  const identityKey = buildFazendaIdentityKey(payload);
  let query = supabase.from('fazendas').select('*').limit(50);
  if (tableSupportsOwnerScope('fazendas') && userId) {
    query = query.eq('owner_user_id', userId);
  }
  const { data, error } = await query;
  if (error) return { data: null, error };
  const rows = Array.isArray(data) ? data : [];
  const match = rows.find((row) => {
    if (cloudId && String(row?.id) === String(cloudId)) return true;
    if (localId && String(row?.metadata?.local_id || '') === String(localId)) return true;
    return buildFazendaIdentityKey(row) === identityKey && identityKey !== '||';
  });
  return { data: match || null, error: null };
}

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeMetadata(metadata, localId) {
  const base = isObject(metadata) ? { ...metadata } : {};
  base.local_id = localId ?? null;
  base.synced_from = 'herdon_manual_fazendas_sync';
  base.synced_at = new Date().toISOString();
  return base;
}

function sanitizeMetadataForModule(metadata, localId, syncedFrom) {
  const base = isObject(metadata) ? { ...metadata } : {};
  base.local_id = localId ?? null;
  base.synced_from = syncedFrom;
  base.synced_at = new Date().toISOString();
  return base;
}

function buildLotePlanningMetadata(safe = {}, metadata = {}) {
  return {
    ...metadata,
    planejamento_lote: {
      qtd: toNullableNumber(safe?.qtd),
      p_ini: toNullableNumber(safe?.p_ini),
      p_at: toNullableNumber(safe?.p_at),
      peso_alvo: toNullableNumber(safe?.peso_alvo),
      dias_estimados: toNullableNumber(safe?.dias_estimados),
      consumo_tipo: toNullableString(safe?.consumo_tipo),
      consumo_por_cabeca_dia: toNullableNumber(safe?.consumo_por_cabeca_dia),
      consumo_total_estimado: toNullableNumber(safe?.consumo_total_estimado),
      custo_total_estimado: toNullableNumber(safe?.custo_total_estimado),
      preco_kg: toNullableNumber(safe?.preco_kg ?? safe?.supl_rkg),
      supl_nome: toNullableString(safe?.supl_nome),
      supl_rkg: toNullableNumber(safe?.supl_rkg ?? safe?.preco_kg),
      supl_pv_pct: toNullableNumber(safe?.supl_pv_pct),
      supl_meta_dias: toNullableNumber(safe?.supl_meta_dias),
      saida: toNullableDateString(safe?.saida),
      preco_arroba: toNullableNumber(safe?.preco_arroba),
    },
  };
}

function hydrateLotePlanningFields(row = {}) {
  const planning = isObject(row?.metadata?.planejamento_lote) ? row.metadata.planejamento_lote : {};
  return {
    ...row,
    qtd: row?.qtd ?? planning?.qtd ?? 0,
    p_ini: row?.p_ini ?? planning?.p_ini ?? null,
    p_at: row?.p_at ?? planning?.p_at ?? planning?.p_ini ?? null,
    peso_alvo: row?.peso_alvo ?? planning?.peso_alvo ?? null,
    dias_estimados: row?.dias_estimados ?? planning?.dias_estimados ?? null,
    consumo_tipo: row?.consumo_tipo ?? planning?.consumo_tipo ?? null,
    consumo_por_cabeca_dia: row?.consumo_por_cabeca_dia ?? planning?.consumo_por_cabeca_dia ?? null,
    consumo_total_estimado: row?.consumo_total_estimado ?? planning?.consumo_total_estimado ?? null,
    custo_total_estimado: row?.custo_total_estimado ?? planning?.custo_total_estimado ?? null,
    preco_kg: row?.preco_kg ?? planning?.preco_kg ?? null,
    supl_nome: row?.supl_nome ?? planning?.supl_nome ?? null,
    supl_rkg: row?.supl_rkg ?? planning?.supl_rkg ?? planning?.preco_kg ?? null,
    supl_pv_pct: row?.supl_pv_pct ?? planning?.supl_pv_pct ?? null,
    supl_meta_dias: row?.supl_meta_dias ?? planning?.supl_meta_dias ?? planning?.dias_estimados ?? null,
    saida: row?.saida ?? planning?.saida ?? null,
    preco_arroba: row?.preco_arroba ?? planning?.preco_arroba ?? null,
  };
}

function toNullableDateString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeCloudUuid(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(text) ? text : null;
}

function mapFazendaToCloudPayload(localRow, userId) {
  const safe = sanitizeRecord(localRow);
  const localId = safe?.id ?? null;
  const metadata = sanitizeMetadata(safe?.metadata, localId);

  const payload = {
    owner_user_id: userId,
    nome: toNullableString(safe?.nome),
    proprietario: toNullableString(safe?.proprietario ?? safe?.responsavel),
    cidade: toNullableString(safe?.cidade),
    estado: toNullableString(safe?.estado),
    area_total_ha: toNullableNumber(safe?.area_total_ha ?? safe?.hectares ?? safe?.area),
    area_pastagem_ha: toNullableNumber(safe?.area_pastagem_ha ?? safe?.hectares_pastagem),
    capacidade_ua: toNullableNumber(safe?.capacidade_ua ?? safe?.capacidade_lotacao),
    tipo_producao: toNullableString(safe?.tipo_producao),
    inscricao_estadual: toNullableString(safe?.inscricao_estadual),
    cnpj_cpf: toNullableString(safe?.cnpj_cpf),
    telefone: toNullableString(safe?.telefone),
    email: toNullableString(safe?.email),
    endereco: toNullableString(safe?.endereco),
    status: toNullableString(safe?.status),
    observacoes: toNullableString(safe?.observacoes ?? safe?.observacao ?? safe?.obs),
    metadata,
  };

  return {
    localId,
    payload: Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ),
  };
}

function mapLoteToCloudPayload(localRow, userId) {
  const safe = sanitizeRecord(localRow);
  const localId = safe?.id ?? null;
  const metadata = buildLotePlanningMetadata(
    safe,
    sanitizeMetadataForModule(safe?.metadata, localId, 'herdon_manual_lotes_sync')
  );
  const cloudUuid = normalizeCloudUuid(safe?.cloud_id ?? safe?.metadata?.cloud_id);
  if (cloudUuid) {
    metadata.cloud_id = cloudUuid;
  }

  const payload = {
    owner_user_id: userId,
    nome: toNullableString(safe?.nome),
    faz_id: toNullableNumber(safe?.faz_id),
    entrada: toNullableDateString(safe?.entrada),
    saida: toNullableDateString(safe?.saida),
    status: toNullableString(safe?.status),
    tipo: toNullableString(safe?.tipo),
    sistema: toNullableString(safe?.sistema),
    gmd_meta: toNullableNumber(safe?.gmd_meta),
    preco_arroba: toNullableNumber(safe?.preco_arroba),
    rendimento_carcaca: toNullableNumber(safe?.rendimento_carcaca),
    investimento: toNullableNumber(safe?.investimento),
    peso_alvo: toNullableNumber(safe?.peso_alvo),
    raca: toNullableString(safe?.raca),
    sexo: toNullableString(safe?.sexo),
    categoria: toNullableString(safe?.categoria),
    obs: toNullableString(safe?.obs),
    p_ini: toNullableNumber(safe?.p_ini),
    p_at: toNullableNumber(safe?.p_at),
    ultima_pesagem: toNullableDateString(safe?.ultima_pesagem),
    data_saida: toNullableDateString(safe?.data_saida),
    fechamento: isObject(safe?.fechamento) ? safe.fechamento : null,
    metadata,
    cloud_id: cloudUuid,
  };

  return {
    localId,
    payload: Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    ),
  };
}

function getCloudIdMarker(localRow) {
  if (!localRow || typeof localRow !== 'object') return null;
  const metadataCloudId = localRow?.metadata?.cloud_id;
  if (metadataCloudId !== undefined && metadataCloudId !== null && metadataCloudId !== '') {
    return metadataCloudId;
  }
  const externalCloudId = localRow?.cloud_id;
  if (externalCloudId !== undefined && externalCloudId !== null && externalCloudId !== '') {
    return externalCloudId;
  }
  return null;
}

function mergeFazendasSafe(localRows = [], remoteRows = []) {
  const merged = [];
  const usedRemoteIndexes = new Set();

  const findRemoteMatch = (localRow) => {
    const localIdText = localRow?.id !== undefined && localRow?.id !== null
      ? String(localRow.id)
      : null;
    const cloudId = getCloudIdMarker(localRow);

    for (let index = 0; index < remoteRows.length; index += 1) {
      if (usedRemoteIndexes.has(index)) continue;
      const remote = remoteRows[index];
      const remoteIdText = remote?.id !== undefined && remote?.id !== null ? String(remote.id) : null;
      const remoteLocalIdText = remote?.metadata?.local_id !== undefined && remote?.metadata?.local_id !== null
        ? String(remote.metadata.local_id)
        : null;

      if (cloudId !== null && remoteIdText === String(cloudId)) return index;
      if (localIdText && remoteLocalIdText && localIdText === remoteLocalIdText) return index;
      if (localIdText && remoteIdText && localIdText === remoteIdText) return index;
    }

    return -1;
  };

  localRows.forEach((localRow) => {
    const remoteIndex = findRemoteMatch(localRow);
    if (remoteIndex === -1) {
      merged.push(localRow);
      return;
    }
    usedRemoteIndexes.add(remoteIndex);
    const remote = remoteRows[remoteIndex];
    merged.push({
      ...localRow,
      ...remote,
      metadata: {
        ...(isObject(localRow?.metadata) ? localRow.metadata : {}),
        ...(isObject(remote?.metadata) ? remote.metadata : {}),
        cloud_id: remote?.id ?? (remote?.metadata?.cloud_id ?? null),
      },
    });
  });

  remoteRows.forEach((remote, index) => {
    if (!usedRemoteIndexes.has(index)) {
      merged.push(remote);
    }
  });

  return merged;
}

function mergeLotesSafe(localRows = [], remoteRows = []) {
  const merged = [];
  const usedRemoteIndexes = new Set();

  const findRemoteMatch = (localRow) => {
    const localIdText = localRow?.id !== undefined && localRow?.id !== null
      ? String(localRow.id)
      : null;
    const cloudId = getCloudIdMarker(localRow);

    for (let index = 0; index < remoteRows.length; index += 1) {
      if (usedRemoteIndexes.has(index)) continue;
      const remote = remoteRows[index];
      const remoteIdText = remote?.id !== undefined && remote?.id !== null ? String(remote.id) : null;
      const remoteLocalIdText = remote?.metadata?.local_id !== undefined && remote?.metadata?.local_id !== null
        ? String(remote.metadata.local_id)
        : null;
      const remoteCloudId = remote?.cloud_id !== undefined && remote?.cloud_id !== null ? String(remote.cloud_id) : null;

      if (cloudId !== null && remoteIdText === String(cloudId)) return index;
      if (cloudId !== null && remoteCloudId && remoteCloudId === String(cloudId)) return index;
      if (localIdText && remoteLocalIdText && localIdText === remoteLocalIdText) return index;
      if (localIdText && remoteIdText && localIdText === remoteIdText) return index;
    }

    return -1;
  };

  localRows.forEach((localRow) => {
    const remoteIndex = findRemoteMatch(localRow);
    if (remoteIndex === -1) {
      merged.push(hydrateLotePlanningFields(localRow));
      return;
    }
    usedRemoteIndexes.add(remoteIndex);
    const remote = remoteRows[remoteIndex];
    merged.push(hydrateLotePlanningFields({
      ...localRow,
      ...remote,
      metadata: {
        ...(isObject(localRow?.metadata) ? localRow.metadata : {}),
        ...(isObject(remote?.metadata) ? remote.metadata : {}),
        cloud_id: remote?.cloud_id ?? remote?.id ?? (remote?.metadata?.cloud_id ?? null),
      },
    }));
  });

  remoteRows.forEach((remote, index) => {
    if (!usedRemoteIndexes.has(index)) {
      merged.push(hydrateLotePlanningFields(remote));
    }
  });

  return merged;
}

function sanitizeAuditDetails(input) {
  if (Array.isArray(input)) {
    return input.map(sanitizeAuditDetails);
  }
  if (!input || typeof input !== 'object') {
    return input;
  }

  return Object.entries(input).reduce((acc, [key, value]) => {
    const keyNormalized = String(key || '').toLowerCase();
    if (
      keyNormalized.includes('password')
      || keyNormalized.includes('token')
      || keyNormalized.includes('secret')
      || keyNormalized.includes('service_role')
    ) {
      return acc;
    }
    acc[key] = sanitizeAuditDetails(value);
    return acc;
  }, {});
}

export async function createOperationalRecord(table, record, session, options = {}) {
  const runtimeContext = {
    hasSession: Boolean(session),
    hasUserId: Boolean(getSessionUserId(session)),
    envReady: Boolean(getSupabaseEnvStatus()?.configured),
  };
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'create', table });
  if (!readiness.ok) {
    const isFazendas = String(table || '').toLowerCase() === 'fazendas';
    const fallbackMessage = (isFazendas && readiness.code === 'SESSION_MISSING')
      ? 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da nuvem nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada. FaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a login novamente para salvar na nuvem.'
      : 'Registro salvo localmente. Sincronizacao pendente.';
    const fallback = buildFallback(
      fallbackMessage,
      sanitizeRecord(record),
      readiness.code || 'CLOUD_NOT_READY',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    if (!options?.skipQueueOnFailure) {
      enqueuePendingSync({
        table,
        action: 'create',
        localId: sanitizeRecord(record)?.id ?? null,
        cloudId: sanitizeRecord(record)?.cloud_id ?? null,
        payload: sanitizeRecord(record),
        code: classifyCloudSaveCode(readiness.code),
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: readiness.code || 'CLOUD_NOT_READY',
    }, 'warn');
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const payload = buildOperationalCreatePayload(table, record, userId);
    if (String(table || '').toLowerCase() === 'fazendas') {
      const validation = validateFazendaCreatePayload(payload, session);
      if (!validation.ok) {
        const fallback = buildFallback(
          validation.safeMessage || 'Registro salvo localmente. Sincronizacao pendente.',
          sanitizeRecord(record),
          validation.code || 'PAYLOAD_INVALID',
          'pending_sync'
        );
        emitCloudSaveState({
          table,
          action: 'create',
          syncStatus: fallback.syncStatus,
          code: classifyCloudSaveCode(validation.code),
          message: fallback.error,
          session,
          cloudConfigured: validation.code !== 'SESSION_MISSING',
        });
        if (!options?.skipQueueOnFailure) {
          enqueuePendingSync({
            table,
            action: 'create',
            localId: sanitizeRecord(record)?.id ?? null,
            cloudId: sanitizeRecord(record)?.cloud_id ?? null,
            payload: sanitizeRecord(record),
            code: classifyCloudSaveCode(validation.code),
            message: fallback.error,
          });
        }
        logCloudRuntime({
          ...runtimeContext,
          cloudStatus: 'fallback',
          syncStatus: fallback.syncStatus,
          code: validation.code,
        }, 'warn');
        return fallback;
      }
    }
    if (!payload || typeof payload !== 'object') {
      const fallback = buildFallback(
        'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.',
        sanitizeRecord(record),
        'PAYLOAD_INCOMPATIBLE',
        'pending_sync'
      );
        emitCloudSaveState({
        table,
        action: 'create',
        syncStatus: fallback.syncStatus,
        code: 'schema_error',
        message: fallback.error,
        session,
        cloudConfigured: true,
        });
        if (!options?.skipQueueOnFailure) {
          enqueuePendingSync({
            table,
            action: 'create',
            localId: sanitizeRecord(record)?.id ?? null,
            cloudId: sanitizeRecord(record)?.cloud_id ?? null,
            payload: sanitizeRecord(record),
            code: 'schema_error',
            message: fallback.error,
          });
        }
        logCloudRuntime({
          ...runtimeContext,
          cloudStatus: 'fallback',
          syncStatus: fallback.syncStatus,
          code: 'PAYLOAD_INCOMPATIBLE',
        }, 'warn');
        return fallback;
      }
    if (String(table || '').toLowerCase() === 'fazendas') {
      const existing = await findExistingFazendaRecord(payload, userId);
      if (existing?.error) throw existing.error;
      if (existing?.data) {
        notifyCloudHealthy('Registro jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ existente na nuvem.');
        return { persisted: true, data: existing.data, error: null, syncStatus: 'cloud_success', code: null };
      }
    }
    let data = null;
    let error = null;
    const adaptiveVariants = buildAdaptiveVariants(table, payload);
    for (const variant of (adaptiveVariants.length ? adaptiveVariants : [{ payload, removedKeys: [] }])) {
      const result = await tryInsertPayloadVariants(table, variant.payload);
      data = result?.data || null;
      error = result?.error || null;
      if (!error) break;
      if (isSchemaCompatibilityError(error)) {
        const safe = getSafeErrorDetails(error);
        logSupabase400Diagnostic({
          table,
          action: 'create',
          status: getHttpStatus(error),
          postgrestCode: getPostgrestCode(error),
          safeMessage: safe.safeMessage,
          details: safe.details,
          hint: safe.hint,
          payloadKeys: Object.keys(variant.payload || {}),
          removedKeys: variant.removedKeys || [],
        });
      } else {
        break;
      }
    }

    if (error) throw error;
    notifyCloudHealthy('Registro salvo na nuvem.');
    const metadataLocalId = sanitizeRecord(record)?.metadata?.local_id ?? null;
    removePendingSyncItems((item) => (
      String(item?.table || '') === String(table || '')
      && String(item?.action || '') === 'create'
      && (
        (metadataLocalId && String(item?.payload?.metadata?.local_id || '') === String(metadataLocalId))
        || (data?.id !== undefined && String(item?.payload?.id || '') === String(data.id))
      )
    ));
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'active',
      syncStatus: 'cloud_success',
      code: null,
    });
    return { persisted: true, data, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    const status = getHttpStatus(error);
    const safe = getSafeErrorDetails(error);
    const schemaIncompatible = isSchemaCompatibilityError(error);
    const classifiedCode = schemaIncompatible
      ? BLOCKED_SCHEMA_ERROR_CODE
      : classifyCloudSaveCode(error?.code, error, status);
    logOperationalSync({
      stage: 'create_error',
      requestStage: 'insert',
      action: 'create',
      table,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
      httpStatus: status,
      syncStatus: 'pending_sync',
      selectorType: null,
      payloadKeys: Object.keys(sanitizeRecord(record) || {}),
      safeMessage: safe.safeMessage || getErrorMessage(error),
      safeDetails: safe.details,
      safeHint: safe.hint,
    }, 'warn');
    if (schemaIncompatible) {
      logSupabase400Diagnostic({
        table,
        action: 'create',
        status,
        postgrestCode: getPostgrestCode(error),
        safeMessage: safe.safeMessage || getErrorMessage(error),
        details: safe.details,
        hint: safe.hint,
        payloadKeys: Object.keys(sanitizeRecord(record) || {}),
        removedKeys: [],
      });
    }
    const fallback = buildFallback(
      schemaIncompatible
        ? 'Estrutura da nuvem incompatÃƒÆ’Ã‚Â­vel com este registro. Registro mantido localmente.'
        : 'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.',
      sanitizeRecord(record),
      classifiedCode,
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    if (!options?.skipQueueOnFailure) {
      enqueuePendingSync({
        table,
        action: 'create',
        localId: sanitizeRecord(record)?.id ?? null,
        cloudId: sanitizeRecord(record)?.cloud_id ?? null,
        payload: sanitizeRecord(record),
        code: classifiedCode,
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
    }, 'warn');
    return fallback;
  }
}

function validateFazendaCreatePayload(payload = {}, session) {
  const hasSession = Boolean(session);
  const hasUserId = Boolean(getSessionUserId(session));
  const hasOwnerUserId = Boolean(payload?.owner_user_id);
  const hasNome = Boolean(String(payload?.nome ?? '').trim());
  const hasCloudIdKey = Object.prototype.hasOwnProperty.call(payload || {}, 'cloud_id');
  const cloudIdValid = !hasCloudIdKey || Boolean(normalizeCloudUuid(payload?.cloud_id));
  const cloudIdRemoved = !hasCloudIdKey;
  const payloadKeys = Object.keys(payload || {});
  let code = null;
  let safeMessage = null;

  if (!hasUserId || !hasOwnerUserId) {
    code = 'SESSION_MISSING';
    safeMessage = 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da nuvem nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada. FaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§a login novamente para salvar na nuvem.';
  } else if (!hasNome) {
    code = 'NOME_REQUIRED';
    safeMessage = 'Informe o nome da fazenda.';
  } else if (Object.prototype.hasOwnProperty.call(payload, 'id')) {
    code = 'INVALID_PAYLOAD_ID';
    safeMessage = 'Falha de validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do cadastro da fazenda.';
  } else if (hasCloudIdKey && !normalizeCloudUuid(payload?.cloud_id)) {
    code = 'INVALID_CLOUD_ID';
    safeMessage = 'Falha de validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do cadastro da fazenda.';
  } else if (!isObject(payload?.metadata)) {
    code = 'INVALID_METADATA';
    safeMessage = 'Falha de validaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do cadastro da fazenda.';
  }

  if (import.meta.env.DEV) {
    console.debug('[HERDON_FAZENDA_CLOUD_ID_PAYLOAD_CHECK]', {
      hasOwnerUserId,
      hasNome,
      hasCloudIdKey,
      cloudIdValid,
      cloudIdRemoved,
      payloadKeys,
      syncStatus: code ? 'pending_sync' : 'cloud_ready',
      code: code || null,
      safeMessage: safeMessage || null,
    });
    console.debug('[HERDON_FAZENDA_CREATE_PAYLOAD_CHECK]', {
      hasSession,
      hasUserId,
      hasOwnerUserId,
      hasNome,
      payloadKeys,
      syncStatus: code ? 'pending_sync' : 'cloud_ready',
      code: code || null,
      safeMessage: safeMessage || null,
    });
  }

  return { ok: !code, code, safeMessage };
}

export async function updateOperationalRecord(table, id, patch, session, options = {}) {
  const runtimeContext = {
    hasSession: Boolean(session),
    hasUserId: Boolean(getSessionUserId(session)),
    envReady: Boolean(getSupabaseEnvStatus()?.configured),
  };
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'update', table });
  if (!readiness.ok) {
    const fallback = buildFallback(
      'Registro salvo localmente. Sincronizacao pendente.',
      sanitizeRecord(patch),
      readiness.code || 'CLOUD_NOT_READY',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    if (!options?.skipQueueOnFailure) {
      enqueuePendingSync({
        table,
        action: 'update',
        localId: id ?? sanitizeRecord(patch)?.id ?? null,
        cloudId: sanitizeRecord(patch)?.cloud_id ?? null,
        payload: sanitizeRecord(patch),
        selector: options?.selector || null,
        code: classifyCloudSaveCode(readiness.code),
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: readiness.code || 'CLOUD_NOT_READY',
    }, 'warn');
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const basePayload = buildOperationalUpdatePayload(table, patch, userId) || sanitizeRecord(patch);
    const withOwner = tableSupportsOwnerScope(table);
    const selector = isObject(options?.selector) ? options.selector : null;
    const normalizedIdentityKey = buildFazendaIdentityKey(selector?.identity || {});
    const runUpdate = async (useOwnerScope, payload) => {
      let query = supabase.from(table).update(payload);
      const normalizedTable = String(table || '').toLowerCase();
      if (normalizedTable === 'fazendas' && selector?.type) {
        if (selector.type === 'id' && Number.isFinite(Number(selector?.value))) {
          query = query.eq('id', Number(selector.value));
        } else if (selector.type === 'cloud_id' && selector?.value) {
          query = query.eq('cloud_id', String(selector.value));
        } else if (selector.type === 'metadata.local_id' && selector?.value) {
          query = query.contains('metadata', { local_id: String(selector.value) });
        } else if (selector.type === 'fallback_identity' && normalizedIdentityKey && normalizedIdentityKey !== '||') {
          const [nome, cidade, estado] = normalizedIdentityKey.split('|');
          query = query.ilike('nome', nome || '').ilike('cidade', cidade || '').ilike('estado', estado || '');
        } else {
          query = query.eq('id', id);
        }
      } else if (normalizedTable === 'pesagens' && selector?.type) {
        if (selector.type === 'id' && Number.isFinite(Number(selector?.value))) {
          query = query.eq('id', Number(selector.value));
        } else if (selector.type === 'cloud_id' && selector?.value) {
          query = query.eq('cloud_id', String(selector.value));
        } else if (selector.type === 'metadata.local_id' && selector?.value) {
          query = query.contains('metadata', { local_id: String(selector.value) });
        } else if (selector.type === 'animal_date_tipo') {
          query = query
            .eq('animal_id', toNullableId(selector?.animal_id))
            .eq('lote_id', Number(selector?.lote_id))
            .eq('tipo', String(selector?.tipo || 'animal'))
            .eq('data', String(selector?.data || '').slice(0, 10));
        } else if (selector.type === 'lote_date_tipo') {
          query = query
            .eq('lote_id', Number(selector?.lote_id))
            .eq('tipo', String(selector?.tipo || 'lote'))
            .eq('data', String(selector?.data || '').slice(0, 10));
        } else if (Number.isFinite(Number(id))) {
          query = query.eq('id', Number(id));
        } else {
          query = query.eq('id', id);
        }
      } else {
        query = query.eq('id', id);
      }
      if (useOwnerScope) query = query.eq('owner_user_id', userId);
      return query.select('*').single();
    };
    let data = null;
    let error = null;
    const adaptiveVariants = buildAdaptiveVariants(table, basePayload);
    for (const variant of (adaptiveVariants.length ? adaptiveVariants : [{ payload: basePayload, removedKeys: [] }])) {
      ({ data, error } = await runUpdate(withOwner, variant.payload));
      if (error && withOwner && isOwnerColumnSchemaError(error)) {
        updateTableCapability(table, { ownerScope: false });
        ({ data, error } = await runUpdate(false, variant.payload));
      }
      if (!error) break;
      if (isSchemaCompatibilityError(error)) {
        const safe = getSafeErrorDetails(error);
        logSupabase400Diagnostic({
          table,
          action: 'update',
          status: getHttpStatus(error),
          postgrestCode: getPostgrestCode(error),
          safeMessage: safe.safeMessage || getErrorMessage(error),
          details: safe.details,
          hint: safe.hint,
          payloadKeys: Object.keys(variant.payload || {}),
          removedKeys: variant.removedKeys || [],
        });
      } else {
        break;
      }
    }
    if (error) throw error;
    notifyCloudHealthy('Registro salvo na nuvem.');
    removePendingSyncItems((item) => (
      String(item?.table || '') === String(table || '')
      && String(item?.action || '') === 'update'
      && (
        String(item?.localId || '') === String(id || '')
        || String(item?.payload?.metadata?.local_id || '') === String(sanitizeRecord(patch)?.metadata?.local_id || '')
      )
    ));
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'active',
      syncStatus: 'cloud_success',
      code: null,
    });
    return { persisted: true, data, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    const status = getHttpStatus(error);
    const safe = getSafeErrorDetails(error);
    if (isOwnerColumnSchemaError(error)) {
      updateTableCapability(table, { ownerScope: false });
    }
    const schemaIncompatible = isSchemaCompatibilityError(error);
    const classifiedCode = schemaIncompatible
      ? BLOCKED_SCHEMA_ERROR_CODE
      : classifyCloudSaveCode(error?.code, error, status);
    logOperationalSync({
      stage: 'update_error',
      requestStage: 'update',
      action: 'update',
      table,
      selectorType: options?.selector?.type || null,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
      httpStatus: status,
      syncStatus: 'pending_sync',
      payloadKeys: Object.keys(sanitizeRecord(patch) || {}),
      safeMessage: safe.safeMessage || getErrorMessage(error),
      safeDetails: safe.details,
      safeHint: safe.hint,
    }, 'warn');
    if (schemaIncompatible) {
      logSupabase400Diagnostic({
        table,
        action: 'update',
        status,
        postgrestCode: getPostgrestCode(error),
        safeMessage: safe.safeMessage || getErrorMessage(error),
        details: safe.details,
        hint: safe.hint,
        payloadKeys: Object.keys(sanitizeRecord(patch) || {}),
        removedKeys: [],
      });
    }
    const fallback = buildFallback(
      schemaIncompatible
        ? 'Estrutura da nuvem incompatÃ­vel com este registro. Registro mantido localmente.'
        : 'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.',
      sanitizeRecord(patch),
      classifiedCode,
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    if (!options?.skipQueueOnFailure) {
      enqueuePendingSync({
        table,
        action: 'update',
        localId: id ?? sanitizeRecord(patch)?.id ?? null,
        cloudId: sanitizeRecord(patch)?.cloud_id ?? null,
        payload: sanitizeRecord(patch),
        selector: options?.selector || null,
        code: classifiedCode,
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
    }, 'warn');
    return fallback;
  }
}

export async function deleteOperationalRecord(table, id, session, options = {}) {
  const runtimeContext = {
    hasSession: Boolean(session),
    hasUserId: Boolean(getSessionUserId(session)),
    envReady: Boolean(getSupabaseEnvStatus()?.configured),
  };
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'delete', table });
  if (!readiness.ok) {
    const fallback = buildFallback(
      'Registro salvo localmente. Sincronizacao pendente.',
      null,
      readiness.code || 'CLOUD_NOT_READY',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    if (!options?.skipQueueOnFailure) {
      const pendingPayload = isObject(options?.pendingPayload)
        ? options.pendingPayload
        : { id, selector: options?.selector || null };
      enqueuePendingSync({
        table,
        action: 'delete',
        localId: id ?? null,
        payload: pendingPayload,
        selector: options?.selector || null,
        code: classifyCloudSaveCode(readiness.code),
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: readiness.code || 'CLOUD_NOT_READY',
    }, 'warn');
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const withOwner = tableSupportsOwnerScope(table);
    const selector = isObject(options?.selector) ? options.selector : null;
    const isNumericId = Number.isFinite(Number(id)) && String(id).trim() !== '';
    const normalizedIdentityKey = buildFazendaIdentityKey(selector?.identity || {});
    const runDelete = async (useOwnerScope) => {
      let query = supabase.from(table).delete();
      if (String(table || '').toLowerCase() === 'fazendas' && selector?.type) {
        if (selector.type === 'id' && Number.isFinite(Number(selector?.value))) {
          query = query.eq('id', Number(selector.value));
        } else if (selector.type === 'cloud_id' && selector?.value) {
          query = query.eq('cloud_id', String(selector.value));
        } else if (selector.type === 'metadata.local_id' && selector?.value) {
          query = query.contains('metadata', { local_id: String(selector.value) });
        } else if (selector.type === 'fallback_identity' && normalizedIdentityKey && normalizedIdentityKey !== '||') {
          const [nome, cidade, estado] = normalizedIdentityKey.split('|');
          query = query
            .ilike('nome', nome || '')
            .ilike('cidade', cidade || '')
            .ilike('estado', estado || '');
        } else if (isNumericId) {
          query = query.eq('id', Number(id));
        } else {
          const invalid = new Error('invalid_delete_selector');
          invalid.code = 'DELETE_SELECTOR_INVALID';
          invalid.status = 400;
          throw invalid;
        }
      } else if (isNumericId) {
        query = query.eq('id', Number(id));
      } else {
        query = query.eq('id', id);
      }
      if (useOwnerScope) query = query.eq('owner_user_id', userId);
      return query;
    };
    let { error } = await runDelete(withOwner);
    if (error && withOwner && isOwnerColumnSchemaError(error)) {
      updateTableCapability(table, { ownerScope: false });
      ({ error } = await runDelete(false));
    }
    if (error) throw error;
    notifyCloudHealthy('Nuvem ativa com atualizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o confirmada.');
    removePendingSyncItems((item) => (
      String(item?.table || '') === String(table || '')
      && String(item?.action || '') === 'delete'
      && (
        String(item?.localId || '') === String(id || '')
        || String(item?.selector?.type || '') === String(options?.selector?.type || '')
      )
    ));
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'active',
      syncStatus: 'cloud_success',
      code: null,
    });
    return { persisted: true, data: null, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    const status = getHttpStatus(error);
    const safe = getSafeErrorDetails(error);
    if (isOwnerColumnSchemaError(error)) {
      updateTableCapability(table, { ownerScope: false });
    }
    const classifiedCode = status === 400
      ? 'schema_error'
      : classifyCloudSaveCode(error?.code, error, status);
    logOperationalSync({
      stage: 'delete_error',
      requestStage: 'delete',
      action: 'delete',
      table,
      selectorType: options?.selector?.type || null,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
      httpStatus: status,
      syncStatus: 'pending_sync',
      payloadKeys: Object.keys((isObject(options?.pendingPayload) ? options.pendingPayload : { id, selector: options?.selector || null }) || {}),
      safeMessage: safe.message || getErrorMessage(error),
      safeDetails: safe.details,
      safeHint: safe.hint,
    }, 'warn');
    const fallback = buildFallback(
      'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.',
      null,
      classifiedCode,
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    if (!options?.skipQueueOnFailure) {
      const pendingPayload = isObject(options?.pendingPayload)
        ? options.pendingPayload
        : { id, selector: options?.selector || null };
      enqueuePendingSync({
        table,
        action: 'delete',
        localId: id ?? null,
        payload: pendingPayload,
        selector: options?.selector || null,
        code: classifiedCode,
        message: fallback.error,
      });
    }
    logCloudRuntime({
      ...runtimeContext,
      cloudStatus: 'fallback',
      syncStatus: fallback.syncStatus,
      code: classifiedCode,
    }, 'warn');
    return fallback;
  }
}

export async function processPendingSyncQueue(session, options = {}) {
  const isManual = Boolean(options?.manual);
  const queue = readPendingSyncQueue();
  if (!queue.length) {
    emitPendingSyncState([], 'empty');
    return { processed: 0, synced: 0, failed: 0, pendingCount: 0, firstError: null };
  }
  const maxItems = Math.max(1, Number(options?.maxItems || 25));
  const slice = queue.slice(0, maxItems);
  const remaining = [...queue];
  let synced = 0;
  let failed = 0;

  for (const item of slice) {
    const fingerprint = buildQueueFingerprint(item);
    const baseIndex = remaining.findIndex((queued) => buildQueueFingerprint(queued) === fingerprint);
    if (baseIndex === -1) continue;
    const current = remaining[baseIndex];
    const retryCount = Number(current?.retryCount || 0);
    if (!isManual && [BLOCKED_SCHEMA_ERROR_CODE, 'schema_error'].includes(String(current?.code || ''))) {
      continue;
    }
    if (!isManual && retryCount >= 3) {
      const backoffMs = retryCount <= 5 ? 30000 : 120000;
      const lastAttempt = current?.lastAttemptAt ? Date.parse(current.lastAttemptAt) : 0;
      if (lastAttempt && (Date.now() - lastAttempt) < backoffMs) continue;
    }
    const localId = current?.localId ?? current?.payload?.metadata?.local_id ?? current?.payload?.id ?? current?.payload?.cloud_id ?? null;
    const selector = current?.selector || current?.payload?.selector || null;
    const normalizedPayload = current?.action === 'delete'
      ? (current?.payload || {})
      : current?.action === 'update'
        ? buildOperationalUpdatePayload(current.table, current.payload || {}, getSessionUserId(session))
        : buildOperationalCreatePayload(current.table, current.payload || {}, getSessionUserId(session));
    if (import.meta.env.DEV) {
      console.info('[HERDON_PENDING_SYNC_PROCESS]', { queueCount: remaining.length, table: current?.table || null, action: current?.action || null, retryCount, code: current?.code || null, message: current?.message || null });
      console.info('[HERDON_PENDING_SYNC_PAYLOAD]', { table: current?.table || null, action: current?.action || null, payloadKeys: Object.keys(current?.payload || {}), hasId: Object.hasOwn(current?.payload || {}, 'id'), hasMetadataLocalId: Boolean(current?.payload?.metadata?.local_id), normalizedPayloadKeys: Object.keys(normalizedPayload || {}) });
    }
    if (current?.action !== 'delete' && (!normalizedPayload || typeof normalizedPayload !== 'object')) {
      remaining[baseIndex] = {
        ...current,
        localId,
        code: BLOCKED_SCHEMA_ERROR_CODE,
        message: 'PendÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia bloqueada por incompatibilidade de dados.',
      };
      failed += 1;
      continue;
    }
    let result = null;
    if (item.action === 'create') {
      result = await createOperationalRecord(item.table, normalizedPayload, session, { skipQueueOnFailure: true });
    } else if (item.action === 'update') {
      result = await updateOperationalRecord(item.table, localId, normalizedPayload, session, { skipQueueOnFailure: true, selector });
    } else if (item.action === 'delete') {
      result = await deleteOperationalRecord(item.table, localId, session, { skipQueueOnFailure: true, selector });
    }

    if (result?.persisted) {
      remaining.splice(baseIndex, 1);
      synced += 1;
      continue;
    }

    failed += 1;
    const nextRetryCount = retryCount + 1;
    let nextCode = result?.code || current.code || 'unknown';
    let nextMessage = result?.error || current.message || 'Registro salvo localmente. SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o pendente.';
    if (nextRetryCount > 5 && String(nextCode) === 'schema_error') {
      nextCode = BLOCKED_SCHEMA_ERROR_CODE;
      nextMessage = 'PendÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncia bloqueada por incompatibilidade de dados.';
    }
    remaining[baseIndex] = {
      ...current,
      localId,
      payload: normalizedPayload,
      lastAttemptAt: new Date().toISOString(),
      retryCount: nextRetryCount,
      code: nextCode,
      message: nextMessage,
    };
    if (import.meta.env.DEV) {
      const safe = getSafeErrorDetails(result);
      console.info('[HERDON_PENDING_SYNC_RESULT]', { table: current?.table || null, action: current?.action || null, syncStatus: result?.syncStatus || 'pending_sync', code: nextCode, httpStatus: getHttpStatus(result), safeMessage: nextMessage, safeDetails: safe?.details || null, safeHint: safe?.hint || null });
    }
  }

  writePendingSyncQueue(remaining);
  emitPendingSyncState(remaining, 'processed');
  const firstError = remaining.find((item) => item?.code);
  return {
    processed: slice.length,
    synced,
    failed,
    pendingCount: remaining.length,
    firstError: firstError ? { code: firstError.code, message: firstError.message } : null,
  };
}

export async function upsertOperationalRecord(table, record, session) {
  const safe = sanitizeRecord(record);
  if (!safe?.id) {
    return createOperationalRecord(table, safe, session);
  }
  return updateOperationalRecord(table, safe.id, safe, session);
}

export async function persistCollectionMutation(mutations = []) {
  const results = await Promise.all(mutations);
  return {
    persisted: results.every((item) => item?.persisted),
    results,
  };
}

export async function createAuditEvent(event = {}, session) {
  const userId = getSessionUserId(session);
  if (!userId) {
    return buildFallback('SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel para registrar auditoria.');
  }

  const payload = {
    acao: String(event.acao || 'acao_nao_informada'),
    entidade: String(event.entidade || 'sistema'),
    entidade_id: event.entidade_id ?? null,
    usuario_id: event.usuario_id ?? userId,
    detalhes: sanitizeAuditDetails(event.detalhes || {}),
    criticidade: event.criticidade || 'media',
    data_hora: event.data_hora || new Date().toISOString(),
  };

  return createOperationalRecord('auditoria', payload, session);
}

export async function deleteOwnerScopedCollection(table, session, extraFilters = []) {
  const userId = getSessionUserId(session);
  if (!userId) {
    return buildFallback('SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel para limpeza da coleÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.');
  }

  try {
    let query = supabase.from(table).delete().eq('owner_user_id', userId);
    extraFilters.forEach((filter) => {
      if (!filter || !filter.column) return;
      query = query.eq(filter.column, filter.value);
    });
    const { error } = await query;
    if (error) {
      throw new Error(error.message || 'Falha ao limpar coleÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.');
    }
    return { persisted: true, data: null, error: null };
  } catch (error) {
    return buildFallback(error?.message || 'Falha ao persistir limpeza da coleÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o.');
  }
}



function isAuthDebugEnabled() {
  if (import.meta.env.DEV) return true;
  try {
    return String(localStorage.getItem('HERDON_SHOW_AUTH_DEBUG') || '').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

function classifyFazendasSyncError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  if (code === '42501' || message.includes('permission denied') || message.includes('row-level security') || details.includes('row-level security')) {
    return 'Sem permissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para acessar estes dados na nuvem.';
  }

  if (code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema') || details.includes('column') || details.includes('schema')) {
    return 'Tabela de fazendas nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada na nuvem. Verifique a estrutura do Supabase.';
  }

  if (isNetworkError(error)) {
    return 'Falha de conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do navegador com o Supabase. O modo local continua ativo.';
  }

  return 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel sincronizar fazendas. Seus dados locais continuam disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis.';
}

function classifyLotesSyncError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const status = getHttpStatus(error);

  if (status === 401) {
    return 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.';
  }

  if (code === '42501' || status === 403 || message.includes('permission denied') || message.includes('row-level security') || details.includes('row-level security')) {
    return 'Permiss\u00E3o insuficiente para sincronizar lotes.';
  }

  if (status === 404 || code === 'PGRST205' || code === '42P01') {
    return 'Tabela de lotes n\u00E3o encontrada na nuvem. Verifique a estrutura do Supabase.';
  }

  if (status === 400 || code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema') || message.includes('relation') || details.includes('column') || details.includes('schema') || details.includes('relation')) {
    return 'Estrutura da nuvem incompatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel com o app. Verifique as colunas no Supabase.';
  }

  if (code === 'CONFIG_ERROR' || message.includes('missing_rest_config_or_token')) {
    return 'Configura\u00E7\u00E3o da nuvem incompleta. Verifique as vari\u00E1veis do Supabase.';
  }

  if (isNetworkError(error)) {
    return 'Falha de conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do navegador com o Supabase. O modo local continua ativo.';
  }

  if (code === '57014' || message.includes('timeout')) {
    return 'A sincroniza\u00E7\u00E3o de lotes demorou mais que o esperado.';
  }

  if (code === '22P02' || message.includes('invalid input syntax') || message.includes('violates')) {
    return 'Estrutura da nuvem incompatÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel com o app. Verifique as colunas no Supabase.';
  }

  return 'N\u00E3o foi poss\u00EDvel sincronizar lotes. Seus dados locais continuam dispon\u00EDveis.';
}

export async function checkSupabaseCloudConnection({ session } = {}) {
  const sessionUserId = getSessionUserId(session);
  const readiness = await ensureSupabaseRequestReadiness(session, {
    stage: 'cloud_health_check',
    action: 'select',
    table: 'fazendas',
  });
  if (!readiness.ok) {
    return {
      ok: false,
      stage: readiness.code === 'SUPABASE_ENV_MISSING' ? 'config_missing' : 'auth_session_missing',
      error: readiness.code,
      code: readiness.code,
      status: readiness.code === 'SUPABASE_ENV_MISSING' ? null : 401,
      message: readiness.message,
      details: null,
      hint: null,
    };
  }
  if (!sessionUserId) {
    const message = 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.';
    if (isAuthDebugEnabled()) {
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage: 'auth_session_missing',
        action: 'select',
        table: 'fazendas',
        requestUrlHost: null,
        requestUrlPath: null,
        method: 'SDK_SELECT',
        status: 401,
        errorName: 'AUTH_SESSION_MISSING',
        errorMessage: message,
      });
    }
    return { ok: false, stage: 'auth_session_missing', error: 'AUTH_SESSION_MISSING', code: null, status: 401, message, details: null, hint: null };
  }

  try {
    const { error } = await supabase
      .from('fazendas')
      .select('id')
      .eq('owner_user_id', sessionUserId)
      .limit(1);
    if (error) throw error;
    if (isAuthDebugEnabled()) {
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage: 'ok',
        action: 'select',
        table: 'fazendas',
        requestUrlHost: null,
        requestUrlPath: '/rest/v1/fazendas',
        method: 'SDK_SELECT',
        status: 200,
        errorName: null,
        errorMessage: 'ok',
      });
    }
    return { ok: true, stage: 'ok', error: null, code: null, status: 200, message: null, details: null, hint: null };
  } catch (error) {

    const status = Number(error?.status) || null;
    const code = String(error?.code || '').toUpperCase() || null;
    const lower = String(error?.message || '').toLowerCase();
    let stage = 'unknown_error';
    let message = 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel sincronizar fazendas. Seus dados locais continuam disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis.';
    if (status === 401) { stage = 'auth_session_missing'; message = 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.'; }
    else if (status === 403 || code === '42501') { stage = 'permission_denied'; message = 'Sem permissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para acessar estes dados na nuvem.'; }
    else if (status === 404 || code === 'PGRST205' || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) { stage = 'schema_mismatch'; message = 'Tabela de fazendas nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada na nuvem. Verifique a estrutura do Supabase.'; }
    else if (code === 'CONFIG_ERROR' || lower.includes('missing_rest_config_or_token')) { stage = 'config_missing'; message = 'ConfiguraÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da nuvem ausente. Verifique as variÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡veis do Supabase.'; }
    else if (isNetworkError(error) || (error?.name === 'TypeError' && lower.includes('failed to fetch'))) { stage = 'network_error'; message = 'Falha de conexÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o do navegador com o Supabase. O modo local continua ativo.'; }

    if (isAuthDebugEnabled()) {
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage,
        action: 'select',
        table: 'fazendas',
        method: 'SDK_SELECT',
        requestUrlHost: null,
        requestUrlPath: '/rest/v1/fazendas',
        status,
        errorName: error?.name || code || null,
        errorMessage: error?.message || message || null,
      });
    }
    return { ok: false, stage, error: error?.name || 'CLOUD_HEALTH_FAILED', code, status, message, details: error?.details || null, hint: error?.hint || null };
  }
}

export async function syncFazendasWithCloud({ fazendas = [], session }) {
  if (isNetworkCircuitOpen('fazendas')) {
    return buildModuleSyncResult({
      module: 'fazendas',
      status: 'skipped',
      message: 'Verifica\u00E7\u00E3o de nuvem pausada temporariamente por falhas de rede.',
      code: 'NETWORK_CIRCUIT_OPEN',
      data: Array.isArray(fazendas) ? fazendas : [],
    });
  }

  const readiness = await ensureSupabaseRequestReadiness(session, {
    stage: 'cloud_sync_fazendas',
    action: 'upsert',
    table: 'fazendas',
  });
  if (!readiness.ok) {
    return buildModuleSyncResult({
      module: 'fazendas',
      status: 'error',
      message: readiness.message || 'SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel no momento.',
      code: readiness.code || 'SYNC_NOT_READY',
      data: Array.isArray(fazendas) ? fazendas : [],
    });
  }

  const userId = getSessionUserId(session);
  const localRows = Array.isArray(fazendas) ? fazendas : [];
  if (!userId) {
    return buildModuleSyncResult({ module: 'fazendas', status: 'error', message: 'Fa\u00E7a login para sincronizar com a nuvem.', code: 'AUTH_REQUIRED', data: localRows });
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const localRow of localRows) {
    if (getCloudIdMarker(localRow) !== null) continue;
    const { payload } = mapFazendaToCloudPayload(localRow, userId);
    try {
      const { error } = await supabase.from('fazendas').insert(payload).select('id').single();
      if (error) throw error;
      syncedCount += 1;
    } catch (error) {
      failedCount += 1;
      const status = getHttpStatus(error);
      const code = getPostgrestCode(error) || 'SYNC_FAILED';
      const lower = String(error?.message || '').toLowerCase();
      let message = 'NÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o foi possÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel sincronizar fazendas. Seus dados locais continuam disponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­veis.';
      if (status === 401) message = 'SessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o expirada. Entre novamente para sincronizar com a nuvem.';
      else if (status === 403 || code === '42501') message = 'Sem permissÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o para acessar estes dados na nuvem.';
      else if (status === 404 || code === 'PGRST205' || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) message = 'Tabela de fazendas nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrada na nuvem. Verifique a estrutura do Supabase.';
      else if (code === 'CONFIG_ERROR' || lower.includes('missing_rest_config_or_token')) message = 'Configura\u00E7\u00E3o da nuvem incompleta. Verifique as vari\u00E1veis do Supabase.';
      else if (isNetworkError(error)) message = 'N\u00E3o foi poss\u00EDvel conectar ao Supabase. Verifique sua conex\u00E3o, DNS ou vari\u00E1veis da nuvem.';
      if (shouldOpenNetworkCircuit(error)) openNetworkCircuit('fazendas');
      return buildModuleSyncResult({ module: 'fazendas', status: 'error', message, code, httpStatus: status, data: localRows, syncedCount, failedCount, selectedCount: 0 });
    }
  }

  try {
    const { data: remoteList, error } = await supabase.from('fazendas').select('*').eq('owner_user_id', userId);
    if (error) throw error;
    closeNetworkCircuit('fazendas');
    return buildModuleSyncResult({ module: 'fazendas', status: 'success', message: 'Fazendas sincronizadas.', data: mergeFazendasSafe(localRows, Array.isArray(remoteList) ? remoteList : []), syncedCount, failedCount, selectedCount: Array.isArray(remoteList) ? remoteList.length : 0 });
  } catch (error) {
    if (shouldOpenNetworkCircuit(error)) openNetworkCircuit('fazendas');
    const msg = classifyFazendasSyncError(error);
    return buildModuleSyncResult({ module: 'fazendas', status: 'error', message: msg, code: error?.code || 'REMOTE_FETCH_FAILED', httpStatus: getHttpStatus(error), data: localRows, syncedCount, failedCount, selectedCount: 0 });
  }
}

export async function syncLotesWithCloud({ lotes = [], session }) {
  if (isNetworkCircuitOpen('lotes')) {
    return buildModuleSyncResult({
      module: 'lotes',
      status: 'skipped',
      message: 'Verifica\u00E7\u00E3o de nuvem pausada temporariamente por falhas de rede.',
      code: 'NETWORK_CIRCUIT_OPEN',
      data: Array.isArray(lotes) ? lotes : [],
    });
  }

  const readiness = await ensureSupabaseRequestReadiness(session, {
    stage: 'cloud_sync_lotes',
    action: 'upsert',
    table: 'lotes',
  });
  if (!readiness.ok) {
    return buildModuleSyncResult({
      module: 'lotes',
      status: 'error',
      message: readiness.message || 'SincronizaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o indisponÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­vel no momento.',
      code: readiness.code || 'SYNC_NOT_READY',
      data: Array.isArray(lotes) ? lotes : [],
    });
  }

  const userId = getSessionUserId(session);
  const localRows = Array.isArray(lotes) ? lotes : [];
  if (!userId) {
    return buildModuleSyncResult({ module: 'lotes', status: 'error', message: 'Fa\u00E7a login para sincronizar com a nuvem.', code: 'AUTH_REQUIRED', data: localRows });
  }

  let syncedCount = 0;
  let failedCount = 0;

  let remoteList = [];
  try {
    const { data, error } = await supabase.from('lotes').select('*').eq('owner_user_id', userId);
    if (error) throw error;
    remoteList = Array.isArray(data) ? data : [];
  } catch (error) {
    const msg = classifyLotesSyncError(error);
    logModuleSyncEvent({ module: 'lotes', stage: 'fetch_remote_failed', table: 'lotes', httpStatus: getHttpStatus(error), postgrestCode: getPostgrestCode(error), safeMessage: msg }, 'warn');
    if (shouldOpenNetworkCircuit(error)) openNetworkCircuit('lotes');
    return buildModuleSyncResult({ module: 'lotes', status: 'error', message: msg, code: error?.code || 'REMOTE_FETCH_FAILED', httpStatus: getHttpStatus(error), data: localRows, syncedCount, failedCount, selectedCount: 0 });
  }

  const findRemoteMatch = (localRow) => {
    const localIdText = localRow?.id !== undefined && localRow?.id !== null ? String(localRow.id) : null;
    const cloudId = getCloudIdMarker(localRow);

    return remoteList.find((remote) => {
      const remoteIdText = remote?.id !== undefined && remote?.id !== null ? String(remote.id) : null;
      const remoteCloudIdText = remote?.cloud_id !== undefined && remote?.cloud_id !== null ? String(remote.cloud_id) : null;
      const remoteLocalIdText = remote?.metadata?.local_id !== undefined && remote?.metadata?.local_id !== null ? String(remote.metadata.local_id) : null;

      if (cloudId !== null && (remoteIdText === String(cloudId) || remoteCloudIdText === String(cloudId))) return true;
      if (localIdText && remoteLocalIdText && localIdText === remoteLocalIdText) return true;
      if (localIdText && remoteIdText && localIdText === remoteIdText) return true;
      return false;
    }) || null;
  };

  for (const localRow of localRows) {
    const { payload } = mapLoteToCloudPayload(localRow, userId);
    const remoteMatch = findRemoteMatch(localRow);

    try {
      if (remoteMatch?.id) {
        const { data, error } = await supabase.from('lotes').update(payload).eq('id', remoteMatch.id).eq('owner_user_id', userId).select('*').single();
        if (error) throw error;
        syncedCount += 1;
        remoteList = remoteList.map((item) => (item.id === remoteMatch.id ? data : item));
      } else {
        const { data, error } = await supabase.from('lotes').insert(payload).select('*').single();
        if (error) throw error;
        syncedCount += 1;
        remoteList.push(data);
      }
    } catch (error) {
      failedCount += 1;
      const status = getHttpStatus(error);
      const msg = classifyLotesSyncError(error);
      const timeoutLike = error?.name === 'TimeoutError' || String(error?.message || '').toLowerCase().includes('timeout');
      logModuleSyncEvent({ module: 'lotes', stage: 'upsert_failed', table: 'lotes', httpStatus: status, postgrestCode: getPostgrestCode(error), safeMessage: msg }, 'warn');
      if (shouldOpenNetworkCircuit(error)) openNetworkCircuit('lotes');
      return buildModuleSyncResult({ module: 'lotes', status: timeoutLike ? 'timeout' : 'error', message: timeoutLike ? 'A sincroniza\u00E7\u00E3o de lotes demorou mais que o esperado.' : msg, code: error?.code || 'SYNC_FAILED', httpStatus: status, data: localRows, syncedCount, failedCount, selectedCount: Array.isArray(remoteList) ? remoteList.length : 0 });
    }
  }

  closeNetworkCircuit('lotes');
  return buildModuleSyncResult({ module: 'lotes', status: 'success', message: 'Lotes sincronizados.', data: mergeLotesSafe(localRows, remoteList), syncedCount, failedCount, selectedCount: Array.isArray(remoteList) ? remoteList.length : 0 });
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.HERDON_SYNC_DEBUG = {
    clearPendingQueue() {
      writePendingSyncQueue([]);
      emitPendingSyncState([], 'dev_clear');
      return { ok: true, pendingCount: 0 };
    },
    getPendingQueue() {
      return readPendingSyncQueue();
    },
    getBlockedSchemaErrors() {
      return readPendingSyncQueue().filter((item) => (
        String(item?.code || '') === BLOCKED_SCHEMA_ERROR_CODE
        || String(item?.code || '') === 'schema_error'
      ));
    },
  };
}
