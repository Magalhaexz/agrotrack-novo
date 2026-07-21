// Recálculo do peso atual do lote a partir do histórico de pesagens
// (Sprint Paridade 1, bloco 3). Puro, sem I/O. Extraído de
// `PesagensPage.jsx::recalculateLoteFromPesagens` — antes só existia
// inline naquela página; agora é a única fórmula, reaproveitada também
// pelo bot do Telegram (`cadastroPesagem.js`) para editar/excluir pesagem
// sem duplicar a regra.
import { toDateKey } from './calcHelpers.js';

function toFiniteNumber(value, fallback = 0) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

/** Pesagem individual de animal, ou pesagem agregada do lote (default)? */
export function resolveTipoPesagem(item) {
  if (item?.tipo === 'animal' || item?.origem === 'animal') return 'animal';
  return 'lote';
}

/** Mais recente pesagem de LOTE (não individual) de uma lista, por data (empate: maior id). */
export function resolverUltimaPesagemLote(pesagens) {
  return [...(pesagens || [])]
    .map((item) => ({ ...item, data: toDateKey(item?.data) }))
    .filter((item) => item?.data)
    .sort((a, b) => {
      if (a.data !== b.data) return b.data.localeCompare(a.data);
      return toFiniteNumber(b.id) - toFiniteNumber(a.id);
    })[0] || null;
}

/**
 * Peso médio atual do lote (fallback: média ponderada de `db.animais` do
 * lote) quando não há nenhuma pesagem de lote registrada.
 */
function pesoFallbackDosAnimais(animais, loteId) {
  const grupos = (Array.isArray(animais) ? animais : []).filter((item) => Number(item?.lote_id) === Number(loteId));
  const qtd = grupos.reduce((sum, item) => sum + toFiniteNumber(item?.qtd), 0);
  if (qtd <= 0) return 0;
  const pesoTotal = grupos.reduce((sum, item) => sum + toFiniteNumber(item?.p_at) * toFiniteNumber(item?.qtd), 0);
  return pesoTotal / qtd;
}

/**
 * Recalcula `p_at`/`ultima_pesagem` de um lote a partir da lista de pesagens
 * que RESTAM após um cadastro/edição/exclusão (o chamador já filtrou a
 * pesagem excluída/editada da lista antes de passar aqui).
 * @param {object} db — precisa de `animais` (fallback quando não há pesagem de lote).
 * @param {number} loteId
 * @param {Array} pesagensRestantes — todas as pesagens do lote após a operação.
 * @returns {{ pesoAtual: number, ultimaPesagem: string|null }}
 */
export function recalcularPesoAtualLote(db, loteId, pesagensRestantes) {
  const pesagensDoLote = (Array.isArray(pesagensRestantes) ? pesagensRestantes : []).filter((item) => (
    resolveTipoPesagem(item) === 'lote' && Number(item?.lote_id) === Number(loteId)
  ));
  const ultima = resolverUltimaPesagemLote(pesagensDoLote);
  const fallback = pesoFallbackDosAnimais(db?.animais, loteId);
  const pesoAtual = ultima ? toFiniteNumber(ultima.peso_medio, fallback) : fallback;
  return { pesoAtual, ultimaPesagem: ultima?.data || null };
}

// GMD saiu daqui: a fórmula agora vive em domain/gmd.js (fonte única).
// `calculateAverageGmdByLote` usava primeira→última pesagem, enquanto outras
// telas usavam janela de 30 dias ou a tabela `animais` — divergência de até
// 8x no mesmo lote. Ver gmd.js para a semântica oficial e os casos-limite.
