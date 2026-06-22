import { supabase } from '../lib/supabase.js';
import { createOperationalRecord } from './operationalPersistence.js';
import { moverLoteParaPasto } from './movimentacaoPastos.js';

const STORAGE_KEY = 'herdon-campo-offline-queue';
export const QUEUE_UPDATED_EVENT = 'herdon-campo-offline-queue-updated';

export const TIPOS_OPERACAO_OFFLINE = [
  'pesagem_lote',
  'pesagem_animal',
  'movimentacao_pasto',
  'despesa_simples',
  'ocorrencia_manejo',
];

const AUTO_RETRY_TENTATIVAS_LIMITE = 5;

const FRIENDLY_PENDING_MESSAGE = 'Ainda não foi possível enviar este registro. Vamos tentar novamente quando a internet voltar.';
const FRIENDLY_STORAGE_ERROR = 'Não foi possível salvar este registro neste aparelho. Tente liberar espaço ou usar outro navegador.';
const FRIENDLY_STALE_PASTO = 'Este lote já foi movido para outro pasto antes da sincronização. Confira o pasto atual e repita a movimentação se necessário.';
const FRIENDLY_NO_SESSION = 'Entre na sua conta para sincronizar os registros salvos neste aparelho.';

function getSessionUserId(session) {
  return session?.user?.id || null;
}

export function isOnline() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

