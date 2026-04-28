import { calcularResultadoLote } from './calculos';
import { calcLote } from '../utils/calculations';

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(value, divisor) {
  if (!Number.isFinite(divisor) || divisor === 0) return 0;
  const result = value / divisor;
  return Number.isFinite(result) ? result : 0;
}

function buildInsights({ lote, totalAnimais, lucroTotal, gmdKgDia, custoPorArroba, margemPct }) {
  const insights = [];

  if (!lote || totalAnimais <= 0) {
    insights.push('Dados insuficientes para análise completa.');
    return insights;
  }

  if (lucroTotal > 0) {
    insights.push('Lote com resultado positivo.');
  } else if (lucroTotal < 0) {
    insights.push('Lote em prejuízo operacional.');
  } else {
    insights.push('Lote em ponto de equilíbrio.');
  }

  if (toNumber(lote.gmd_meta) > 0 && gmdKgDia < toNumber(lote.gmd_meta)) {
    insights.push('GMD abaixo da meta configurada.');
  }

  if (custoPorArroba > 0 && margemPct < 10) {
    insights.push('Custo por arroba elevado.');
  }

  return insights;
}

export function getResumoLote(db, loteId) {
  const produtivo = calcLote(db, loteId);
  const financeiro = calcularResultadoLote(db, loteId);

  const lote = produtivo?.lote || (Array.isArray(db?.lotes) ? db.lotes.find((item) => Number(item.id) === Number(loteId)) : null) || null;

  const totalAnimais = toNumber(produtivo?.totalAnimais);
  const pesoInicialMedio = toNumber(produtivo?.pesoInicialMedio);
  const pesoAtualMedio = toNumber(produtivo?.pesoAtualMedio);
  const gmdKgDia = toNumber(produtivo?.gmdMedio);
  const gmdGramasDia = gmdKgDia * 1000;
  const dias = toNumber(produtivo?.dias);
  const arrobasProduzidas = toNumber(produtivo?.arrobasProduzidas);
  const arrobasCarcaca = toNumber(produtivo?.arrobasCarcaca);

  const custoTotal = toNumber(financeiro?.custoTotal);
  const receitaTotal = toNumber(financeiro?.receitaTotal);
  const lucroTotal = toNumber(financeiro?.lucroTotal);
  const margemPct = toNumber(financeiro?.margemPct);

  const custoPorCabeca = safeDivide(custoTotal, totalAnimais);
  const custoPorArroba = safeDivide(custoTotal, arrobasProduzidas);
  const lucroPorCabeca = toNumber(financeiro?.lucroPorCabeca) || safeDivide(lucroTotal, totalAnimais);
  const lucroPorArroba = toNumber(financeiro?.lucroPorArroba) || safeDivide(lucroTotal, arrobasProduzidas);

  const classificacao = lucroTotal > 0 ? 'lucro' : lucroTotal < 0 ? 'prejuizo' : 'empate';

  const insights = buildInsights({
    lote,
    totalAnimais,
    lucroTotal,
    gmdKgDia,
    custoPorArroba,
    margemPct,
  });

  return {
    lote,

    totalAnimais,
    pesoInicialMedio,
    pesoAtualMedio,
    gmdMedio: gmdKgDia,
    gmdKgDia,
    gmdGramasDia,
    dias,
    arrobasProduzidas,
    arrobasCarcaca,

    custoTotal,
    receitaTotal,
    lucroTotal,
    margemPct,

    custoPorCabeca,
    custoPorArroba,
    lucroPorCabeca,
    lucroPorArroba,

    classificacao,
    insights,

    // Legacy compatibility aliases
    margem: lucroTotal,
    receita: receitaTotal,
    custo: custoTotal,
  };
}
