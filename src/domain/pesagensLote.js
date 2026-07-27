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

/**
 * Peso médio oficial de uma pesagem individual por cabeça (Sprint Funcional
 * 15). Recebe os pesos já digitados (um por cabeça) e devolve soma,
 * quantidade efetivamente pesada e a média — fonte única, reaproveitada pela
 * UI e pela persistência para nunca depender de um valor de média digitado
 * manualmente.
 *
 * Pesos inválidos (vazio, zero, negativo, não numérico) são ignorados aqui
 * também, para que o cálculo nunca dependa de o chamador já ter filtrado.
 *
 * @param {Array<number|string>} pesos
 * @returns {{ soma: number, quantidade: number, media: number|null }}
 */
export function calcularPesoMedioIndividual(pesos) {
  const validos = (Array.isArray(pesos) ? pesos : [])
    .map((valor) => Number(String(valor ?? '').replace(',', '.')))
    .filter((valor) => Number.isFinite(valor) && valor > 0);

  const quantidade = validos.length;
  if (quantidade === 0) return { soma: 0, quantidade: 0, media: null };

  const soma = validos.reduce((total, valor) => total + valor, 0);
  // Arredondamento consistente com formatarNumero (2 casas) — ex.: 1100/3 kg
  // vira 366.67, não 366.666666...
  const media = Math.round((soma / quantidade) * 100) / 100;
  return { soma, quantidade, media };
}
