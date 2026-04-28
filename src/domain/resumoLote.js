import { calcularResultadoLote } from './calculos';
import { calcLote } from '../utils/calculations';

function toNumber(value) {
  return Number(value || 0);
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
  const lucroTotal = receitaTotal - custoTotal;
  const margemPct = receitaTotal > 0 ? (lucroTotal / receitaTotal) * 100 : 0;

  const custoPorCabeca = totalAnimais > 0 ? custoTotal / totalAnimais : 0;
  const custoPorArroba = arrobasProduzidas > 0 ? custoTotal / arrobasProduzidas : 0;
  const lucroPorCabeca = totalAnimais > 0 ? lucroTotal / totalAnimais : 0;
  const lucroPorArroba = arrobasProduzidas > 0 ? lucroTotal / arrobasProduzidas : 0;

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

