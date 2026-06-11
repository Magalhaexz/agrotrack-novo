import {
  calcularCapacidadeTotalUa,
  calcularDiagnosticoCapacidade,
  calcularUaPorAnimal,
} from './unidadeAnimal.js';
import { computeEvolucaoRebanho } from './evolucaoRebanho.js';
import { safeDivide, toDateKey, toNonNegativeNumber, toNumber } from './calcHelpers.js';

function isDateInPeriod(value, start, end) {
  const date = toDateKey(value);
  const safeStart = toDateKey(start);
  const safeEnd = toDateKey(end);
  if (!date || !safeStart || !safeEnd) return false;
  return date >= safeStart && date <= safeEnd;
}

function isAnimalAtivo(animal) {
  const status = String(animal?.status || 'ativo').toLowerCase();
  return !['vendido', 'morte', 'descarte', 'transferencia', 'perda', 'inativo'].includes(status);
}

function normalizeTipo(tipo) {
  const value = String(tipo || '').trim().toLowerCase();
  if (value === 'transferencia') return 'transferencia_saida';
  return value;
}

function getLatestLotePesoMap(db) {
  const map = new Map();
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  pesagens
    .map((item) => ({ ...item, data: toDateKey(item?.data) }))
    .filter((item) => (item?.tipo || 'lote') !== 'animal' && item.data)
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((item) => {
      const loteId = Number(item?.lote_id);
      if (!loteId || map.has(loteId)) return;
      map.set(loteId, toNumber(item?.peso_medio));
    });
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  lotes.forEach((lote) => {
    const loteId = Number(lote?.id);
    if (!loteId || map.has(loteId)) return;
    map.set(loteId, toNumber(lote?.p_at || lote?.peso_medio_atual));
  });
  return map;
}

function getLatestAnimalPesoMap(db) {
  const map = new Map();
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  pesagens
    .map((item) => ({ ...item, data: toDateKey(item?.data) }))
    .filter((item) => String(item?.tipo || '').toLowerCase() === 'animal' && item.data)
    .sort((a, b) => b.data.localeCompare(a.data))
    .forEach((item) => {
      const animalId = String(item?.animal_id || '').trim();
      if (!animalId || map.has(animalId)) return;
      map.set(animalId, toNumber(item?.peso_medio));
    });
  return map;
}

function calculateUaLayer(db) {
  const animais = (Array.isArray(db?.animais) ? db.animais : []).filter(isAnimalAtivo);
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lotesMap = new Map(lotes.map((l) => [Number(l.id), l]));
  const lotePesoMap = getLatestLotePesoMap(db);
  const animalPesoMap = getLatestAnimalPesoMap(db);

  const uaPorLoteMap = new Map();
  let uaTotalFazenda = 0;
  let semDadosPesoCount = 0;

  animais.forEach((animal) => {
    const loteId = Number(animal?.lote_id);
    const qtd = toNonNegativeNumber(animal?.qtd || 1);
    const animalId = String(animal?.id || '').trim();

    const pesoPesagemAnimal = animalId ? animalPesoMap.get(animalId) : null;
    const pesoAtualAnimal = toNumber(animal?.p_at || animal?.peso_vivo_kg);
    const pesoLote = lotePesoMap.get(loteId) || toNumber(lotesMap.get(loteId)?.p_at);
    const pesoEscolhido = pesoPesagemAnimal || pesoAtualAnimal || pesoLote || null;

    if (!pesoEscolhido) {
      semDadosPesoCount += qtd;
      return;
    }

    const uaAnimal = calcularUaPorAnimal(pesoEscolhido);
    const uaTotalAnimalRegistro = uaAnimal * qtd;
    uaTotalFazenda += uaTotalAnimalRegistro;
    uaPorLoteMap.set(loteId, (uaPorLoteMap.get(loteId) || 0) + uaTotalAnimalRegistro);
  });

  const uaPorLote = lotes.map((lote) => ({
    lote_id: Number(lote.id),
    lote_nome: lote.nome || `Lote ${lote.id}`,
    ua_total_lote: toNumber(uaPorLoteMap.get(Number(lote.id))),
  }));

  return {
    uaTotalFazenda,
    uaPorLote,
    semDadosPesoCount,
  };
}

