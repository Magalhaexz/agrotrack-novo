import { toDateKey, toNumber } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';
import { calcularFluxoCaixa } from './fluxoCaixa.js';
import { construirResumoPastos, listarContasFinanceiras, construirHojeNaFazenda } from './hojeNaFazenda.js';
import { buildAlerts } from '../utils/alerts.js';

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function buscarFazendaNome(db, fazendaId) {
  if (fazendaId == null) return null;
  const fazenda = arr(db?.fazendas).find((item) => toNumber(item.id) === toNumber(fazendaId));
  return fazenda?.nome || null;
}

export function buscarPastagemNome(db, pastagemId) {
  if (pastagemId == null) return null;
  const pastagem = arr(db?.pastagens).find((item) => toNumber(item.id) === toNumber(pastagemId));
  return pastagem?.nome || null;
}

function situacaoLote(classificacao) {
  if (classificacao === 'lucro') return 'Em lucro';
  if (classificacao === 'prejuizo') return 'Em prejuízo';
  return 'Em equilíbrio';
}

/**
 * Monta o relatório completo de um lote, combinando o resumo já calculado em
 * getResumoLote() com dados de identificação (fazenda, pasto, sistema) e as
 * últimas pesagens registradas. Não recalcula nada que já exista em resumoLote.js.
 */
export function buildRelatorioLote(db, loteId) {
  const resumo = getResumoLote(db, loteId);
  const lote = resumo.lote;

  if (!lote) {
    return { encontrado: false, lote: null };
  }

  const pesagensLote = arr(db?.pesagens)
    .filter((p) => toNumber(p.lote_id) === toNumber(loteId))
    .slice()
    .sort((a, b) => (toDateKey(b.data) || '').localeCompare(toDateKey(a.data) || ''));

  return {
    encontrado: true,
    ...resumo,
    fazendaNome: buscarFazendaNome(db, lote.fazenda_id ?? lote.faz_id),
    pastagemNome: buscarPastagemNome(db, lote.pastagem_id),
    sistema: lote.sistema || null,
    categoria: lote.categoria_animal || null,
    gmdMeta: toNumber(lote.gmd_meta) || null,
    situacao: situacaoLote(resumo.classificacao),
    ultimasPesagens: pesagensLote.slice(0, 5),
  };
}

/**
 * Lista pesagens filtradas por lote/fazenda/período, com variação de peso e
 * GMD entre pesagens consecutivas do mesmo lote (peso_medio é o único dado
 * disponível por pesagem — não há contagem de cabeças por registro).
 */
export function buildRelatorioPesagens(db, { loteId, fazendaId, dataInicio, dataFim } = {}) {
  const lotes = arr(db?.lotes);
  const lotesMap = new Map(lotes.map((l) => [toNumber(l.id), l]));
  const lotesDaFazenda = fazendaId
    ? new Set(lotes.filter((l) => toNumber(l.fazenda_id ?? l.faz_id) === toNumber(fazendaId)).map((l) => toNumber(l.id)))
    : null;

  let pesagens = arr(db?.pesagens);

  if (loteId) {
    pesagens = pesagens.filter((p) => toNumber(p.lote_id) === toNumber(loteId));
  } else if (lotesDaFazenda) {
    pesagens = pesagens.filter((p) => lotesDaFazenda.has(toNumber(p.lote_id)));
  }

  const inicioKey = toDateKey(dataInicio);
  const fimKey = toDateKey(dataFim);
  if (inicioKey) pesagens = pesagens.filter((p) => (toDateKey(p.data) || '') >= inicioKey);
  if (fimKey) pesagens = pesagens.filter((p) => (toDateKey(p.data) || '') <= fimKey);

  pesagens = pesagens.slice().sort((a, b) => (toDateKey(a.data) || '').localeCompare(toDateKey(b.data) || ''));

  const ultimaPesoPorLote = new Map();
  const ultimaDataPorLote = new Map();

  const linhas = pesagens.map((p) => {
    const id = toNumber(p.lote_id);
    const pesoMedio = toNumber(p.peso_medio);
    const pesoAnterior = ultimaPesoPorLote.has(id) ? ultimaPesoPorLote.get(id) : null;
    const dataAnterior = ultimaDataPorLote.get(id) || null;

    let variacao = null;
    let gmdEntrePesagens = null;
    if (pesoAnterior != null && dataAnterior) {
      const dias = Math.max(
        Math.round((new Date(`${toDateKey(p.data)}T00:00:00Z`).getTime() - new Date(`${dataAnterior}T00:00:00Z`).getTime()) / 86400000),
        0
      );
      variacao = pesoMedio - pesoAnterior;
      gmdEntrePesagens = dias > 0 ? variacao / dias : null;
    }

    ultimaPesoPorLote.set(id, pesoMedio);
    ultimaDataPorLote.set(id, toDateKey(p.data));

    return {
      id: p.id,
      data: p.data,
      loteId: id,
      loteNome: lotesMap.get(id)?.nome || 'Lote não identificado',
      pesoMedio,
      qtdCabecasAtual: toNumber(lotesMap.get(id)?.qtd) || null,
      variacao,
      gmdEntrePesagens,
      observacao: p.observacao || null,
    };
  });

  return linhas.slice().reverse();
}

/**
 * Resumo financeiro simples por fazenda/lote/período, reaproveitando
 * calcularFluxoCaixa() e listarContasFinanceiras() já existentes.
 */
