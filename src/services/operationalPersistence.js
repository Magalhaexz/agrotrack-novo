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

function normalizeFazendaRecord(record = {}) {
  const safe = sanitizeRecord(record);
  return {
    ...safe,
    id: safe?.id ?? null,
  };
}

function mergeFazendasSafe(localRows = [], remoteRows = []) {
  const mergedById = new Map();
  const pendingLocalRows = [];

  localRows.forEach((row) => {
    const normalized = normalizeFazendaRecord(row);
    if (normalized?.id === null || normalized?.id === undefined) {
      pendingLocalRows.push(normalized);
      return;
    }
    mergedById.set(String(normalized.id), normalized);
  });

  remoteRows.forEach((row) => {
    const normalized = normalizeFazendaRecord(row);
    if (normalized?.id === null || normalized?.id === undefined) {
      return;
    }
    mergedById.set(String(normalized.id), {
      ...(mergedById.get(String(normalized.id)) || {}),
      ...normalized,
    });
  });

  return [...mergedById.values(), ...pendingLocalRows];
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
  let syncedCount = 0;
  let failedCount = 0;

  for (const localRow of localRows) {
    const payload = {
      ...sanitizeRecord(localRow),
      owner_user_id: userId,
    };

    try {
      const hasId = payload?.id !== undefined && payload?.id !== null;
      let query = supabase.from('fazendas');
      if (hasId) {
        query = query.upsert(payload, { onConflict: 'id' });
      } else {
        query = query.insert(payload);
      }
      const { error } = await query.select('*').single();
      if (error) {
        failedCount += 1;
      } else {
        syncedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  try {
    const { data: remoteRows, error: fetchError } = await supabase
      .from('fazendas')
      .select('*')
      .eq('owner_user_id', userId);

    if (fetchError) {
      return {
        ok: false,
        data: localRows,
        error: 'REMOTE_FETCH_FAILED',
        syncedCount,
        failedCount: failedCount + 1,
      };
    }

    const merged = mergeFazendasSafe(localRows, Array.isArray(remoteRows) ? remoteRows : []);
    return {
      ok: failedCount === 0,
      data: merged,
      error: failedCount > 0 ? 'PARTIAL_SYNC_FAILED' : null,
      syncedCount,
      failedCount,
    };
  } catch {
    return {
      ok: false,
      data: localRows,
      error: 'REMOTE_FETCH_FAILED',
      syncedCount,
      failedCount: failedCount + 1,
    };
  }
}
