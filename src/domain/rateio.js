import { safeDivide, toNonNegativeNumber, toNumber } from './calcHelpers.js';

/**
 * Rateia custoTotal entre lotes proporcionalmente ao número de cabeças.
 * @param {number} custoTotal
 * @param {{ lote_id: *, qtdCabecas: number }[]} lotes
 * @returns {{ lote_id: *, custoRateado: number }[]}
 */
export function ratearPorCabecas(custoTotal, lotes) {
  const custo = toNonNegativeNumber(custoTotal);
  const totalCabecas = lotes.reduce((sum, l) => sum + toNonNegativeNumber(l.qtdCabecas), 0);
  if (!totalCabecas) return lotes.map((l) => ({ lote_id: l.lote_id, custoRateado: 0 }));
  return lotes.map((l) => ({
    lote_id: l.lote_id,
    custoRateado: safeDivide(toNonNegativeNumber(l.qtdCabecas) * custo, totalCabecas),
  }));
}

/**
 * Rateia custoTotal entre lotes proporcionalmente ao peso total do lote (cabeças × peso médio).
 * @param {number} custoTotal
 * @param {{ lote_id: *, pesoTotal: number }[]} lotes
 * @returns {{ lote_id: *, custoRateado: number }[]}
 */
export function ratearPorPeso(custoTotal, lotes) {
  const custo = toNonNegativeNumber(custoTotal);
  const totalPeso = lotes.reduce((sum, l) => sum + toNonNegativeNumber(l.pesoTotal), 0);
  if (!totalPeso) return lotes.map((l) => ({ lote_id: l.lote_id, custoRateado: 0 }));
  return lotes.map((l) => ({
    lote_id: l.lote_id,
    custoRateado: safeDivide(toNonNegativeNumber(l.pesoTotal) * custo, totalPeso),
  }));
}

/**
 * Rateia custoTotal em partes iguais entre quantidadeLotes lotes.
 * @param {number} custoTotal
 * @param {number} quantidadeLotes
 * @returns {{ lote_idx: number, custoRateado: number }[]}
 */
export function ratearIgualitario(custoTotal, quantidadeLotes) {
  const custo = toNonNegativeNumber(custoTotal);
  const n = Math.max(Math.round(toNumber(quantidadeLotes)), 0);
  if (!n) return [];
  const valorPorLote = safeDivide(custo, n);
  return Array.from({ length: n }, (_, i) => ({ lote_idx: i, custoRateado: valorPorLote }));
}
