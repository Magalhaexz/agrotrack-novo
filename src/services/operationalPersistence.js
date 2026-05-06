import { getSupabaseEnvStatus, supabase, validateSupabaseSessionForCloud } from '../lib/supabase.js';
const NETWORK_CIRCUIT_OPEN_MS = 45000;
const moduleNetworkCircuit = new Map();

function getSessionUserId(session) {
  return session?.user?.id || null;
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
    action: event.action || null,
    table: event.table || null,
    hasSessionUser: Boolean(event.hasSessionUser),
    hasAccessToken: Boolean(event.hasAccessToken),
    envConfigured: Boolean(event.envConfigured),
    errorType: event.errorType || null,
    errorCode: event.errorCode || null,
  });
}

function classifyCloudSaveCode(rawCode, error = null) {
  const code = String(rawCode || error?.code || '').toUpperCase();
  const message = String(getErrorMessage(error) || '').toLowerCase();
  if (code.includes('ENV') || code.includes('CONFIG')) return 'config_error';
  if (code.includes('SESSION') || code.includes('AUTH')) return 'auth_not_ready';
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) return 'permission_denied';
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
      message: envStatus.message || 'Configuração da nuvem ausente neste ambiente.',
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
      message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
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
          safeMessage: validated?.safeMessage || 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
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
        message: validated?.safeMessage || 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
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
      message: classifyOperationalError(error, 'Falha ao validar sessão com a nuvem. Seus dados locais continuam disponíveis.', context?.table || null),
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
  const metadata = sanitizeMetadataForModule(safe?.metadata, localId, 'herdon_manual_lotes_sync');
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
        cloud_id: remote?.cloud_id ?? remote?.id ?? (remote?.metadata?.cloud_id ?? null),
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

export async function createOperationalRecord(table, record, session) {
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'create', table });
  if (!readiness.ok) {
    const fallback = buildFallback(readiness.message, sanitizeRecord(record), readiness.code || 'CLOUD_NOT_READY');
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const payload = {
      ...sanitizeRecord(record),
      owner_user_id: userId,
    };
    const { data, error } = await supabase
      .from(table)
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw error;
    }
    notifyCloudHealthy('Registro salvo na nuvem.');
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    return { persisted: true, data, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    logOperationalSync({
      stage: 'create_error',
      action: 'create',
      table,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
    }, 'warn');
    const fallback = buildFallback(
      classifyOperationalError(error, 'Falha ao persistir cadastro na nuvem. Dados locais mantidos.', table),
      sanitizeRecord(record),
      error?.code || 'WRITE_FAILED',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'create',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(error?.code, error),
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    return fallback;
  }
}

export async function updateOperationalRecord(table, id, patch, session) {
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'update', table });
  if (!readiness.ok) {
    const fallback = buildFallback(readiness.message, sanitizeRecord(patch), readiness.code || 'CLOUD_NOT_READY');
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const payload = sanitizeRecord(patch);
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', id)
      .eq('owner_user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }
    notifyCloudHealthy('Registro salvo na nuvem.');
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    return { persisted: true, data, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    logOperationalSync({
      stage: 'update_error',
      action: 'update',
      table,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
    }, 'warn');
    const fallback = buildFallback(
      classifyOperationalError(error, 'Falha ao persistir atualizacao na nuvem. Dados locais mantidos.', table),
      sanitizeRecord(patch),
      error?.code || 'WRITE_FAILED',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'update',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(error?.code, error),
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    return fallback;
  }
}

export async function deleteOperationalRecord(table, id, session) {
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'delete', table });
  if (!readiness.ok) {
    const fallback = buildFallback(readiness.message, null, readiness.code || 'CLOUD_NOT_READY');
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(readiness.code),
      message: readiness.message,
      session,
      cloudConfigured: readiness.code !== 'SUPABASE_ENV_MISSING',
    });
    return fallback;
  }
  const userId = getSessionUserId(session);

  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('owner_user_id', userId);

    if (error) {
      throw error;
    }
    notifyCloudHealthy('Nuvem ativa com atualização confirmada.');
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: 'cloud_success',
      code: null,
      message: 'Registro salvo na nuvem.',
      session,
      cloudConfigured: true,
    });
    return { persisted: true, data: null, error: null, syncStatus: 'cloud_success', code: null };
  } catch (error) {
    logOperationalSync({
      stage: 'delete_error',
      action: 'delete',
      table,
      hasSessionUser: Boolean(userId),
      hasAccessToken: true,
      envConfigured: true,
      errorType: getErrorMessage(error),
      errorCode: error?.code || null,
    }, 'warn');
    const fallback = buildFallback(
      classifyOperationalError(error, 'Falha ao persistir exclusao na nuvem. Dados locais mantidos.', table),
      null,
      error?.code || 'WRITE_FAILED',
      'pending_sync'
    );
    emitCloudSaveState({
      table,
      action: 'delete',
      syncStatus: fallback.syncStatus,
      code: classifyCloudSaveCode(error?.code, error),
      message: fallback.error,
      session,
      cloudConfigured: true,
    });
    return fallback;
  }
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
    return buildFallback('Sessão indisponível para registrar auditoria.');
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
    return buildFallback('Sessão indisponível para limpeza da coleção.');
  }

  try {
    let query = supabase.from(table).delete().eq('owner_user_id', userId);
    extraFilters.forEach((filter) => {
      if (!filter || !filter.column) return;
      query = query.eq(filter.column, filter.value);
    });
    const { error } = await query;
    if (error) {
      throw new Error(error.message || 'Falha ao limpar coleção.');
    }
    return { persisted: true, data: null, error: null };
  } catch (error) {
    return buildFallback(error?.message || 'Falha ao persistir limpeza da coleção.');
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
    return 'Sem permissão para acessar estes dados na nuvem.';
  }

  if (code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema') || details.includes('column') || details.includes('schema')) {
    return 'Tabela de fazendas não encontrada na nuvem. Verifique a estrutura do Supabase.';
  }

  if (isNetworkError(error)) {
    return 'Falha de conexão do navegador com o Supabase. O modo local continua ativo.';
  }

  return 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
}