function gerarIdLocal() {
  return `campo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(queue) ? queue : []));
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(QUEUE_UPDATED_EVENT, { detail: { checkedAt: Date.now() } }));
    }
    return true;
  } catch {
    return false;
  }
}

function atualizarItem(idLocal, patch) {
  const queue = readQueue();
  const index = queue.findIndex((item) => item.id_local === idLocal);
  if (index === -1) return null;
  const atualizado = { ...queue[index], ...patch };
  queue[index] = atualizado;
  writeQueue(queue);
  return atualizado;
}

/**
 * Chave determinística para detectar reenvio do mesmo registro (duplo clique,
 * nova tentativa após falha). Não é uma garantia de idempotência no banco —
 * é uma proteção local mínima, documentada como limitação do MVP.
 */
export function construirChaveIdempotencia(tipoOperacao, payload = {}) {
  switch (tipoOperacao) {
    case 'pesagem_lote':
      return `pesagem_lote:${payload.loteId}:${payload.data}:${payload.pesoMedio}`;
    case 'pesagem_animal':
      return `pesagem_animal:${payload.animalId}:${payload.data}:${payload.pesoMedio}`;
    case 'movimentacao_pasto':
      return `movimentacao_pasto:${payload.loteId}:${payload.pastagemDestinoId}:${payload.dataMovimentacao}`;
    case 'despesa_simples':
      return `despesa_simples:${payload.fazendaId}:${payload.data}:${payload.valor}:${payload.descricao}`;
    case 'ocorrencia_manejo':
      return `ocorrencia_manejo:${payload.loteId || payload.fazendaId}:${payload.data}:${payload.tipo}:${payload.descricao}`;
    default:
      return `${tipoOperacao}:${JSON.stringify(payload)}`;
  }
}

export function listarFilaOffline(session) {
  const ownerUserId = getSessionUserId(session);
  const queue = readQueue();
  if (!ownerUserId) return [];
  return queue.filter((item) => item.owner_user_id === ownerUserId);
}

export function obterResumoFilaOffline(session) {
  const itens = listarFilaOffline(session)
    .slice()
    .sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
  return {
    pendentes: itens.filter((item) => item.status === 'pendente').length,
    sincronizados: itens.filter((item) => item.status === 'sincronizado').length,
    comErro: itens.filter((item) => item.status === 'erro').length,
    itens,
  };
}

/**
 * Adiciona uma operação à fila do Modo Campo. Se já existir um item
 * pendente/com erro com a mesma chave de idempotência, não duplica — retorna
 * o item existente.
 */
export function adicionarOperacaoOffline(tipoOperacao, payload, session) {
  if (!TIPOS_OPERACAO_OFFLINE.includes(tipoOperacao)) {
    return { ok: false, item: null, duplicado: false, error: `Tipo de operação offline desconhecido: ${tipoOperacao}` };
  }
  const ownerUserId = getSessionUserId(session);
  if (!ownerUserId) {
    return { ok: false, item: null, duplicado: false, error: FRIENDLY_NO_SESSION };
  }

  const chaveIdempotencia = construirChaveIdempotencia(tipoOperacao, payload);
  const queueCompleta = readQueue();
  const existente = queueCompleta.find((item) => (
    item.owner_user_id === ownerUserId
    && item.chave_idempotencia === chaveIdempotencia
    && item.status !== 'sincronizado'
  ));
  if (existente) {
    return { ok: true, item: existente, duplicado: true, error: null };
  }

  const item = {
    id_local: gerarIdLocal(),
    tipo_operacao: tipoOperacao,
    payload,
    status: 'pendente',
    tentativas: 0,
    erro: null,
    criado_em: new Date().toISOString(),
    sincronizado_em: null,
    owner_user_id: ownerUserId,
    chave_idempotencia: chaveIdempotencia,
  };

  const gravou = writeQueue([...queueCompleta, item]);
  if (!gravou) {
    return { ok: false, item: null, duplicado: false, error: FRIENDLY_STORAGE_ERROR };
  }
  return { ok: true, item, duplicado: false, error: null };
}

export function removerOperacaoOffline(idLocal, session) {
  const ownerUserId = getSessionUserId(session);
  const queue = readQueue();
  const next = queue.filter((item) => !(item.id_local === idLocal && item.owner_user_id === ownerUserId));
  if (next.length === queue.length) return false;
  return writeQueue(next);
}

export function getFriendlyPendingMessage() {
  return FRIENDLY_PENDING_MESSAGE;
}

/**
 * Aplica, de forma pura, o efeito de um item sincronizado sobre o `db` em
 * memória — para o resto do app refletir o novo registro sem precisar
 * recarregar a página. Usada tanto pela sincronização automática quanto
 * pelo retry manual de um único item.
 */
export function aplicarItemSincronizadoNoDb(db, item, data) {
  if (!db || !item) return db;

  if (item.tipo_operacao === 'movimentacao_pasto') {
    const loteId = item.payload?.loteId;
    const pastagemDestinoId = item.payload?.pastagemDestinoId;
    if (loteId == null) return db;
    return {
      ...db,
      lotes: (db.lotes || []).map((lote) => (
        Number(lote.id) === Number(loteId) ? { ...lote, pastagem_id: pastagemDestinoId } : lote
      )),
    };
  }

  if (!data) return db;
  const tabela = item.tipo_operacao === 'despesa_simples'
    ? 'movimentacoes_financeiras'
    : item.tipo_operacao === 'ocorrencia_manejo'
      ? 'sanitario'
      : 'pesagens';

  return { ...db, [tabela]: [...(db[tabela] || []), data] };
}

async function sincronizarPesagem(item, session) {
  const { loteId, animalId, data, pesoMedio, quantidadeCabecas, observacao } = item.payload || {};
  const payload = {
    lote_id: loteId,
    animal_id: item.tipo_operacao === 'pesagem_animal' ? (animalId ?? null) : null,
    data,
    peso_medio: pesoMedio,
    tipo: item.tipo_operacao === 'pesagem_animal' ? 'animal' : 'lote',
    observacao: [observacao, quantidadeCabecas ? `Cabeças pesadas: ${quantidadeCabecas}` : null].filter(Boolean).join(' · '),
    metadata: { idempotency_key: item.chave_idempotencia, origem: 'modo_campo_offline' },
  };
  const resultado = await createOperationalRecord('pesagens', payload, session, { skipQueueOnFailure: true });
  return { ok: Boolean(resultado?.persisted), data: resultado?.data || null, error: resultado?.error || null };
}

async function sincronizarMovimentacaoPasto(item) {
  const { loteId, pastagemDestinoId, dataMovimentacao, quantidadeCabecas, motivo, observacoes, pastagemOrigemEsperada } = item.payload || {};

  const { data: loteAtual, error: erroConsulta } = await supabase
    .from('lotes')
    .select('pastagem_id')
    .eq('id', loteId)
    .maybeSingle();

  if (erroConsulta) {
    return { ok: false, data: null, error: 'Não foi possível confirmar o pasto atual do lote antes de sincronizar. Tente novamente.' };
  }

  const pastagemAtual = loteAtual?.pastagem_id ?? null;
  const esperada = pastagemOrigemEsperada ?? null;
  if (String(pastagemAtual || '') !== String(esperada || '')) {
    return { ok: false, data: null, error: FRIENDLY_STALE_PASTO, code: 'stale_state' };
  }

  const resultado = await moverLoteParaPasto({
    loteId,
    pastagemDestinoId,
    dataMovimentacao,
    quantidadeCabecas,
    motivo,
    observacoes,
  });
  return { ok: Boolean(resultado?.success), data: resultado?.data || null, error: resultado?.error || null };
}

async function sincronizarDespesa(item, session) {
  const { fazendaId, data, descricao, valor, categoria, observacoes } = item.payload || {};
  const payload = {
    tipo: 'despesa',
    fazenda_id: fazendaId,
    data,
    descricao,
    valor,
    categoria: categoria || 'Outros',
    observacao: observacoes || '',
    metadata: { idempotency_key: item.chave_idempotencia, origem: 'modo_campo_offline' },
  };
  const resultado = await createOperationalRecord('movimentacoes_financeiras', payload, session, { skipQueueOnFailure: true });
  return { ok: Boolean(resultado?.persisted), data: resultado?.data || null, error: resultado?.error || null };
}

async function sincronizarOcorrencia(item, session) {
  const { fazendaId, loteId, data, tipo, descricao, observacoes } = item.payload || {};
  const payload = {
    fazenda_id: fazendaId,
    lote_id: loteId || null,
    tipo,
    desc: descricao,
    data_aplic: data,
    obs: observacoes || '',
    metadata: { idempotency_key: item.chave_idempotencia, origem: 'modo_campo_offline' },
  };
  const resultado = await createOperationalRecord('sanitario', payload, session, { skipQueueOnFailure: true });
  return { ok: Boolean(resultado?.persisted), data: resultado?.data || null, error: resultado?.error || null };
}

async function sincronizarItem(item, session) {
  switch (item.tipo_operacao) {
    case 'pesagem_lote':
    case 'pesagem_animal':
      return sincronizarPesagem(item, session);
    case 'movimentacao_pasto':
      return sincronizarMovimentacaoPasto(item);
    case 'despesa_simples':
      return sincronizarDespesa(item, session);
    case 'ocorrencia_manejo':
      return sincronizarOcorrencia(item, session);
    default:
      return { ok: false, data: null, error: `Tipo de operação offline desconhecido: ${item.tipo_operacao}` };
  }
}

/**
 * Tenta sincronizar um único item e grava o resultado na fila. Nunca apaga
 * um item com erro — apenas atualiza tentativas/erro e mantém na fila para
 * nova tentativa.
 */
async function tentarSincronizarItem(item, session, { onItemSynced } = {}) {
  const tentativas = Number(item.tentativas || 0);
  const resultado = await sincronizarItem(item, session);
  if (resultado.ok) {
    atualizarItem(item.id_local, {
      status: 'sincronizado',
      sincronizado_em: new Date().toISOString(),
      erro: null,
    });
    onItemSynced?.(item, resultado.data);
    return true;
  }
  atualizarItem(item.id_local, {
    status: 'erro',
    tentativas: tentativas + 1,
    erro: resultado.error || 'Não foi possível sincronizar agora.',
  });
  return false;
}

/**
 * Sincroniza um único item da fila pelo id_local (retry manual a partir da
 * lista de pendências).
 */
export async function sincronizarItemDaFilaOffline(idLocal, session, { onItemSynced } = {}) {
  const ownerUserId = getSessionUserId(session);
  if (!ownerUserId) {
    return { ok: false, semSessao: true, error: FRIENDLY_NO_SESSION };
  }
  if (!isOnline()) {
    return { ok: false, offline: true, error: 'Sem internet agora. Tente novamente quando a conexão voltar.' };
  }
  const item = listarFilaOffline(session).find((registro) => registro.id_local === idLocal);
  if (!item) {
    return { ok: false, error: 'Registro não encontrado nesta fila.' };
  }
  const ok = await tentarSincronizarItem(item, session, { onItemSynced });
  if (ok) return { ok: true, error: null };
  const atualizado = listarFilaOffline(session).find((registro) => registro.id_local === idLocal);
  return { ok: false, error: atualizado?.erro || 'Não foi possível sincronizar agora.' };
}

/**
 * Processa a fila do Modo Campo: tenta sincronizar cada item pendente/com
 * erro do usuário da sessão atual.
 */
export async function sincronizarFilaOffline(session, { manual = false, onItemSynced } = {}) {
  const ownerUserId = getSessionUserId(session);
  if (!ownerUserId) {
    return { sincronizados: 0, comErro: 0, pendentes: 0, semSessao: true };
  }
  if (!isOnline()) {
    const resumo = obterResumoFilaOffline(session);
    return { sincronizados: 0, comErro: resumo.comErro, pendentes: resumo.pendentes, semSessao: false, offline: true };
  }

  const aProcessar = listarFilaOffline(session).filter((item) => item.status !== 'sincronizado');
  let sincronizados = 0;

  for (const item of aProcessar) {
    const tentativas = Number(item.tentativas || 0);
    if (!manual && tentativas >= AUTO_RETRY_TENTATIVAS_LIMITE) {
      continue;
    }
    const ok = await tentarSincronizarItem(item, session, { onItemSynced });
    if (ok) sincronizados += 1;
  }

  const restante = obterResumoFilaOffline(session);
  return { sincronizados, comErro: restante.comErro, pendentes: restante.pendentes, semSessao: false };
}
