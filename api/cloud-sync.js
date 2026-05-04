/* global process */
import { getSupabaseAdminClient, getSupabaseServerEnvStatus, resolveAuthenticatedUser } from './_supabaseAdmin.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function isMalformedAuthorizationHeader(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  if (!raw) return false;
  const header = String(raw).trim();
  if (!header.toLowerCase().startsWith('bearer ')) return true;
  const token = header.slice(7).trim();
  return !token || token === 'undefined' || token === 'null' || token.includes('{') || token.includes('}') || token.includes('[object Object]') || token.split('.').length !== 3;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNullableString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asNullableDateString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asUuidOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(text) ? text : null;
}

function normalizeMetadata(metadata, localId, source) {
  const base = isObject(metadata) ? { ...metadata } : {};
  base.local_id = localId ?? null;
  base.synced_from = source;
  base.synced_at = new Date().toISOString();
  return base;
}

function mapFazendaPayload(row, userId) {
  const localId = row?.id ?? null;
  const metadata = normalizeMetadata(row?.metadata, localId, 'herdon_serverless_sync_fazendas');

  return {
    owner_user_id: userId,
    nome: asNullableString(row?.nome),
    proprietario: asNullableString(row?.proprietario ?? row?.responsavel),
    cidade: asNullableString(row?.cidade),
    estado: asNullableString(row?.estado),
    area_total_ha: asNullableNumber(row?.area_total_ha ?? row?.hectares ?? row?.area),
    area_pastagem_ha: asNullableNumber(row?.area_pastagem_ha ?? row?.hectares_pastagem),
    capacidade_ua: asNullableNumber(row?.capacidade_ua ?? row?.capacidade_lotacao),
    tipo_producao: asNullableString(row?.tipo_producao),
    inscricao_estadual: asNullableString(row?.inscricao_estadual),
    cnpj_cpf: asNullableString(row?.cnpj_cpf),
    telefone: asNullableString(row?.telefone),
    email: asNullableString(row?.email),
    endereco: asNullableString(row?.endereco),
    status: asNullableString(row?.status),
    observacoes: asNullableString(row?.observacoes ?? row?.observacao ?? row?.obs),
    metadata,
  };
}

function mapLotePayload(row, userId) {
  const localId = row?.id ?? null;
  const metadata = normalizeMetadata(row?.metadata, localId, 'herdon_serverless_sync_lotes');
  const cloudUuid = asUuidOrNull(row?.cloud_id ?? row?.metadata?.cloud_id);
  if (cloudUuid) metadata.cloud_id = cloudUuid;

  return {
    owner_user_id: userId,
    nome: asNullableString(row?.nome),
    faz_id: asNullableNumber(row?.faz_id),
    entrada: asNullableDateString(row?.entrada),
    saida: asNullableDateString(row?.saida),
    status: asNullableString(row?.status),
    tipo: asNullableString(row?.tipo),
    sistema: asNullableString(row?.sistema),
    gmd_meta: asNullableNumber(row?.gmd_meta),
    preco_arroba: asNullableNumber(row?.preco_arroba),
    rendimento_carcaca: asNullableNumber(row?.rendimento_carcaca),
    investimento: asNullableNumber(row?.investimento),
    peso_alvo: asNullableNumber(row?.peso_alvo),
    raca: asNullableString(row?.raca),
    sexo: asNullableString(row?.sexo),
    categoria: asNullableString(row?.categoria),
    obs: asNullableString(row?.obs),
    p_ini: asNullableNumber(row?.p_ini),
    p_at: asNullableNumber(row?.p_at),
    ultima_pesagem: asNullableDateString(row?.ultima_pesagem),
    data_saida: asNullableDateString(row?.data_saida),
    fechamento: isObject(row?.fechamento) ? row.fechamento : null,
    metadata,
    cloud_id: cloudUuid,
  };
}

function localIdOf(row) {
  return row?.id !== undefined && row?.id !== null ? String(row.id) : null;
}

function findRemoteMatch(localRow, remoteRows) {
  const cloudId = asUuidOrNull(localRow?.cloud_id ?? localRow?.metadata?.cloud_id);
  const localId = localIdOf(localRow);

  return remoteRows.find((remote) => {
    const remoteId = remote?.id ? String(remote.id) : null;
    const remoteCloudId = remote?.cloud_id ? String(remote.cloud_id) : null;
    const remoteLocalId = remote?.metadata?.local_id !== undefined && remote?.metadata?.local_id !== null
      ? String(remote.metadata.local_id)
      : null;

    if (cloudId && (remoteId === cloudId || remoteCloudId === cloudId)) return true;
    if (localId && remoteLocalId && localId === remoteLocalId) return true;
    if (localId && remoteId && localId === remoteId) return true;
    return false;
  }) || null;
}

