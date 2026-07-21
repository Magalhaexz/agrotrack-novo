import { calcularResultadoLote } from './calculos.js';
import { calcLote } from '../utils/calculations.js';
import { safeDivide, toNumber } from './calcHelpers.js';

function buildInsights({ lote, totalAnimais, lucroTotal, gmdKgDia, gmdDisponivel, custoPorArroba, margemPct }) {
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

  // P1-05B: só compara com a meta quando o GMD realmente está disponível —
  // sem isso, um lote sem pesagem suficiente (gmdKgDia = 0 só de borda)
  // aparecia aqui como "abaixo da meta" mesmo sem nenhum dado real.
  if (gmdDisponivel && toNumber(lote.gmd_meta) > 0 && gmdKgDia < toNumber(lote.gmd_meta)) {
    insights.push('GMD abaixo da meta configurada.');
  }

  if (custoPorArroba > 0 && margemPct < 10) {
    insights.push('Custo/@ carcaça elevado.');
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
  // P1-05B: disponibilidade vem da fonte canônica (calcLote → domain/gmd.js),
  // nunca do valor numérico convertido — `gmdKgDia` é 0 tanto para "GMD real
  // igual a zero" quanto para "sem pesagem suficiente" (conversão de borda em
  // calcLote), e só `produtivo.gmdDisponivel` distingue os dois casos.
  const gmdDisponivel = Boolean(produtivo?.gmdDisponivel);
  const dias = toNumber(produtivo?.dias);
  const arrobasProduzidas = toNumber(produtivo?.arrobasProduzidas);
  const arrobasCarcaca = toNumber(produtivo?.arrobasCarcaca);

  const custoTotal = toNumber(financeiro?.custoTotal);
  const receitaTotal = toNumber(financeiro?.receitaTotal);
  const lucroTotal = toNumber(financeiro?.lucroTotal);
  const margemPct = toNumber(financeiro?.margemPct);

  // Sprint 4: custo/cabeça, custo/@, lucro/cabeça e lucro/@ passam a vir todos
  // de `calcularResultadoLote`, que usa a base única (remanescente + vendido —
  // ver domain/vendaLote.js). Antes este resumo dividia por `totalAnimais`
  // (rebanho remanescente, de calcLote) enquanto o financeiro dividia pela sua
  // própria contagem: dois "lucro por cabeça" diferentes para o mesmo lote, e
  // ambos zerando num lote 100% vendido.
  const cabecasBase = toNumber(financeiro?.qtdCabecas);
  const custoPorCabeca = safeDivide(custoTotal, cabecasBase);
  const custoPorArroba = toNumber(financeiro?.custoPorArroba);
  const lucroPorCabeca = toNumber(financeiro?.lucroPorCabeca);
  const lucroPorArroba = toNumber(financeiro?.lucroPorArroba);

  const classificacao = lucroTotal > 0 ? 'lucro' : lucroTotal < 0 ? 'prejuizo' : 'empate';

  const insights = buildInsights({
    lote,
    totalAnimais,
    lucroTotal,
    gmdKgDia,
    gmdDisponivel,
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
    gmdDisponivel,
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
