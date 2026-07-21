// ─────────────────────────────────────────────────────────────────────────────
// GMD (Ganho Médio Diário) — FONTE ÚNICA do HERDON.
//
// Antes desta Sprint 2 existiam CINCO implementações independentes de GMD
// (pesagensLote.js, LotesPage.jsx::calculateGmd30, calculations.js::calcGmd,
// relatorios.js e PesagensPage.jsx::resumoEvolucaoLote). Para um mesmo lote de
// recria com ganho forte seguido de estagnação elas devolviam 1,404 e 0,167
// kg/dia — 8,4x de diferença, o que inverte a decisão de vender ou segurar.
//
// SEMÂNTICA OFICIAL (decisão de produto): "GMD de vida" — da ENTRADA do lote
// até a ÚLTIMA pesagem.
//
//   GMD = (peso final − peso base) ÷ dias
//
//   base : data de entrada do lote + peso inicial (`lote.entrada` / `lote.p_ini`).
//          Sem isso, cai para a PRIMEIRA pesagem do lote.
//   fim  : última pesagem de LOTE.
//
// Outras janelas (ex.: "GMD 30 dias") continuam sendo métricas legítimas, mas
// precisam de rótulo próprio e função própria — nunca reusar o nome "GMD".
//
// CASOS-LIMITE (todos devolvem `null` = "sem dado suficiente", nunca 0):
//   - nenhuma pesagem                       → null
//   - só uma pesagem e sem data de entrada  → null (não há intervalo)
//   - só uma pesagem COM data de entrada    → calcula (entrada → pesagem)
//   - intervalo de 0 dias (mesma data)      → null
//   - peso menor que o anterior             → GMD NEGATIVO (perda real: seca,
//                                             doença). Nunca truncar em 0.
//   - pesagem anterior à entrada do lote    → ignorada (dado inconsistente)
//
// `null` nunca deve virar 0 na interface: 0 kg/dia significa "o lote não
// ganhou peso", enquanto null significa "ainda não dá para calcular". Confundir
// os dois foi exatamente o que fazia a tela de Lotes exibir 10 kg/dia quando
// havia duas pesagens no mesmo dia (dividia por um dia inventado).
// ─────────────────────────────────────────────────────────────────────────────
import { toDateKey, daysBetween } from './calcHelpers.js';
import { resolveTipoPesagem } from './pesagensLote.js';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pesagens de LOTE do lote informado, normalizadas e ordenadas por data. */
function pesagensOrdenadasDoLote(pesagens, loteId) {
  return (Array.isArray(pesagens) ? pesagens : [])
    .filter((p) => resolveTipoPesagem(p) === 'lote')
    .filter((p) => Number(p?.lote_id) === Number(loteId))
    .map((p) => ({ data: toDateKey(p?.data), peso: num(p?.peso_medio) }))
    .filter((p) => p.data && p.peso !== null)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * GMD de vida do lote (kg/dia), com o detalhamento usado para auditoria.
 *
 * @param {object} lote      — precisa de `id`; usa `entrada` e `p_ini` quando houver.
 * @param {Array}  pesagens  — pesagens de qualquer lote; filtramos aqui.
 * @returns {{
 *   gmd: number|null, ganho: number|null, dias: number|null,
 *   base: {data: string, peso: number, origem: 'entrada_lote'|'primeira_pesagem'}|null,
 *   fim: {data: string, peso: number}|null,
 *   motivo: string|null
 * }}
 */
export function calcularGmdLote(lote, pesagens) {
  const vazio = { gmd: null, ganho: null, dias: null, base: null, fim: null, motivo: null };
  if (!lote) return { ...vazio, motivo: 'sem_lote' };

  const ordenadas = pesagensOrdenadasDoLote(pesagens, lote.id);
  if (!ordenadas.length) return { ...vazio, motivo: 'sem_pesagem' };

  const dataEntrada = toDateKey(lote?.entrada);
  const pesoEntrada = num(lote?.p_ini);
  const temEntrada = Boolean(dataEntrada) && pesoEntrada !== null;

  // Pesagem anterior à entrada do lote é dado inconsistente (pertence a outro
  // período/lote): descartada em vez de virar base e distorcer o ganho.
  const validas = temEntrada ? ordenadas.filter((p) => p.data >= dataEntrada) : ordenadas;
  if (!validas.length) return { ...vazio, motivo: 'pesagens_anteriores_a_entrada' };

  const fim = validas[validas.length - 1];

  const base = temEntrada
    ? { data: dataEntrada, peso: pesoEntrada, origem: 'entrada_lote' }
    : { data: validas[0].data, peso: validas[0].peso, origem: 'primeira_pesagem' };

  // Sem data de entrada, a primeira pesagem É a base — então uma pesagem só
  // não forma intervalo.
  if (base.origem === 'primeira_pesagem' && validas.length < 2) {
    return { ...vazio, motivo: 'pesagem_unica_sem_entrada' };
  }

  const dias = daysBetween(base.data, fim.data);
  if (!Number.isFinite(dias) || dias <= 0) {
    return { ...vazio, base, fim: { data: fim.data, peso: fim.peso }, motivo: 'intervalo_zero' };
  }

  const ganho = fim.peso - base.peso;
  const gmd = ganho / dias;
  if (!Number.isFinite(gmd)) return { ...vazio, motivo: 'resultado_nao_finito' };

  return { gmd, ganho, dias, base, fim: { data: fim.data, peso: fim.peso }, motivo: null };
}

/** Só o número (kg/dia) ou null — atalho para telas que não precisam do detalhe. */
export function gmdDoLote(lote, pesagens) {
  return calcularGmdLote(lote, pesagens).gmd;
}

/**
 * GMD médio do rebanho: média simples dos GMD de vida dos lotes que têm dado
 * suficiente. Lotes sem GMD calculável são EXCLUÍDOS da média (não entram como
 * 0, o que puxaria o indicador para baixo artificialmente).
 * @returns {number|null} null quando nenhum lote tem GMD calculável.
 */
export function gmdMedioDosLotes(lotes, pesagens) {
  const valores = (Array.isArray(lotes) ? lotes : [])
    .map((lote) => gmdDoLote(lote, pesagens))
    .filter((v) => v !== null && Number.isFinite(v));

  if (!valores.length) return null;
  return valores.reduce((total, v) => total + v, 0) / valores.length;
}
