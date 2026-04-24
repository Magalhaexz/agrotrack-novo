import { supabase } from '../lib/supabase';
import { initialDb } from '../data/mockData';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function toDateValue(value) {
  if (!value) return null;
  const text = String(value).slice(0, 10);
  return ISO_DATE_PATTERN.test(text) ? text : null;
}

function withPayload(row, payload, selected = {}) {
  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    ...selected,
    id: toFiniteNumber(row.id) ?? row.id,
  };
}

function buildBaseDb() {
  return {
    ...initialDb,
    alertas_resolvidos: Array.isArray(initialDb?.alertas_resolvidos) ? initialDb.alertas_resolvidos : [],
    funcionarios: Array.isArray(initialDb?.funcionarios) ? initialDb.funcionarios : [],
    lotes: Array.isArray(initialDb?.lotes)
      ? initialDb.lotes.map((lote) => ({
          ...lote,
          status: lote?.status || 'ativo',
          data_encerramento: lote?.data_encerramento || null,
          data_venda: lote?.data_venda || null,
        }))
      : [],
    fazendas: Array.isArray(initialDb?.fazendas) ? initialDb.fazendas : [],
    tarefas: Array.isArray(initialDb?.tarefas) ? initialDb.tarefas : [],
    configuracoes: initialDb?.configuracoes || {
      geral: {
        nome_sistema: 'HERDON',
        moeda: 'BRL',
        formato_data: 'DD/MM/AAAA',
        unidade_peso: 'kg',
        rendimento_carcaca_padrao: 52,
        preco_arroba_padrao: 290,
      },
      notificacoes: {
        estoque_critico: true,
        sanitario_vencido: true,
        pesagem_atrasada: true,
        lote_data_saida: true,
        dias_antecedencia: 3,
      },
    },
    usuarios: Array.isArray(initialDb?.usuarios) ? initialDb.usuarios : [],
  };
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('relation') || message.includes('does not exist');
}

function isRlsError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42501' || message.includes('permission denied') || message.includes('row-level security');
}

export function isOperationalModuleUnavailable(error) {
  return isMissingTableError(error) || isRlsError(error);
}

