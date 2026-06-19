import { supabase } from '../lib/supabase.js';
import { formatDate } from '../utils/calculations.js';

const FRIENDLY_GENERIC_ERROR = 'Não foi possível confirmar a movimentação agora. Tente novamente em alguns instantes.';
const FRIENDLY_SESSION_ERROR = 'Sua sessão expirou. Entre novamente para continuar.';
const FRIENDLY_PERMISSION_ERROR = 'Você não tem permissão para executar esta ação.';
const FRIENDLY_NETWORK_ERROR = 'Não foi possível conectar agora. Verifique sua internet e tente novamente.';
const NETWORK_ERROR_PATTERNS = ['failed to fetch', 'networkerror', 'network request failed', 'fetch failed', 'timeout'];

const PASTAGEM_EMBED_SELECT = '*, pastagem_origem:pastagem_origem_id(id, nome), pastagem_destino:pastagem_destino_id(id, nome)';

function toNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTextOrNull(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

export function getFriendlyErrorMessage(error) {
  if (!error) return FRIENDLY_GENERIC_ERROR;
  const message = String(error?.message || error?.error_description || '').trim();
  const lower = message.toLowerCase();
  const status = Number(error?.status) || null;

  if (NETWORK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return FRIENDLY_NETWORK_ERROR;
  }
  if (status === 401 || lower.includes('jwt') || lower.includes('session')) {
    return FRIENDLY_SESSION_ERROR;
  }
  if (lower.includes('row-level security') || lower.includes('permission denied for')) {
    return FRIENDLY_PERMISSION_ERROR;
  }
  // Mensagens lançadas por mover_lote_para_pasto já são amigáveis e em português.
  return message || FRIENDLY_GENERIC_ERROR;
}

function ordenarHistoricoDesc(lista) {
  return [...lista].sort((a, b) => {
    const dataA = String(a?.data_movimentacao || '');
    const dataB = String(b?.data_movimentacao || '');
    if (dataA !== dataB) return dataB.localeCompare(dataA);
    return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
  });
}

/**
 * Move um lote para um novo pasto, registrando o histórico e atualizando
 * lotes.pastagem_id numa única transação via RPC mover_lote_para_pasto.
 */
export async function moverLoteParaPasto({
  loteId,
  pastagemDestinoId,
  dataMovimentacao,
  quantidadeCabecas = null,
  motivo = null,
  observacoes = null,
} = {}) {
  const { data, error } = await supabase.rpc('mover_lote_para_pasto', {
    p_lote_id: toNumberOrNull(loteId),
    p_pastagem_destino_id: toTextOrNull(pastagemDestinoId),
    p_data_movimentacao: toTextOrNull(dataMovimentacao),
    p_quantidade_cabecas: toNumberOrNull(quantidadeCabecas),
    p_motivo: toTextOrNull(motivo),
    p_observacoes: toTextOrNull(observacoes),
  });

  if (error) {
    return { success: false, data: null, error: getFriendlyErrorMessage(error) };
  }
  return { success: true, data, error: null };
}

/**
 * Lista o histórico de movimentações de pasto de um lote específico,
 * mais recente primeiro.
 */
export async function listarHistoricoPastos(loteId) {
  const { data, error } = await supabase
    .from('lote_pastagens_historico')
    .select(PASTAGEM_EMBED_SELECT)
    .eq('lote_id', toNumberOrNull(loteId));

  if (error) {
    return { success: false, data: [], error: getFriendlyErrorMessage(error) };
  }
  return { success: true, data: ordenarHistoricoDesc(Array.isArray(data) ? data : []), error: null };
}

/**
 * Lista todas as movimentações de pasto registradas para uma fazenda,
 * mais recente primeiro.
 */
export async function listarMovimentacoesPorFazenda(fazId) {
  const { data, error } = await supabase
    .from('lote_pastagens_historico')
    .select(PASTAGEM_EMBED_SELECT)
    .eq('faz_id', toNumberOrNull(fazId));

  if (error) {
    return { success: false, data: [], error: getFriendlyErrorMessage(error) };
  }
  return { success: true, data: ordenarHistoricoDesc(Array.isArray(data) ? data : []), error: null };
}

/**
 * Monta a frase amigável de um item de histórico, ex.:
 * "Em 20/06/2026, o lote Recria Machos 2026 foi movido do pasto Pasto 1 para o pasto Pasto 3."
 */
export function formatHistoricoMensagem(item, { loteNome } = {}) {
  const data = formatDate(item?.data_movimentacao);
  const nomeLote = toTextOrNull(loteNome) || toTextOrNull(item?.lote_nome) || 'o lote';
  const origemNome = toTextOrNull(item?.pastagem_origem?.nome);
  const destinoNome = toTextOrNull(item?.pastagem_destino?.nome) || 'um novo pasto';

  if (!origemNome) {
    return `Em ${data}, o lote ${nomeLote} foi vinculado ao pasto ${destinoNome}.`;
  }
  return `Em ${data}, o lote ${nomeLote} foi movido do pasto ${origemNome} para o pasto ${destinoNome}.`;
}
