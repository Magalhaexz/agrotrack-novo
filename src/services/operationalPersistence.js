import { getSupabaseEnvStatus, supabase } from '../lib/supabase.js';

function getSessionUserId(session) {
  return session?.user?.id || null;
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function isNetworkError(error) {
  const message = String(getErrorMessage(error) || '').toLowerCase();
  return message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('fetch failed')
    || message.includes('err_connection')
    || message.includes('timeout');
}

function classifyOperationalError(error, fallbackMessage) {
  const message = String(getErrorMessage(error) || '').toLowerCase();
  const code = String(error?.code || '').toUpperCase();
  if (isNetworkError(error)) {
    return 'Sem conexao com a nuvem no momento. Seus dados locais continuam disponiveis.';
  }
  if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
    return 'Permissao insuficiente para gravar na nuvem. Verifique o perfil de acesso.';
  }
  if (code === 'PGRST204' || code === '42703' || code === '42P01' || message.includes('schema') || message.includes('column') || message.includes('relation')) {
    return 'Estrutura da base nao compativel com o app. Use o modo local e valide a configuracao.';
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
      message: envStatus.message || 'Configuracao da nuvem ausente neste ambiente.',
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
      message: 'Sua sessao nao esta pronta para sincronizar. Faca login novamente.',
    };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    const activeSession = data?.session ?? null;
    const activeUserId = activeSession?.user?.id || null;
    const hasAccessToken = Boolean(activeSession?.access_token);
    if (!activeUserId || !hasAccessToken || String(activeUserId) !== String(sessionUserId)) {
      logOperationalSync({
        stage: 'session_stale',
        ...context,
        hasSessionUser: true,
        hasAccessToken,
        envConfigured: true,
      }, 'warn');
      return {
        ok: false,
        code: 'SESSION_STALE',
        message: 'Sua sessao esta sendo atualizada. Aguarde alguns segundos e tente novamente.',
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
      message: classifyOperationalError(error, 'Falha ao validar sessao com a nuvem. Seus dados locais continuam disponiveis.'),
    };
  }
}

function buildFallback(message, data = null) {
  return {
    persisted: false,
    data,
    error: message,
  };
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
    return buildFallback(readiness.message, sanitizeRecord(record));
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
      throw new Error(error.message || 'Falha ao criar registro.');
    }

    return { persisted: true, data, error: null };
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
    return buildFallback(
      classifyOperationalError(error, 'Falha ao persistir cadastro na nuvem. Dados locais mantidos.'),
      sanitizeRecord(record)
    );
  }
}

export async function updateOperationalRecord(table, id, patch, session) {
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'update', table });
  if (!readiness.ok) {
    return buildFallback(readiness.message, sanitizeRecord(patch));
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
      throw new Error(error.message || 'Falha ao atualizar registro.');
    }

    return { persisted: true, data, error: null };
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
    return buildFallback(
      classifyOperationalError(error, 'Falha ao persistir atualizacao na nuvem. Dados locais mantidos.'),
      sanitizeRecord(patch)
    );
  }
}

export async function deleteOperationalRecord(table, id, session) {
  const readiness = await ensureSupabaseRequestReadiness(session, { action: 'delete', table });
  if (!readiness.ok) {
    return buildFallback(readiness.message);
  }
  const userId = getSessionUserId(session);

  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id)
      .eq('owner_user_id', userId);

    if (error) {
      throw new Error(error.message || 'Falha ao excluir registro.');
    }

    return { persisted: true, data: null, error: null };
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
    return buildFallback(
      classifyOperationalError(error, 'Falha ao persistir exclusao na nuvem. Dados locais mantidos.')
    );
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



function getSupabaseRestConfig() {
  const envStatus = getSupabaseEnvStatus();
  const envUrl = import.meta?.env?.VITE_SUPABASE_URL || null;
  const envAnonKey = import.meta?.env?.VITE_SUPABASE_ANON_KEY || null;
  const clientUrl = supabase?.supabaseUrl || supabase?.rest?.url?.replace(/\/rest\/v1\/?$/, '') || null;
  const clientAnonKey = supabase?.supabaseKey || supabase?.anonKey || null;

  const url = envUrl || clientUrl;
  const anonKey = envAnonKey || clientAnonKey;

  if (!url || !anonKey) {
    return {
      url: null,
      anonKey: null,
      error: envStatus.message || 'Configuracao da nuvem ausente. Verifique as variaveis do Supabase.',
    };
  }

  return { url, anonKey, error: null };
}

