import {
  addDaysToDate,
  calculateConsumptionCost,
  calculateDailyConsumptionKg,
  calculateEstimatedDays,
  toDateKey,
  toNumber,
} from '../domain/calcHelpers.js';
import { hojeLocalISO } from '../domain/dataCivil.js';

const FORM_VAZIO = {
  nome: '',
  faz_id: '',
  pastagem_id: '',
  categoria_animal: '',
  raca: '',
  tipo: 'engorda',
  sistema: 'confinamento',
  entrada: hojeLocalISO(),
  qtd: '',
  p_ini: '',
  peso_alvo: '',
  gmd_meta: '',
  supl_nome: '',
  consumo_tipo: 'percentual_pv',
  consumo_por_cabeca_dia: '',
  supl_rkg: '',
  preco_arroba: '',
  investimento: '',
  custo_fixo_mensal: '',
  rendimento_carcaca: '52',
  outras_desp_pc_mes: 0,
  tem_recria: false,
  tem_engorda: false,
  dias_recria: 0,
  p_ini_recria: 0,
  p_fim_recria: 0,
  dias_engorda: 0,
  supl_pv_pct: 0,
  supl_estoque_kg: 0,
  supl_meta_dias: 30,
};

const TIPOS_CONSUMO = [
  { value: 'percentual_pv', label: '% PV' },
  { value: 'kg_cab_dia', label: 'kg/cab/dia' },
];

function formatNumber(value, fractionDigits = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value));
}

function formatDateBr(value) {
  const dateKey = toDateKey(value);
  if (!dateKey) return '';
  const [year, month, day] = dateKey.split('-');
  return `${day}/${month}/${year}`;
}

function addDays(dateValue, days) {
  return addDaysToDate(dateValue, days);
}

function isWholePositiveInteger(value) {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) && Number(text) > 0;
}

function buildPlanningSummary({
  gmdEsperado,
  produto,
  consumoTipo,
  consumoInformado,
  dataPrevistaSaida,
  consumoEstimado,
  custoEstimado,
}) {
  return [
    `GMD esperado: ${gmdEsperado}`,
    `Dieta/produto: ${produto}`,
    `Consumo esperado: ${consumoTipo}`,
    `Consumo esperado informado: ${consumoInformado}`,
    `Saída projetada (informativa): ${dataPrevistaSaida}`,
    `Consumo estimado suplemento (kg): ${consumoEstimado}`,
    `Custo estimado suplemento (R$): ${custoEstimado}`,
  ].join(' | ');
}

function getConsumoTipoLabel(tipo) {
  return TIPOS_CONSUMO.find((item) => item.value === tipo)?.label || '% PV';
}

function getInitialConsumoTipo(data) {
  if (data?.consumo_tipo) return data.consumo_tipo;
  if (toNumber(data?.consumo_por_cabeca_dia) > 0) return 'kg_cab_dia';
  if (toNumber(data?.supl_pv_pct) > 0) return 'percentual_pv';
  return 'percentual_pv';
}

function getInitialConsumoValue(data) {
  const tipo = getInitialConsumoTipo(data);
  if (tipo === 'kg_cab_dia') return data?.consumo_por_cabeca_dia ?? '';
  return data?.consumo_por_cabeca_dia ?? data?.supl_pv_pct ?? '';
}

function findPastagemLabel(pastagens, pastagemId) {
  if (!pastagemId) return '';
  return pastagens.find((item) => String(item.id) === String(pastagemId))?.nome || '';
}

