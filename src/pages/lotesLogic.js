import { calculateDailyConsumptionKg, toNumber } from '../domain/calcHelpers.js';

export function filterLotesByActiveFarm(lotes = [], activeFarmId = null) {
  if (!activeFarmId) return [];
  return (Array.isArray(lotes) ? lotes : []).filter((lote) => Number(lote?.faz_id) === Number(activeFarmId));
}

export function isWholePositiveInteger(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return false;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed > 0;
}

export function buildLoteConsumptionHistoryRows(consumos = [], loteId = null) {
  const targetId = Number(loteId);
  return (Array.isArray(consumos) ? consumos : [])
    .filter((item) => Number(item?.lote_id) === targetId)
    .map((item) => ({
      ...item,
      key: `consumo-${item.id}`,
      tipo: 'consumo',
      quantidade: toNumber(item?.qtd_total ?? item?.quantidade_total ?? item?.quantidade),
      peso_medio: toNumber(item?.peso_medio_usado),
      obs: item?.obs || '',
    }));
}

function calculateDailyPlannedConsumption(lote, heads, pesoAtual) {
  const consumoTipo = String(lote?.consumo_tipo || '').toLowerCase();
  const consumoInformado = toNumber(lote?.consumo_por_cabeca_dia);

  if (consumoTipo === 'kg_cab_dia' && consumoInformado > 0 && heads > 0) {
    return heads * consumoInformado;
  }

  if (toNumber(lote?.consumo_total_estimado) > 0 && toNumber(lote?.dias_estimados) > 0) {
    return toNumber(lote.consumo_total_estimado) / toNumber(lote.dias_estimados);
  }

  return calculateDailyConsumptionKg({
    mode: consumoTipo,
    heads,
    pesoInicial: toNumber(lote?.p_ini || pesoAtual),
    pesoFinal: pesoAtual,
    percentualPv: consumoTipo === 'percentual_pv' ? consumoInformado : toNumber(lote?.supl_pv_pct),
    kgPorCabeca: consumoInformado,
  });
}