function calculatePastagemLotacao(db, uaTotalFazenda) {
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];
  const areaTotalPastagem = pastagens.reduce((sum, p) => sum + toNonNegativeNumber(p?.area_ha), 0);
  const capacidadeTotalUa = calcularCapacidadeTotalUa(pastagens);
  const taxaLotacaoUaHa = safeDivide(uaTotalFazenda, areaTotalPastagem);
  const saldoUa = capacidadeTotalUa - uaTotalFazenda;
  const statusLotacao = saldoUa >= 0 ? 'dentro_da_capacidade' : 'superlotado';
  const capacidadeMediaUaHa = safeDivide(capacidadeTotalUa, areaTotalPastagem);
  const pastoAArrendarHa = statusLotacao === 'superlotado' && capacidadeMediaUaHa
    ? Math.abs(saldoUa) / capacidadeMediaUaHa
    : 0;

  return {
    areaTotalPastagem,
    capacidadeTotalUa,
    taxaLotacaoUaHa,
    saldoUa,
    statusLotacao,
    capacidadeMediaUaHa,
    pastoAArrendarHa,
  };
}

function calculateTecnicos(db, evolucao, periodStart, periodEnd, areaPastagemHa) {
  const movimentos = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const estoqueInicial = toNumber(evolucao?.resumo?.estoque_inicial);
  const estoqueFinal = toNumber(evolucao?.resumo?.estoque_final);
  const compras = toNumber(evolucao?.resumo?.compras);
  const vendas = toNumber(evolucao?.resumo?.vendas);
  const variacao = toNumber(evolucao?.resumo?.variacao_inventario);

  const abatesQtd = movimentos
    .filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd))
    .filter((m) => normalizeTipo(m?.tipo) === 'abate')
    .reduce((sum, m) => sum + toNumber(m?.qtd), 0);

  const desfrutePct = safeDivide((vendas - compras + variacao) * 100, estoqueInicial);
  const taxaAbatePct = safeDivide(abatesQtd * 100, estoqueInicial);
  const taxaCrescimentoPct = safeDivide((estoqueFinal - estoqueInicial) * 100, estoqueInicial);

  const kgVivoProduzido = movimentos
    .filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd))
    .filter((m) => ['venda', 'abate'].includes(normalizeTipo(m?.tipo)))
    .reduce((sum, m) => sum + (toNumber(m?.qtd) * toNumber(m?.peso_medio)), 0);

  const kgVivoHa = safeDivide(kgVivoProduzido, areaPastagemHa);

  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [Number(l.id), l]));
  const totalPesoCarcacaKg = movimentos
    .filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd))
    .filter((m) => ['venda', 'abate'].includes(normalizeTipo(m?.tipo)))
    .reduce((sum, m) => {
      const qtd = toNumber(m?.qtd);
      const pesoMedio = toNumber(m?.peso_medio);
      const lote = lotesMap.get(Number(m?.lote_id));
      const rendimento = toNumber(lote?.rendimento_carcaca || 52) / 100;
      const pesoCarcacaMov = qtd * pesoMedio * rendimento;
      return sum + pesoCarcacaMov;
    }, 0);
  const arrobasVendidas = totalPesoCarcacaKg > 0 ? totalPesoCarcacaKg / 15 : null;

  return {
    desfrutePct,
    taxaAbatePct,
    taxaCrescimentoPct,
    kgVivoProduzido,
    kgVivoHa,
    totalPesoCarcacaKg,
    arrobasVendidas,
    abatesQtd,
  };
}

