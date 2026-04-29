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

export async function syncFazendasWithCloud({ fazendas = [], session }) {
  const userId = getSessionUserId(session);
  if (!userId) {
    return {
      ok: false,
      data: Array.isArray(fazendas) ? fazendas : [],
      error: 'AUTH_REQUIRED',
      syncedCount: 0,
      failedCount: 0,
    };
  }

  const localRows = Array.isArray(fazendas) ? fazendas : [];
  const errors = [];
  let syncedCount = 0;
  let failedCount = 0;
  let selectedCount = 0;

  for (const localRow of localRows) {
    const { localId, payload } = mapFazendaToCloudPayload(localRow, userId);
    const cloudId = getCloudIdMarker(localRow);

    try {
      let result = null;
      if (cloudId !== null && cloudId !== undefined && cloudId !== '') {
        result = await supabase
          .from('fazendas')
          .update(payload)
          .eq('id', cloudId)
          .eq('owner_user_id', userId)
          .select('*')
          .maybeSingle();
        if (result.error) throw result.error;
        if (!result.data) {
          result = await supabase
            .from('fazendas')
            .insert(payload)
            .select('*')
            .single();
        }
      } else {
        result = await supabase
          .from('fazendas')
          .insert(payload)
          .select('*')
          .single();
      }

      const { error } = result || {};
      if (error) {
        failedCount += 1;
        errors.push(error);
        if (import.meta.env.DEV) {
          console.warn('[HERDON_FAZENDAS_SYNC]', {
            stage: 'row_push_error',
            localId,
            errorCode: error?.code || null,
            errorMessage: error?.message || 'push_error',
            payloadKeys: Object.keys(payload),
          });
        }
      } else {
        syncedCount += 1;
        if (import.meta.env.DEV) {
          console.debug('[HERDON_FAZENDAS_SYNC]', {
            stage: 'row_push_success',
            localId,
            payloadKeys: Object.keys(payload),
          });
        }
      }
    } catch (error) {
      failedCount += 1;
      errors.push(error);
      if (import.meta.env.DEV) {
        console.warn('[HERDON_FAZENDAS_SYNC]', {
          stage: 'row_push_exception',
          localId,
          errorCode: error?.code || null,
          errorMessage: error?.message || String(error),
          payloadKeys: Object.keys(payload),
        });
      }
    }
  }

  try {
    const { data: remoteRows, error: fetchError } = await supabase
      .from('fazendas')
      .select('*')
      .eq('owner_user_id', userId);

    if (fetchError) {
      if (import.meta.env.DEV) {
        console.warn('[HERDON_FAZENDAS_SYNC]', {
          stage: 'remote_fetch_error',
          localCount: localRows.length,
          syncedCount,
          failedCount,
          selectCount: 0,
          errorCode: fetchError?.code || null,
          errorMessage: fetchError?.message || 'fetch_error',
        });
      }
      return {
        ok: false,
        data: localRows,
        error: 'REMOTE_FETCH_FAILED',
        syncedCount,
        failedCount,
      };
    }

    const remoteList = Array.isArray(remoteRows) ? remoteRows : [];
    selectedCount = remoteList.length;
    const merged = mergeFazendasSafe(localRows, remoteList);
    const fetchedSuccessfully = true;
    const ok = (syncedCount > 0 || fetchedSuccessfully) && failedCount === 0;

    if (import.meta.env.DEV) {
      console.debug('[HERDON_FAZENDAS_SYNC]', {
        stage: 'sync_completed',
        localCount: localRows.length,
        syncedCount,
        failedCount,
        selectCount: selectedCount,
        hasErrors: errors.length > 0,
      });
    }

    return {
      ok,
      data: merged,
      error: failedCount > 0 ? 'PARTIAL_SYNC_FAILED' : null,
      syncedCount,
      failedCount,
      selectedCount,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[HERDON_FAZENDAS_SYNC]', {
        stage: 'sync_exception',
        localCount: localRows.length,
        syncedCount,
        failedCount,
        selectCount: selectedCount,
        errorCode: error?.code || null,
        errorMessage: error?.message || String(error),
      });
    }
    return {
      ok: false,
      data: localRows,
      error: 'REMOTE_FETCH_FAILED',
      syncedCount,
      failedCount,
      selectedCount,
    };
  }
}