export function buildLoteConsumptionAlert({ lote, consumoRows = [] } = {}) {
  const expectedDaily = calculateDailyPlannedConsumption(
    lote,
    toNumber(lote?.heads || lote?.qtd || 0),
    toNumber(lote?.pesoAtual || lote?.p_at || lote?.p_ini)
  );
  const totalRecorded = (Array.isArray(consumoRows) ? consumoRows : []).reduce((sum, item) => sum + toNumber(item?.quantidade), 0);
  const averageRecorded = consumoRows.length > 0 ? totalRecorded / consumoRows.length : 0;

  if (expectedDaily <= 0 || consumoRows.length === 0) {
    return {
      tone: 'neutral',
      message: 'Sem histórico de consumo registrado.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  if (averageRecorded > expectedDaily) {
    return {
      tone: 'warning',
      message: 'Consumo acima do esperado para este lote.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  if (averageRecorded <= expectedDaily * 0.8) {
    return {
      tone: 'danger',
      message: 'Consumo muito abaixo do esperado para este lote.',
      expectedDaily,
      actualDaily: averageRecorded,
    };
  }

  return {
    tone: 'success',
    message: 'Consumo dentro do esperado.',
    expectedDaily,
    actualDaily: averageRecorded,
  };
}

export function buildLoteSavePatch(payload = {}, loteEmEdicao = null, activeFarmId = null) {
  return {
    ...payload,
    faz_id: loteEmEdicao?.faz_id ? Number(loteEmEdicao.faz_id) : activeFarmId,
    pastagem_id: payload.pastagem_id ?? null,
    categoria_animal: payload.categoria_animal || '',
    raca: payload.raca || '',
    sistema: payload.sistema || 'confinamento',
    tipo: payload.tipo || 'confinamento',
    tem_recria: false,
    dias_recria: 0,
    tem_engorda: true,
    dias_engorda: toNumber(payload.dias_estimados || payload.dias_engorda),
    gmd_meta: toNumber(payload.gmd_meta),
    investimento: toNumber(payload.investimento),
    preco_arroba: toNumber(payload.preco_arroba),
    rendimento_carcaca: toNumber(payload.rendimento_carcaca),
    qtd: toNumber(payload.qtd),
    p_ini: toNumber(payload.p_ini),
    p_at: toNumber(payload.p_at || payload.p_ini),
    peso_alvo: toNumber(payload.peso_alvo),
    dias_estimados: toNumber(payload.dias_estimados),
    consumo_tipo: payload.consumo_tipo || 'percentual_pv',
    consumo_por_cabeca_dia: toNumber(payload.consumo_por_cabeca_dia),
    consumo_total_estimado: toNumber(payload.consumo_total_estimado),
    custo_total_estimado: toNumber(payload.custo_total_estimado),
    preco_kg: toNumber(payload.preco_kg || payload.supl_rkg),
    supl_nome: payload.supl_nome || '',
    supl_rkg: toNumber(payload.supl_rkg || payload.preco_kg),
    supl_pv_pct: toNumber(payload.supl_pv_pct),
    supl_meta_dias: toNumber(payload.supl_meta_dias || payload.dias_estimados),
  };
}

/**
 * Monta o registro de "grupo de animais" criado automaticamente quando um
 * lote novo é cadastrado com cabeças preenchidas — sem isso, Resultado do
 * Lote/Decisão de Venda/Manejo (que calculam tudo a partir de `animais`,
 * não de `lotes.qtd`) ficam em "dados insuficientes" mesmo com pesagens e
 * despesas reais. Retorna `null` quando não há cabeças para registrar.
 */
export function buildGrupoAnimaisAutoPatch(lote) {
  const qtd = toNumber(lote?.qtd);
  if (qtd <= 0) return null;

  const pesoInicial = toNumber(lote?.p_ini);
  const pesoAtual = toNumber(lote?.p_at) || pesoInicial;

  return {
    tipo_registro: 'grupo',
    fazenda_id: lote?.faz_id ? Number(lote.faz_id) : null,
    lote_id: lote?.id ?? null,
    identificacao: lote?.nome || 'Grupo do lote',
    nome: lote?.nome || 'Grupo do lote',
    categoria: lote?.categoria_animal || '',
    raca: lote?.raca || '',
    qtd,
    p_ini: pesoInicial,
    p_at: pesoAtual,
    data_referencia: lote?.entrada || new Date().toISOString().slice(0, 10),
    status: 'ativo',
    rendimento_carcaca: toNumber(lote?.rendimento_carcaca) || 52,
    observacao: 'Criado automaticamente a partir do cadastro do lote.',
    metadata: { criado_automaticamente: true, origem: 'lote_qtd_auto' },
  };
}

/**
 * Bug 3.2 — a primeira pesagem do histórico deve corresponder ao peso médio
 * de entrada informado no cadastro do lote. Retorna `null` quando não há
 * peso de entrada informado (não inventa pesagem sem dado real). Só deve ser
 * chamada na CRIAÇÃO de um lote novo — nunca retroativamente em lotes já
 * existentes, para não alterar histórico sem diagnóstico.
 */
export function buildPesagemInicialPatch(lote) {
  const pesoInicial = toNumber(lote?.p_ini);
  if (pesoInicial <= 0) return null;

  return {
    lote_id: lote?.id ?? null,
    tipo: 'lote',
    origem: 'lote',
    data: lote?.entrada || new Date().toISOString().slice(0, 10),
    peso_medio: pesoInicial,
    observacao: 'Peso de entrada do lote (registrado automaticamente no cadastro).',
  };
}

export function canCreateLoteInCurrentFarm(activeFarmId, loteEmEdicao = null) {
  return Boolean(activeFarmId) || Boolean(loteEmEdicao);
}