export function normalizarInitialData(data, pastagens = [], fazendaAtiva = null) {
  if (!data) {
    return {
      ...FORM_VAZIO,
      faz_id: fazendaAtiva?.id ?? '',
    };
  }
  return {
    ...FORM_VAZIO,
    nome: data.nome || '',
    faz_id: data.faz_id ?? data.fazenda_id ?? fazendaAtiva?.id ?? '',
    pastagem_id: data.pastagem_id ?? data.pastagemId ?? data.pastagem_atual_id ?? '',
    categoria_animal: data.categoria_animal ?? data.categoria ?? '',
    raca: data.raca ?? data.raca_animal ?? data.gen ?? '',
    tipo: data.tipo || 'engorda',
    sistema: data.sistema || 'confinamento',
    entrada: data.entrada || hojeLocalISO(),
    qtd: data.qtd ?? '',
    p_ini: data.p_ini ?? data.p_at ?? '',
    peso_alvo: data.peso_alvo ?? '',
    gmd_meta: data.gmd_meta ?? '',
    supl_nome: data.supl_nome ?? '',
    consumo_tipo: getInitialConsumoTipo(data),
    consumo_por_cabeca_dia: getInitialConsumoValue(data),
    supl_rkg: data.supl_rkg ?? data.preco_kg ?? '',
    preco_arroba: data.preco_arroba ?? '',
    investimento: data.investimento ?? '',
    custo_fixo_mensal: data.custo_fixo_mensal ?? '',
    rendimento_carcaca: data.rendimento_carcaca ?? '52',
    outras_desp_pc_mes: data.outras_desp_pc_mes ?? 0,
    tem_recria: data.tem_recria ?? (data.tipo === 'recria' || data.tipo === 'recria+engorda'),
    tem_engorda: data.tem_engorda ?? (data.tipo === 'engorda' || data.tipo === 'recria+engorda' || data.tipo === 'confinamento'),
    dias_recria: data.dias_recria ?? 0,
    p_ini_recria: data.p_ini_recria ?? 0,
    p_fim_recria: data.p_fim_recria ?? 0,
    dias_engorda: data.dias_engorda ?? data.dias_estimados ?? 0,
    supl_pv_pct: data.supl_pv_pct ?? 0,
    supl_estoque_kg: data.supl_estoque_kg ?? 0,
    supl_meta_dias: data.supl_meta_dias ?? data.dias_estimados ?? 30,
    pastagem_nome: data.pastagem_nome || findPastagemLabel(pastagens, data.pastagem_id ?? data.pastagemId ?? data.pastagem_atual_id ?? ''),
  };
}

function calcularPlanejamento(form) {
  const quantidade = toNumber(form.qtd);
  const pesoInicial = toNumber(form.p_ini);
  const pesoAlvo = toNumber(form.peso_alvo);
  const gmdEsperado = toNumber(form.gmd_meta);
  const consumoInformado = toNumber(form.consumo_por_cabeca_dia);
  const precoKg = toNumber(form.supl_rkg);
  const diasEstimados = calculateEstimatedDays(pesoInicial, pesoAlvo, gmdEsperado);
  const consumoKgDiaPorAnimal = calculateDailyConsumptionKg({
    mode: form.consumo_tipo,
    heads: 1,
    pesoInicial,
    pesoFinal: pesoAlvo,
    percentualPv: consumoInformado,
    kgPorCabeca: consumoInformado,
  });
  const consumoTotalEstimado = quantidade > 0 && diasEstimados > 0
    ? consumoKgDiaPorAnimal * quantidade * diasEstimados
    : 0;
  const custoEstimadoTotal = calculateConsumptionCost(consumoTotalEstimado, precoKg);
  const dataPrevistaSaida = addDays(form.entrada, Math.round(diasEstimados));

  return {
    diasEstimados,
    dataPrevistaSaida,
    consumoTotalEstimado,
    custoEstimadoTotal,
  };
}

export function validarForm(form, planejamento) {
  if (!form.nome.trim()) return 'Informe o nome do lote.';
  if (!form.faz_id) return 'Selecione a fazenda.';
  if (!form.entrada) return 'Informe a data de entrada.';
  if (toNumber(form.qtd) <= 0) return 'Informe a quantidade de cabeças.';
  if (toNumber(form.p_ini) <= 0) return 'Informe o peso médio inicial.';
  if (toNumber(form.peso_alvo) <= 0) return 'Informe o peso alvo final.';
  if (toNumber(form.peso_alvo) <= toNumber(form.p_ini)) return 'O peso alvo final deve ser maior que o peso médio inicial.';
  if (toNumber(form.gmd_meta) <= 0) return 'Informe o GMD esperado.';
  if (planejamento.diasEstimados <= 0) return 'Não foi possível calcular os dias estimados com os dados informados.';
  if (!planejamento.dataPrevistaSaida) return 'Não foi possível calcular a data prevista de saída.';
  if (!isWholePositiveInteger(form.supl_meta_dias)) return 'Informe um número inteiro de dias.';
  return null;
}

export function buildLotePlanningPreview(form) {
  const planejamento = calcularPlanejamento(form);
  const tipoConsumoLabel = getConsumoTipoLabel(form.consumo_tipo);
  const consumoInformado = form.consumo_tipo === 'percentual_pv'
    ? `${formatNumber(form.consumo_por_cabeca_dia, 2)} % PV`
    : `${formatNumber(form.consumo_por_cabeca_dia, 3)} kg/cab/dia`;
  return {
    planejamento,
    planningSummary: buildPlanningSummary({
      gmdEsperado: `${formatNumber(form.gmd_meta, 3)} kg/dia`,
      produto: String(form.supl_nome || '').trim(),
      consumoTipo: tipoConsumoLabel,
      consumoInformado,
      dataPrevistaSaida: formatDateBr(planejamento.dataPrevistaSaida),
      consumoEstimado: formatNumber(planejamento.consumoTotalEstimado, 2),
      custoEstimado: formatNumber(planejamento.custoEstimadoTotal, 2),
    }),
  };
}