const OPERATIONAL_TABLES = {
  fazendas: {
    table: 'fazendas',
    columns: 'id, nome, status, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        nome: toText(item?.nome),
        status: toText(item?.status) || 'ativa',
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        nome: row.nome,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  lotes: {
    table: 'lotes',
    columns: 'id, faz_id, nome, status, entrada, saida, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        faz_id: toFiniteNumber(item?.faz_id),
        nome: toText(item?.nome),
        status: toText(item?.status) || 'ativo',
        entrada: toDateValue(item?.entrada),
        saida: toDateValue(item?.saida),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        faz_id: toFiniteNumber(row.faz_id),
        nome: row.nome,
        status: row.status,
        entrada: row.entrada,
        saida: row.saida,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  animais: {
    table: 'animais',
    columns: 'id, lote_id, sexo, gen, qtd, p_ini, p_at, dias, consumo, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        sexo: toText(item?.sexo),
        gen: toText(item?.gen),
        qtd: toFiniteNumber(item?.qtd),
        p_ini: toFiniteNumber(item?.p_ini),
        p_at: toFiniteNumber(item?.p_at),
        dias: toFiniteNumber(item?.dias),
        consumo: toFiniteNumber(item?.consumo),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        sexo: row.sexo,
        gen: row.gen,
        qtd: toFiniteNumber(row.qtd) ?? 0,
        p_ini: toFiniteNumber(row.p_ini) ?? 0,
        p_at: toFiniteNumber(row.p_at) ?? 0,
        dias: toFiniteNumber(row.dias) ?? 0,
        consumo: toFiniteNumber(row.consumo) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  pesagens: {
    table: 'pesagens',
    columns: 'id, lote_id, data_registro, peso_medio, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        data_registro: toDateValue(item?.data),
        peso_medio: toFiniteNumber(item?.peso_medio),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        data: row.data_registro,
        peso_medio: toFiniteNumber(row.peso_medio) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  tarefas: {
    table: 'tarefas',
    columns: 'id, titulo, status, prioridade, categoria, responsavel_id, lote_id, fazenda_id, data_vencimento, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        titulo: toText(item?.titulo),
        status: toText(item?.status),
        prioridade: toText(item?.prioridade),
        categoria: toText(item?.categoria),
        responsavel_id: toFiniteNumber(item?.responsavel_id),
        lote_id: toFiniteNumber(item?.lote_id),
        fazenda_id: toFiniteNumber(item?.fazenda_id),
        data_vencimento: toDateValue(item?.data_vencimento),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        titulo: row.titulo,
        status: row.status,
        prioridade: row.prioridade,
        categoria: row.categoria,
        responsavel_id: toFiniteNumber(row.responsavel_id),
        lote_id: toFiniteNumber(row.lote_id),
        fazenda_id: toFiniteNumber(row.fazenda_id),
        data_vencimento: row.data_vencimento,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  rotinas: {
    table: 'rotinas',
    columns: 'id, funcionario_id, lote_id, data_registro, tarefa, setor, status, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        funcionario_id: toFiniteNumber(item?.funcionario_id),
        lote_id: toFiniteNumber(item?.lote_id),
        data_registro: toDateValue(item?.data || item?.data_inicio),
        tarefa: toText(item?.tarefa),
        setor: toText(item?.setor),
        status: toText(item?.status),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        funcionario_id: toFiniteNumber(row.funcionario_id),
        lote_id: toFiniteNumber(row.lote_id),
        data: row.data_registro,
        tarefa: row.tarefa,
        setor: row.setor,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  sanitario: {
    table: 'sanitario',
    columns: 'id, lote_id, tipo, data_registro, proxima, status, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        tipo: toText(item?.tipo),
        data_registro: toDateValue(item?.data),
        proxima: toDateValue(item?.proxima),
        status: toText(item?.status),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        tipo: row.tipo,
        data: row.data_registro,
        proxima: row.proxima,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  estoque: {
    table: 'estoque',
    columns: 'id, lote_id, nome, categoria, unidade, quantidade_atual, quantidade_minima, preco_unitario, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        nome: toText(item?.nome),
        categoria: toText(item?.categoria),
        unidade: toText(item?.unidade),
        quantidade_atual: toFiniteNumber(item?.quantidade_atual),
        quantidade_minima: toFiniteNumber(item?.quantidade_minima),
        preco_unitario: toFiniteNumber(item?.preco_unitario),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        nome: row.nome,
        categoria: row.categoria,
        unidade: row.unidade,
        quantidade_atual: toFiniteNumber(row.quantidade_atual) ?? 0,
        quantidade_minima: toFiniteNumber(row.quantidade_minima) ?? 0,
        preco_unitario: toFiniteNumber(row.preco_unitario) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  movimentacoes_animais: {
    table: 'movimentacoes_animais',
    columns: 'id, lote_id, tipo, data_registro, qtd, peso_medio, valor_total, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id || item?.loteId),
        tipo: toText(item?.tipo),
        data_registro: toDateValue(item?.data),
        qtd: toFiniteNumber(item?.qtd),
        peso_medio: toFiniteNumber(item?.peso_medio),
        valor_total: toFiniteNumber(item?.valor_total),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        loteId: toFiniteNumber(row.lote_id),
        tipo: row.tipo,
        data: row.data_registro,
        qtd: toFiniteNumber(row.qtd) ?? 0,
        peso_medio: toFiniteNumber(row.peso_medio) ?? 0,
        valor_total: toFiniteNumber(row.valor_total) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  movimentacoes_estoque: {
    table: 'movimentacoes_estoque',
    columns: 'id, item_estoque_id, lote_id, tipo, data_registro, quantidade, custo_total, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        item_estoque_id: toFiniteNumber(item?.item_estoque_id),
        lote_id: toFiniteNumber(item?.lote_id),
        tipo: toText(item?.tipo),
        data_registro: toDateValue(item?.data),
        quantidade: toFiniteNumber(item?.quantidade),
        custo_total: toFiniteNumber(item?.custo_total),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        item_estoque_id: toFiniteNumber(row.item_estoque_id),
        lote_id: toFiniteNumber(row.lote_id),
        tipo: row.tipo,
        data: row.data_registro,
        quantidade: toFiniteNumber(row.quantidade) ?? 0,
        custo_total: toFiniteNumber(row.custo_total) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  movimentacoes_financeiras: {
    table: 'movimentacoes_financeiras',
    columns: 'id, lote_id, tipo, categoria, data_registro, valor, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        tipo: toText(item?.tipo),
        categoria: toText(item?.categoria),
        data_registro: toDateValue(item?.data),
        valor: toFiniteNumber(item?.valor),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        tipo: row.tipo,
        categoria: row.categoria,
        data: row.data_registro,
        valor: toFiniteNumber(row.valor) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
  custos: {
    table: 'custos',
    columns: 'id, lote_id, categoria, descricao, data_registro, valor, payload, created_at, updated_at',
    toRow(userId, item) {
      const id = toFiniteNumber(item?.id);
      if (id == null) return null;
      return {
        owner_user_id: userId,
        id,
        lote_id: toFiniteNumber(item?.lote_id),
        categoria: toText(item?.cat || item?.categoria),
        descricao: toText(item?.desc || item?.descricao),
        data_registro: toDateValue(item?.data),
        valor: toFiniteNumber(item?.val || item?.valor),
        payload: item,
        created_at: item?.created_at || undefined,
        updated_at: item?.updated_at || undefined,
      };
    },
    fromRow(row) {
      return withPayload(row, row.payload, {
        lote_id: toFiniteNumber(row.lote_id),
        cat: row.categoria,
        categoria: row.categoria,
        desc: row.descricao,
        descricao: row.descricao,
        data: row.data_registro,
        val: toFiniteNumber(row.valor) ?? 0,
        valor: toFiniteNumber(row.valor) ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    },
  },
};

export const PERSISTED_COLLECTION_KEYS = Object.keys(OPERATIONAL_TABLES);

async function fetchCollection(key) {
  const config = OPERATIONAL_TABLES[key];
  const response = await supabase
    .from(config.table)
    .select(config.columns)
    .order('id', { ascending: true });

  if (response.error) {
    return { data: null, error: response.error };
  }

  return {
    data: (response.data || []).map((row) => config.fromRow(row)),
    error: null,
  };
}

export async function loadOperationalSnapshot() {
  const entries = await Promise.all(
    PERSISTED_COLLECTION_KEYS.map(async (key) => {
      const response = await fetchCollection(key);
      return [key, response];
    })
  );

  const snapshot = {};

  for (const [key, response] of entries) {
    if (response.error) {
      return { data: null, error: response.error };
    }
    snapshot[key] = response.data || [];
  }

  return { data: snapshot, error: null };
}

function chunkIds(values, chunkSize = 100) {
  const ids = values.slice();
  const chunks = [];
  while (ids.length) {
    chunks.push(ids.splice(0, chunkSize));
  }
  return chunks;
}

async function replaceCollection(key, items, userId) {
  const config = OPERATIONAL_TABLES[key];
  const normalizedRows = (items || [])
    .map((item) => config.toRow(userId, item))
    .filter(Boolean);

  const existingResponse = await supabase.from(config.table).select('id').order('id', { ascending: true });
  if (existingResponse.error) {
    return { error: existingResponse.error };
  }

  if (normalizedRows.length) {
    const upsertResponse = await supabase
      .from(config.table)
      .upsert(normalizedRows, { onConflict: 'owner_user_id,id' });

    if (upsertResponse.error) {
      return { error: upsertResponse.error };
    }
  }

  const incomingIds = new Set(normalizedRows.map((row) => Number(row.id)));
  const idsToDelete = (existingResponse.data || [])
    .map((row) => Number(row.id))
    .filter((id) => !incomingIds.has(id));

  for (const chunk of chunkIds(idsToDelete)) {
    const deleteResponse = await supabase.from(config.table).delete().in('id', chunk);
    if (deleteResponse.error) {
      return { error: deleteResponse.error };
    }
  }

  return { error: null };
}

export async function syncOperationalCollections(changes, userId) {
  for (const [key, items] of Object.entries(changes || {})) {
    const response = await replaceCollection(key, items, userId);
    if (response.error) {
      return response;
    }
  }

  return { error: null };
}

export function mergeSnapshotIntoDb(snapshot) {
  const base = buildBaseDb();
  const merged = { ...base };

  for (const key of PERSISTED_COLLECTION_KEYS) {
    if (Array.isArray(snapshot?.[key])) {
      merged[key] = snapshot[key];
    }
  }

  return merged;
}

export function createOperationalFallbackDb() {
  return buildBaseDb();
}