function classifyLotesSyncError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const status = getHttpStatus(error);

  if (status === 401) {
    return 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
  }

  if (code === '42501' || status === 403 || message.includes('permission denied') || message.includes('row-level security') || details.includes('row-level security')) {
    return 'Permiss\u00E3o insuficiente para sincronizar lotes.';
  }

  if (status === 404 || code === 'PGRST205' || code === '42P01') {
    return 'Tabela de lotes n\u00E3o encontrada na nuvem. Verifique a estrutura do Supabase.';
  }

  if (status === 400 || code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema') || message.includes('relation') || details.includes('column') || details.includes('schema') || details.includes('relation')) {
    return 'Estrutura da nuvem incompatível com o app. Verifique as colunas no Supabase.';
  }

  if (code === 'CONFIG_ERROR' || message.includes('missing_rest_config_or_token')) {
    return 'Configura\u00E7\u00E3o da nuvem incompleta. Verifique as vari\u00E1veis do Supabase.';
  }

  if (isNetworkError(error)) {
    return 'Falha de conexão do navegador com o Supabase. O modo local continua ativo.';
  }

  if (code === '57014' || message.includes('timeout')) {
    return 'A sincroniza\u00E7\u00E3o de lotes demorou mais que o esperado.';
  }

  if (code === '22P02' || message.includes('invalid input syntax') || message.includes('violates')) {
    return 'Estrutura da nuvem incompatível com o app. Verifique as colunas no Supabase.';
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
    const message = 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
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
    let message = 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
    if (status === 401) { stage = 'auth_session_missing'; message = 'Sessão expirada. Entre novamente para sincronizar com a nuvem.'; }
    else if (status === 403 || code === '42501') { stage = 'permission_denied'; message = 'Sem permissão para acessar estes dados na nuvem.'; }
    else if (status === 404 || code === 'PGRST205' || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) { stage = 'schema_mismatch'; message = 'Tabela de fazendas não encontrada na nuvem. Verifique a estrutura do Supabase.'; }
    else if (code === 'CONFIG_ERROR' || lower.includes('missing_rest_config_or_token')) { stage = 'config_missing'; message = 'Configuração da nuvem ausente. Verifique as variáveis do Supabase.'; }
    else if (isNetworkError(error) || (error?.name === 'TypeError' && lower.includes('failed to fetch'))) { stage = 'network_error'; message = 'Falha de conexão do navegador com o Supabase. O modo local continua ativo.'; }

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
      message: readiness.message || 'Sincronização indisponível no momento.',
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
      let message = 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
      if (status === 401) message = 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
      else if (status === 403 || code === '42501') message = 'Sem permissão para acessar estes dados na nuvem.';
      else if (status === 404 || code === 'PGRST205' || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) message = 'Tabela de fazendas não encontrada na nuvem. Verifique a estrutura do Supabase.';
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
      message: readiness.message || 'Sincronização indisponível no momento.',
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