function calculateEconomicos(db, periodStart, periodEnd, areaPastagemHa, estoqueInicial, estoqueFinal) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const inPeriod = movimentosFinanceiros.filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd));

  const receitaTotal = inPeriod
    .filter((m) => String(m?.tipo || '').toLowerCase() === 'receita')
    .reduce((sum, m) => sum + toNumber(m?.valor), 0);

  const custosTotais = inPeriod
    .filter((m) => String(m?.tipo || '').toLowerCase() === 'despesa')
    .reduce((sum, m) => sum + toNumber(m?.valor), 0);

  const margemBruta = receitaTotal - custosTotais;
  const estoqueMedio = (toNumber(estoqueInicial) + toNumber(estoqueFinal)) / 2;
  const margemPorHa = safeDivide(margemBruta, areaPastagemHa);
  const margemPorCabeca = safeDivide(margemBruta, estoqueMedio);

  return {
    receitaTotal,
    custosTotais,
    margemBruta,
    margemPorHa,
    margemPorCabeca,
    estoqueMedio,
  };
}

function calculateLoteResumo(db, periodStart, periodEnd, uaPorLote) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const movFinanceiro = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const uaMap = new Map((uaPorLote || []).map((item) => [Number(item.lote_id), toNumber(item.ua_total_lote)]));

  return lotes.map((lote) => {
    const loteId = Number(lote.id);
    const receita = movFinanceiro
      .filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd))
      .filter((m) => Number(m?.lote_id) === loteId && String(m?.tipo || '').toLowerCase() === 'receita')
      .reduce((sum, m) => sum + toNumber(m?.valor), 0);
    const custos = movFinanceiro
      .filter((m) => isDateInPeriod(m?.data, periodStart, periodEnd))
      .filter((m) => Number(m?.lote_id) === loteId && String(m?.tipo || '').toLowerCase() === 'despesa')
      .reduce((sum, m) => sum + toNumber(m?.valor), 0);
    const margem = receita - custos;
    return {
      lote_id: loteId,
      lote_nome: lote.nome || `Lote ${lote.id}`,
      ua_total_lote: uaMap.get(loteId) || 0,
      receita_total: receita,
      custos_totais: custos,
      margem_bruta: margem,
    };
  });
}

export function resolveIndicadoresPeriod({ tipoPeriodo, mesRef, anoRef, customInicio, customFim }) {
  if (tipoPeriodo === 'ano') {
    const year = Number(anoRef) || Number(new Date().toISOString().slice(0, 4));
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (tipoPeriodo === 'custom') {
    const a = toDateKey(customInicio);
    const b = toDateKey(customFim);
    if (!a || !b) {
      const today = new Date().toISOString().slice(0, 10);
      return { start: today, end: today };
    }
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }
  const month = String(mesRef || new Date().toISOString().slice(0, 7));
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr) || Number(new Date().toISOString().slice(0, 4));
  const monthIndex = Math.max(1, Number(monthStr || 1));
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return {
    start: toDateKey(start.toISOString()) || `${year}-01-01`,
    end: toDateKey(end.toISOString()) || `${year}-12-31`,
  };
}

export function computeIndicadoresEstrategicos(db, periodStart, periodEnd) {
  const uaLayer = calculateUaLayer(db);
  const pastagem = calculatePastagemLotacao(db, uaLayer.uaTotalFazenda);
  const evolucao = computeEvolucaoRebanho(db, periodStart, periodEnd);
  const tecnicos = calculateTecnicos(db, evolucao, periodStart, periodEnd, pastagem.areaTotalPastagem);
  const economicos = calculateEconomicos(
    db,
    periodStart,
    periodEnd,
    pastagem.areaTotalPastagem,
    evolucao?.resumo?.estoque_inicial,
    evolucao?.resumo?.estoque_final
  );
  const loteResumo = calculateLoteResumo(db, periodStart, periodEnd, uaLayer.uaPorLote);
  const capacidade = calcularDiagnosticoCapacidade({
    animais: Array.isArray(db?.animais) ? db.animais.filter(isAnimalAtivo) : [],
    pastagens: Array.isArray(db?.pastagens) ? db.pastagens : [],
  });

  return {
    periodo: { inicio: periodStart, fim: periodEnd },
    pastagem,
    unidadeAnimal: uaLayer,
    evolucao,
    tecnicos,
    economicos,
    capacidade,
    loteResumo,
  };
}
