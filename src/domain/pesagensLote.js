// Recálculo do peso atual do lote a partir do histórico de pesagens
// (Sprint Paridade 1, bloco 3). Puro, sem I/O. Extraído de
// `PesagensPage.jsx::recalculateLoteFromPesagens` — antes só existia
// inline naquela página; agora é a única fórmula, reaproveitada também
// pelo bot do Telegram (`cadastroPesagem.js`) para editar/excluir pesagem
// sem duplicar a regra.
import { toDateKey, daysBetween } from './calcHelpers.js';

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

/** GMD médio (kg/dia) entre a primeira e a última pesagem de LOTE de cada lote, agregado. */
export function calculateAverageGmdByLote(pesagens = []) {
  const pesagensPorLote = new Map();
  (pesagens || []).forEach((pesagem) => {
    if (resolveTipoPesagem(pesagem) !== 'lote') return;
    const loteId = Number(pesagem?.lote_id);
    if (!Number.isFinite(loteId) || loteId <= 0) return;
    if (!pesagensPorLote.has(loteId)) pesagensPorLote.set(loteId, []);
    pesagensPorLote.get(loteId).push(pesagem);
  });

  const gmdValues = [];
  pesagensPorLote.forEach((lotePesagens) => {
    const sorted = [...lotePesagens]
      .map((item) => ({ ...item, data: toDateKey(item?.data) }))
      .filter((item) => item?.data && Number.isFinite(Number(item?.peso_medio)))
      .sort((a, b) => a.data.localeCompare(b.data));
    if (sorted.length < 2) return;
    const primeira = sorted[0];
    const ultima = sorted[sorted.length - 1];
    const dias = daysBetween(primeira.data, ultima.data);
    if (!Number.isFinite(dias) || dias <= 0) return;
    const gmd = (Number(ultima.peso_medio) - Number(primeira.peso_medio)) / dias;
    if (Number.isFinite(gmd)) gmdValues.push(gmd);
  });

  if (!gmdValues.length) return null;
  const media = gmdValues.reduce((total, value) => total + value, 0) / gmdValues.length;
  return Number.isFinite(media) ? media : null;
}
