import { supabase } from '../lib/supabase.js';

function getSessionUserId(session) {
  return session?.user?.id || null;
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
  const userId = getSessionUserId(session);
  if (!userId) {
    return buildFallback('Sessão indisponível para persistir dados.', sanitizeRecord(record));
  }

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
    return buildFallback(error?.message || 'Falha ao persistir criação.', sanitizeRecord(record));
  }
}

export async function updateOperationalRecord(table, id, patch, session) {
  const userId = getSessionUserId(session);
  if (!userId) {
    return buildFallback('Sessão indisponível para persistir atualização.', sanitizeRecord(patch));
  }

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
    return buildFallback(error?.message || 'Falha ao persistir atualização.', sanitizeRecord(patch));
  }
}

export async function deleteOperationalRecord(table, id, session) {
  const userId = getSessionUserId(session);
  if (!userId) {
    return buildFallback('Sessão indisponível para persistir exclusão.');
  }

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
    return buildFallback(error?.message || 'Falha ao persistir exclusão.');
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

function isNetworkError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror') || message.includes('network request failed');
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
  if (!sessionUserId) {
    return {
      ok: false,
      stage: 'auth_session_missing',
      error: 'AUTH_REQUIRED',
      code: null,
      status: null,
      message: 'Sua sessão expirou. Faça login novamente.',
      details: null,
      hint: null,
    };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.getSession();
    if (authError) throw authError;

    const authSession = authData?.session || null;
    const accessTokenPresent = Boolean(authSession?.access_token);
    const authSessionPresent = Boolean(authSession?.user?.id);

    if (!authSessionPresent || !accessTokenPresent) {
      const payload = {
        stage: 'auth_session_missing',
        sessionUserIdPresent: Boolean(sessionUserId),
        authSessionPresent,
        accessTokenPresent,
        status: null,
        code: null,
        message: 'Sua sessão expirou. Faça login novamente.',
      };
      if (isAuthDebugEnabled()) {
        console.info('[HERDON_CLOUD_HEALTH]', payload);
      }
      return {
        ok: false,
        stage: 'auth_session_missing',
        error: 'AUTH_SESSION_MISSING',
        code: null,
        status: null,
        message: 'Sua sessão expirou. Faça login novamente.',
        details: null,
        hint: null,
      };
    }

    const { error } = await supabase
      .from('fazendas')
      .select('id')
      .eq('owner_user_id', authSession.user.id)
      .limit(1);

    if (error) throw error;

    if (isAuthDebugEnabled()) {
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage: 'ok',
        sessionUserIdPresent: Boolean(sessionUserId),
        authSessionPresent,
        accessTokenPresent,
        status: 200,
        code: null,
        message: 'ok',
      });
    }

    return { ok: true, stage: 'ok', error: null, code: null, status: 200, message: null, details: null, hint: null };
  } catch (error) {
    const code = String(error?.code || '').toUpperCase() || null;
    const status = Number(error?.status) || null;
    const messageLower = String(error?.message || '').toLowerCase();
    const detailsLower = String(error?.details || '').toLowerCase();

    let stage = 'unknown_error';
    let message = 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.';

    if (status == 401 || messageLower.includes('jwt') || messageLower.includes('invalid token') || messageLower.includes('auth')) {
      stage = 'auth_session_missing';
      message = 'Sua sessão expirou. Faça login novamente.';
    } else if (status == 403 || code === '42501' || messageLower.includes('permission denied') || messageLower.includes('row-level security') || detailsLower.includes('row-level security')) {
      stage = 'permission_denied';
      message = 'Permissão negada ao acessar a nuvem. Verifique as políticas RLS.';
    } else if (code === '42703' || code === 'PGRST204' || messageLower.includes('column') || messageLower.includes('schema') || detailsLower.includes('column') || detailsLower.includes('schema')) {
      stage = 'schema_mismatch';
      message = 'A estrutura da tabela fazendas não está compatível com o app.';
    } else if (isNetworkError(error) || (error?.name === 'TypeError' && messageLower.includes('failed to fetch'))) {
      stage = 'network_error';
      message = 'Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente.';
    }

    if (isAuthDebugEnabled()) {
      console.info('[HERDON_CLOUD_HEALTH]', {
        stage,
        sessionUserIdPresent: Boolean(sessionUserId),
        authSessionPresent: null,
        accessTokenPresent: null,
        status,
        code,
        message,
      });
    }

    return {
      ok: false,
      stage,
      error: error?.name || 'CLOUD_HEALTH_FAILED',
      code,
      status,
      message,
      details: error?.details || null,
      hint: error?.hint || null,
    };
  }
}
export async function syncFazendasWithCloud({ fazendas = [], session }) {
  const userId = getSessionUserId(session);
  const localRows = Array.isArray(fazendas) ? fazendas : [];

  if (!userId) {
    logFazendasSync({ operation: 'guard', localCount: localRows.length, level: 'warn' });
    return {
      ok: false,
      data: localRows,
      error: 'AUTH_REQUIRED',
      message: 'Faça login para sincronizar com a nuvem.',
      syncedCount: 0,
      failedCount: 0,
      selectedCount: 0,
    };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (const localRow of localRows) {
    if (getCloudIdMarker(localRow) !== null) {
      continue;
    }

    const { payload } = mapFazendaToCloudPayload(localRow, userId);

    try {
      logFazendasSync({
        sessionUserId: userId,
        localCount: localRows.length,
        operation: 'insert',
        payloadKeys: Object.keys(payload),
        rowNome: payload.nome || null,
      });

      const { error } = await supabase
        .from('fazendas')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;
      syncedCount += 1;
    } catch (error) {
      failedCount += 1;
      logFazendasSync({
        sessionUserId: userId,
        localCount: localRows.length,
        operation: 'insert',
        payloadKeys: Object.keys(payload),
        rowNome: payload.nome || null,
        errorCode: error?.code || null,
        errorMessage: error?.message || null,
        details: error?.details || null,
        hint: error?.hint || null,
        level: 'warn',
      });

      return {
        ok: false,
        data: localRows,
        error: error?.code || 'SYNC_FAILED',
        message: classifyFazendasSyncError(error),
        syncedCount,
        failedCount,
        selectedCount: 0,
      };
    }
  }

  try {
    logFazendasSync({
      sessionUserId: userId,
      localCount: localRows.length,
      operation: 'select',
    });

    const { data: remoteRows, error: fetchError } = await supabase
      .from('fazendas')
      .select('*')
      .eq('owner_user_id', userId);

    if (fetchError) throw fetchError;

    const remoteList = Array.isArray(remoteRows) ? remoteRows : [];
    const merged = mergeFazendasSafe(localRows, remoteList);

    return {
      ok: true,
      data: merged,
      error: null,
      message: null,
      syncedCount,
      failedCount,
      selectedCount: remoteList.length,
    };
  } catch (error) {
    logFazendasSync({
      sessionUserId: userId,
      localCount: localRows.length,
      operation: 'select',
      errorCode: error?.code || null,
      errorMessage: error?.message || null,
      details: error?.details || null,
      hint: error?.hint || null,
      level: 'warn',
    });

    return {
      ok: false,
      data: localRows,
      error: error?.code || 'REMOTE_FETCH_FAILED',
      message: classifyFazendasSyncError(error),
      syncedCount,
      failedCount,
      selectedCount: 0,
    };
  }
}