function readLocalStorageSupabaseToken() {
  try {
    const keys = Object.keys(localStorage).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const accessToken = parsed?.access_token || parsed?.currentSession?.access_token || null;
      const userId = parsed?.user?.id || parsed?.currentSession?.user?.id || null;
      const email = parsed?.user?.email || parsed?.currentSession?.user?.email || null;
      if (accessToken) {
        return { token: accessToken, userId, email };
      }
    }
  } catch {
    return { token: null, userId: null, email: null };
  }
  return { token: null, userId: null, email: null };
}

function resolveSupabaseAccessToken(session) {
  const sessionUserId = getSessionUserId(session);
  const sessionEmail = session?.user?.email || null;
  const acceptedSessionToken = session?.access_token || session?.session?.access_token || null;

  if (acceptedSessionToken) {
    return { token: acceptedSessionToken, source: 'accepted_session', acceptedSessionTokenPresent: true, localStorageTokenPresent: false };
  }

  const localToken = readLocalStorageSupabaseToken();
  const sameUser = !sessionUserId || !localToken.userId || String(localToken.userId) === String(sessionUserId);
  const sameEmail = !sessionEmail || !localToken.email || String(localToken.email).toLowerCase() === String(sessionEmail).toLowerCase();
  if (localToken.token && sameUser && sameEmail) {
    return { token: localToken.token, source: 'local_storage', acceptedSessionTokenPresent: false, localStorageTokenPresent: true };
  }

  return { token: null, source: null, acceptedSessionTokenPresent: Boolean(acceptedSessionToken), localStorageTokenPresent: Boolean(localToken.token) };
}

async function fetchFazendasRest(path, token, options = {}) {
  const { url, anonKey, error: configError } = getSupabaseRestConfig();
  const method = options.method || 'GET';
  if (configError || !token) {
    const error = new Error(configError || 'missing_rest_config_or_token');
    error.code = 'CONFIG_ERROR';
    throw error;
  }

  const baseUrl = String(url).replace(/\/$/, '');
  const requestUrl = `${baseUrl}/rest/v1/${path}`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    ...(options.headers || {}),
  };
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    error.requestUrlHost = (() => {
      try { return new URL(requestUrl).host; } catch { return null; }
    })();
    error.requestUrlPath = (() => {
      try { return new URL(requestUrl).pathname; } catch { return null; }
    })();
    error.requestMethod = method;
    throw error;
  }

  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }

  if (!response.ok) {
    const error = new Error(payload?.message || `rest_error_${response.status}`);
    error.status = response.status;
    error.code = payload?.code || null;
    error.details = payload?.details || null;
    error.hint = payload?.hint || null;
    error.requestUrlHost = (() => { try { return new URL(requestUrl).host; } catch { return null; } })();
    error.requestUrlPath = (() => { try { return new URL(requestUrl).pathname; } catch { return null; } })();
    error.requestMethod = method;
    throw error;
  }

  return payload;
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
    return 'Permissão negada ao sincronizar fazendas. Verifique as políticas RLS.';
  }

  if (code === '42703' || code === 'PGRST204' || message.includes('column') || message.includes('schema') || details.includes('column') || details.includes('schema')) {
    return 'A estrutura da tabela fazendas não está compatível com o app.';
  }

  if (isNetworkError(error)) {
    return 'Não foi possível conectar à nuvem. Seus dados locais continuam disponíveis.';
  }

  return 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
}