function mergeRecords(localRows, remoteRows) {
  const merged = [];
  const used = new Set();

  for (const localRow of localRows) {
    const matchIndex = remoteRows.findIndex((remote, idx) => {
      if (used.has(idx)) return false;
      const same = findRemoteMatch(localRow, [remote]);
      return Boolean(same);
    });

    if (matchIndex === -1) {
      merged.push(localRow);
      continue;
    }

    used.add(matchIndex);
    const remote = remoteRows[matchIndex];
    merged.push({
      ...localRow,
      ...remote,
      metadata: {
        ...(isObject(localRow?.metadata) ? localRow.metadata : {}),
        ...(isObject(remote?.metadata) ? remote.metadata : {}),
        cloud_id: remote?.cloud_id ?? remote?.id ?? null,
      },
    });
  }

  remoteRows.forEach((remote, idx) => {
    if (!used.has(idx)) merged.push(remote);
  });

  return merged;
}

async function syncModule({ client, table, localRows, userId, mapper }) {
  const rows = Array.isArray(localRows) ? localRows : [];
  let syncedCount = 0;
  let failedCount = 0;

  const remoteResponse = await client.from(table).select('*').eq('owner_user_id', userId);
  if (remoteResponse.error) throw remoteResponse.error;
  let remoteRows = Array.isArray(remoteResponse.data) ? remoteResponse.data : [];

  for (const localRow of rows) {
    const payload = mapper(localRow, userId);
    const match = findRemoteMatch(localRow, remoteRows);

    if (match?.id) {
      const updateResponse = await client
        .from(table)
        .update(payload)
        .eq('id', match.id)
        .eq('owner_user_id', userId)
        .select('*')
        .single();

      if (updateResponse.error) {
        failedCount += 1;
        continue;
      }

      syncedCount += 1;
      remoteRows = remoteRows.map((item) => (item.id === match.id ? updateResponse.data : item));
      continue;
    }

    const insertResponse = await client
      .from(table)
      .insert(payload)
      .select('*')
      .single();

    if (insertResponse.error) {
      failedCount += 1;
      continue;
    }

    syncedCount += 1;
    remoteRows.push(insertResponse.data);
  }

  return {
    status: failedCount > 0 ? 'error' : 'success',
    syncedCount,
    failedCount,
    selectedCount: remoteRows.length,
    data: mergeRecords(rows, remoteRows),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, message: 'Método não permitido.' });
  }

  const env = getSupabaseServerEnvStatus();
  if (!env.supabaseUrlPresent || !env.serviceRolePresent) {
    return json(res, 500, {
      ok: false,
      message: 'Configuração do servidor de nuvem incompleta.',
      fazendas: { status: 'error', syncedCount: 0, failedCount: 0 },
      lotes: { status: 'error', syncedCount: 0, failedCount: 0 },
    });
  }

  if (isMalformedAuthorizationHeader(req)) {
    return json(res, 401, { ok: false, message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.' });
  }

  const authenticatedUser = await resolveAuthenticatedUser(req);
  if (!authenticatedUser?.id) {
    return json(res, 401, {
      ok: false,
      message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
      fazendas: { status: 'error', syncedCount: 0, failedCount: 0 },
      lotes: { status: 'error', syncedCount: 0, failedCount: 0 },
    });
  }
  const userId = String(authenticatedUser.id);

  const fazendas = req.body?.fazendas;
  const lotes = req.body?.lotes;

  if (!Array.isArray(fazendas) || !Array.isArray(lotes)) {
    return json(res, 400, {
      ok: false,
      message: 'Estrutura da tabela incompatível com o app.',
      fazendas: { status: 'error', syncedCount: 0, failedCount: 0 },
      lotes: { status: 'error', syncedCount: 0, failedCount: 0 },
    });
  }

  try {
    const client = getSupabaseAdminClient();

    const [fazendasResult, lotesResult] = await Promise.all([
      syncModule({
        client,
        table: 'fazendas',
        localRows: fazendas,
        userId,
        mapper: mapFazendaPayload,
      }),
      syncModule({
        client,
        table: 'lotes',
        localRows: lotes,
        userId,
        mapper: mapLotePayload,
      }),
    ]);

    const ok = fazendasResult.status === 'success' && lotesResult.status === 'success';

    if (process.env.NODE_ENV !== 'production') {
      console.info('[HERDON_CLOUD_SERVER_SYNC]', {
        module: 'fazendas',
        table: 'fazendas',
        status: fazendasResult.status,
        syncedCount: fazendasResult.syncedCount,
        failedCount: fazendasResult.failedCount,
        safeMessage: fazendasResult.status === 'success' ? 'sync_ok' : 'sync_partial_error',
      });
      console.info('[HERDON_CLOUD_SERVER_SYNC]', {
        module: 'lotes',
        table: 'lotes',
        status: lotesResult.status,
        syncedCount: lotesResult.syncedCount,
        failedCount: lotesResult.failedCount,
        safeMessage: lotesResult.status === 'success' ? 'sync_ok' : 'sync_partial_error',
      });
    }

    return json(res, ok ? 200 : 207, {
      ok,
      message: ok
        ? 'Nuvem conectada pelo servidor.'
        : 'Não foi possível sincronizar pelo servidor. O modo local continua ativo.',
      fazendas: fazendasResult,
      lotes: lotesResult,
    });
  } catch {
    return json(res, 502, {
      ok: false,
      message: 'Falha ao conectar o servidor à nuvem.',
      fazendas: { status: 'error', syncedCount: 0, failedCount: 0 },
      lotes: { status: 'error', syncedCount: 0, failedCount: 0 },
    });
  }
}