export function buildRelatorioFinanceiro(db, { fazendaId, loteId, dataInicio, dataFim } = {}) {
  const lotes = arr(db?.lotes);
  const lotesDaFazenda = fazendaId
    ? new Set(lotes.filter((l) => toNumber(l.fazenda_id ?? l.faz_id) === toNumber(fazendaId)).map((l) => toNumber(l.id)))
    : null;

  let movimentacoes = arr(db?.movimentacoes_financeiras);

  if (loteId) {
    movimentacoes = movimentacoes.filter((m) => toNumber(m.lote_id) === toNumber(loteId));
  } else if (lotesDaFazenda) {
    movimentacoes = movimentacoes.filter((m) => lotesDaFazenda.has(toNumber(m.lote_id)));
  }

  const inicioKey = toDateKey(dataInicio);
  const fimKey = toDateKey(dataFim);
  if (inicioKey) movimentacoes = movimentacoes.filter((m) => (toDateKey(m.data) || '') >= inicioKey);
  if (fimKey) movimentacoes = movimentacoes.filter((m) => (toDateKey(m.data) || '') <= fimKey);

  const fluxo = calcularFluxoCaixa(movimentacoes);

  const custosPorCategoria = new Map();
  movimentacoes
    .filter((m) => m?.tipo === 'despesa')
    .forEach((m) => {
      const categoria = m.categoria || 'Sem categoria';
      custosPorCategoria.set(categoria, toNumber(custosPorCategoria.get(categoria)) + toNumber(m.valor));
    });

  const maioresCategorias = Array.from(custosPorCategoria.entries())
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const { vencidas, proximas } = listarContasFinanceiras({ ...db, movimentacoes_financeiras: movimentacoes });

  return {
    entrou: fluxo.totalRecebido,
    saiu: fluxo.totalPago,
    saldo: fluxo.saldoCaixa,
    contasAReceber: fluxo.contasAReceber,
    contasAPagar: fluxo.contasAPagar,
    maioresCategorias,
    contasVencidas: vencidas,
    contasProximas: proximas,
    totalLancamentos: movimentacoes.length,
  };
}

/**
 * Relatório de ocupação de pastos, opcionalmente filtrado por fazenda.
 * Reaproveita construirResumoPastos() (estimativa simples por cabeças, sem cálculo de UA real).
 */
export function buildRelatorioPastagens(db, { fazendaId } = {}) {
  const pastagens = fazendaId
    ? arr(db?.pastagens).filter((p) => toNumber(p.fazenda_id) === toNumber(fazendaId))
    : arr(db?.pastagens);
  const lotes = fazendaId
    ? arr(db?.lotes).filter((l) => toNumber(l.fazenda_id ?? l.faz_id) === toNumber(fazendaId))
    : arr(db?.lotes);

  const dbFiltrado = { ...db, pastagens, lotes };
  const resumo = construirResumoPastos(dbFiltrado);
  const lotesAtivos = lotes.filter((l) => l.status === 'ativo');

  const ocupacaoPorPasto = pastagens.map((pasto) => {
    const lotesNoPasto = lotesAtivos.filter((l) => String(l.pastagem_id) === String(pasto.id));
    const cabecas = lotesNoPasto.reduce((soma, l) => soma + toNumber(l.qtd), 0);
    const capacidadeUa = toNumber(pasto.area_ha) * toNumber(pasto.capacidade_suporte_ua_ha) || null;
    return {
      id: pasto.id,
      nome: pasto.nome,
      areaHa: toNumber(pasto.area_ha) || null,
      cabecas,
      capacidadeUa,
      lotesNoPasto: lotesNoPasto.map((l) => l.nome),
      indicioDeExcesso: Boolean(capacidadeUa && cabecas > capacidadeUa),
    };
  });

  return {
    ...resumo,
    ocupacaoPorPasto,
  };
}

/**
 * Resumo executivo da fazenda para envio rápido a sócios/gerentes, reaproveitando
 * buildAlerts() e construirHojeNaFazenda() já existentes no dashboard.
 */
export function buildResumoGeralFazenda(db) {
  const fazendas = arr(db?.fazendas);
  const pastagens = arr(db?.pastagens);
  const lotesAtivos = arr(db?.lotes).filter((l) => l.status === 'ativo');

  const totalCabecas = lotesAtivos.reduce((soma, l) => soma + toNumber(l.qtd), 0);

  let lucroTotalFazenda = 0;
  let somaPesoPonderado = 0;
  lotesAtivos.forEach((lote) => {
    const resumo = getResumoLote(db, lote.id);
    lucroTotalFazenda += toNumber(resumo.lucroTotal);
    somaPesoPonderado += toNumber(resumo.pesoAtualMedio) * toNumber(resumo.totalAnimais);
  });
  const pesoMedioGeral = totalCabecas > 0 ? somaPesoPonderado / totalCabecas : 0;

  const alertas = buildAlerts(db);
  const alertasCriticos = alertas.filter((a) => a?.nivel === 'critical');
  const hojeNaFazenda = construirHojeNaFazenda(db, { alerts: alertas });

  return {
    totalFazendas: fazendas.length,
    totalPastos: pastagens.length,
    totalLotesAtivos: lotesAtivos.length,
    totalCabecas,
    pesoMedioGeral,
    lucroTotalFazenda,
    alertasCriticos,
    pendencias: hojeNaFazenda.prioridades,
  };
}