function logFazendasSync(event = {}) {
  if (!isAuthDebugEnabled()) return;
  const payload = {
    sessionUserIdPresent: Boolean(event.sessionUserId),
    authSessionPresent: event.authSessionPresent ?? null,
    localCount: event.localCount ?? null,
    operation: event.operation ?? null,
    payloadKeys: Array.isArray(event.payloadKeys) ? event.payloadKeys : null,
    rowNome: event.rowNome ?? null,
    errorName: event.errorName ?? null,
    errorCode: event.errorCode ?? null,
    errorMessage: event.errorMessage ?? null,
    details: event.details ?? null,
    hint: event.hint ?? null,
  };

  const logger = event.level === 'warn' ? console.warn : console.debug;
  logger('[HERDON_FAZENDAS_SYNC]', payload);
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
  const resolved = resolveSupabaseAccessToken(session);

  const config = getSupabaseRestConfig();
  if (config.error) {
    return { ok: false, stage: 'config_missing', error: 'CONFIG_ERROR', code: 'CONFIG_ERROR', status: null, message: config.error, details: null, hint: null };
  }

  if (!sessionUserId || !resolved.token) {
    const message = 'Sua sessão expirou. Faça login novamente.';
    if (isAuthDebugEnabled()) {
      const cfg = getSupabaseRestConfig();
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage: 'auth_session_missing',
        supabaseUrlPresent: Boolean(cfg.url),
        anonKeyPresent: Boolean(cfg.anonKey),
        requestUrlHost: null,
        requestUrlPath: null,
        method: 'GET',
        sessionUserIdPresent: Boolean(sessionUserId),
        acceptedSessionTokenPresent: resolved.acceptedSessionTokenPresent,
        localStorageTokenPresent: resolved.localStorageTokenPresent,
        accessTokenPresent: Boolean(resolved.token),
        status: 401,
        code: null,
        message,
      });
    }
    return { ok: false, stage: 'auth_session_missing', error: 'AUTH_SESSION_MISSING', code: null, status: 401, message, details: null, hint: null };
  }

  try {
    await fetchFazendasRest(`fazendas?select=id&owner_user_id=eq.${encodeURIComponent(sessionUserId)}&limit=1`, resolved.token);
    if (isAuthDebugEnabled()) {
      const cfg = getSupabaseRestConfig();
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage: 'ok',
        supabaseUrlPresent: Boolean(cfg.url),
        anonKeyPresent: Boolean(cfg.anonKey),
        requestUrlHost: (() => { try { return new URL(String(cfg.url).replace(/\/$/, '')).host; } catch { return null; } })(),
        requestUrlPath: '/rest/v1/fazendas',
        method: 'GET',
        sessionUserIdPresent: true,
        acceptedSessionTokenPresent: resolved.acceptedSessionTokenPresent,
        localStorageTokenPresent: resolved.localStorageTokenPresent,
        accessTokenPresent: true, status: 200, code: null, message: 'ok',
      });
    }
    return { ok: true, stage: 'ok', error: null, code: null, status: 200, message: null, details: null, hint: null };
  } catch (error) {
    const status = Number(error?.status) || null;
    const code = String(error?.code || '').toUpperCase() || null;
    const lower = String(error?.message || '').toLowerCase();
    let stage = 'unknown_error';
    let message = 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
    if (status === 401) { stage = 'auth_session_missing'; message = 'Sua sessão expirou. Faça login novamente.'; }
    else if (status === 403 || code === '42501') { stage = 'permission_denied'; message = 'Permissão negada ao acessar a nuvem. Verifique as políticas RLS.'; }
    else if (status === 404 || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) { stage = 'schema_mismatch'; message = 'A estrutura da tabela fazendas não está compatível com o app.'; }
    else if (code === 'CONFIG_ERROR' || lower.includes('missing_rest_config_or_token')) { stage = 'config_missing'; message = 'Configuração da nuvem ausente. Verifique as variáveis do Supabase.'; }
    else if (isNetworkError(error) || (error?.name === 'TypeError' && lower.includes('failed to fetch'))) { stage = 'network_error'; message = 'Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente.'; }

    if (isAuthDebugEnabled()) {
      const cfg = getSupabaseRestConfig();
      console.info('[HERDON_CLOUD_HEALTH]', { stage, supabaseUrlPresent: Boolean(cfg.url), anonKeyPresent: Boolean(cfg.anonKey), requestUrlHost: error?.requestUrlHost || null, requestUrlPath: error?.requestUrlPath || '/rest/v1/fazendas', method: error?.requestMethod || 'GET', sessionUserIdPresent: Boolean(sessionUserId), acceptedSessionTokenPresent: resolved.acceptedSessionTokenPresent, localStorageTokenPresent: resolved.localStorageTokenPresent, accessTokenPresent: Boolean(resolved.token), status, code, message, errorName: error?.name || null, errorMessage: error?.message || null });
    }
    return { ok: false, stage, error: error?.name || 'CLOUD_HEALTH_FAILED', code, status, message, details: error?.details || null, hint: error?.hint || null };
  }
}

export async function syncFazendasWithCloud({ fazendas = [], session }) {
  const readiness = await ensureSupabaseRequestReadiness(session, {
    stage: 'cloud_sync_fazendas',
    action: 'upsert',
    table: 'fazendas',
  });
  if (!readiness.ok) {
    return {
      ok: false,
      data: Array.isArray(fazendas) ? fazendas : [],
      error: readiness.code || 'SYNC_NOT_READY',
      message: readiness.message || 'Sincronizacao indisponivel no momento.',
      syncedCount: 0,
      failedCount: 0,
      selectedCount: 0,
    };
  }
  const userId = getSessionUserId(session);
  const localRows = Array.isArray(fazendas) ? fazendas : [];
  const resolved = resolveSupabaseAccessToken(session);

  if (!userId || !resolved.token) {
    return { ok: false, data: localRows, error: 'AUTH_REQUIRED', message: 'Faça login para sincronizar com a nuvem.', syncedCount: 0, failedCount: 0, selectedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const localRow of localRows) {
    if (getCloudIdMarker(localRow) !== null) continue;
    const { payload } = mapFazendaToCloudPayload(localRow, userId);
    try {
      await fetchFazendasRest('fazendas', resolved.token, { method: 'POST', headers: { Prefer: 'return=representation' }, body: payload });
      syncedCount += 1;
      logFazendasSync({ operation: 'insert', payloadKeys: Object.keys(payload), rowNome: payload.nome || null, status: 201, message: 'ok' });
    } catch (error) {
      failedCount += 1;
      const status = Number(error?.status) || null;
      const code = String(error?.code || '').toUpperCase() || null;
      const lower = String(error?.message || '').toLowerCase();
      let message = 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';
      if (status === 401) message = 'Sua sessão expirou. Faça login novamente.';
      else if (status === 403 || code === '42501') message = 'Permissão negada ao sincronizar fazendas. Verifique as políticas RLS.';
      else if (status === 404 || code === 'PGRST204' || code === '42703' || lower.includes('schema') || lower.includes('column')) message = 'A estrutura da tabela fazendas não está compatível com o app.';
      else if (code === 'CONFIG_ERROR' || lower.includes('missing_rest_config_or_token')) message = 'Configuração da nuvem ausente. Verifique as variáveis do Supabase.';
      else if (isNetworkError(error) || (error?.name === 'TypeError' && lower.includes('failed to fetch'))) message = 'Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente.';
      logFazendasSync({ operation: 'insert', payloadKeys: Object.keys(payload), rowNome: payload.nome || null, status, code, message, errorName: error?.name || null, errorMessage: error?.message || null, level: 'warn' });
      return { ok: false, data: localRows, error: code || 'SYNC_FAILED', message, syncedCount, failedCount, selectedCount: 0 };
    }
  }

  try {
    const remoteList = await fetchFazendasRest(`fazendas?select=*&owner_user_id=eq.${encodeURIComponent(userId)}`, resolved.token);
    return { ok: true, data: mergeFazendasSafe(localRows, Array.isArray(remoteList) ? remoteList : []), error: null, message: null, syncedCount, failedCount, selectedCount: Array.isArray(remoteList) ? remoteList.length : 0 };
  } catch (error) {
    const msg = classifyFazendasSyncError(error);
    return { ok: false, data: localRows, error: error?.code || 'REMOTE_FETCH_FAILED', message: msg, syncedCount, failedCount, selectedCount: 0 };
  }
}



