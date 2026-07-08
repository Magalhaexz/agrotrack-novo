// Previsão de duração do estoque alimentar (Sprint 25) — puro, sem I/O.
//
// Fonte do consumo diário esperado por lote: `consumo_suplementacao`
// (Sprint de Nutrição/Suplementação), que já liga item_estoque_id ↔
// lote_id ↔ consumo_por_cabeca_dia. Só o modo `'por_cabeca'` é somado —
// os outros modos (ex. percentual do peso vivo) dependem do peso atual
// do lote, que este módulo não recalcula (ver `calculateDailyConsumptionKg`
// em `calcHelpers.js`, já usado em `lotesLogic.js` para o alerta de
// consumo por lote — não duplicado aqui de propósito). Lotes com modo
// diferente de `'por_cabeca'` simplesmente não entram na soma; o produto
// fica com o consumo só do que dá para somar com segurança, nunca com um
// número inventado.

const STATUS = {
  SEM_CONSUMO_CONFIGURADO: 'sem_consumo_configurado',
  SEM_ESTOQUE: 'sem_estoque',
  CRITICO: 'critico',
  ATENCAO: 'atencao',
  OK: 'ok',
};

const DIAS_CRITICO = 3;
const DIAS_ATENCAO = 7;

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} params
 * @param {number} params.quantidadeAtual
 * @param {number|null} params.consumoDiario
 */
export function calcularDiasRestantesEstoque({ quantidadeAtual, consumoDiario }) {
  const qtd = toFiniteNumber(quantidadeAtual) ?? 0;

  if (qtd <= 0) {
    return { diasRestantes: 0, status: STATUS.SEM_ESTOQUE, podeCalcular: true, motivo: null };
  }

  const consumo = toFiniteNumber(consumoDiario);
  if (!consumo || consumo <= 0) {
    return { diasRestantes: null, status: STATUS.SEM_CONSUMO_CONFIGURADO, podeCalcular: false, motivo: 'Consumo diário não configurado.' };
  }

  const dias = qtd / consumo;
  const diasRestantes = Math.round(dias * 10) / 10; // 1 casa decimal, sem NaN/Infinity (consumo>0 e qtd finito garantem isso)

  return { diasRestantes, status: classificarCoberturaEstoque(diasRestantes), podeCalcular: true, motivo: null };
}

/** @param {number|null} diasRestantes */
export function classificarCoberturaEstoque(diasRestantes) {
  if (diasRestantes === null || diasRestantes === undefined || !Number.isFinite(diasRestantes)) {
    return STATUS.SEM_CONSUMO_CONFIGURADO;
  }
  if (diasRestantes <= 0) return STATUS.SEM_ESTOQUE;
  if (diasRestantes <= DIAS_CRITICO) return STATUS.CRITICO;
  if (diasRestantes <= DIAS_ATENCAO) return STATUS.ATENCAO;
  return STATUS.OK;
}

/**
 * Soma o consumo diário esperado (modo 'por_cabeca') de todos os lotes
 * que consomem o produto, via registros de `consumo_suplementacao`.
 * @param {object} params
 * @param {number|string} params.produtoId - id do item de estoque
 * @param {Array} params.lotes
 * @param {Array} params.consumos - linhas de consumo_suplementacao
 */
export function calcularConsumoDiarioTotalPorProduto({ produtoId, lotes = [], consumos = [] }) {
  const alvoId = Number(produtoId);
  const lotesMap = new Map((Array.isArray(lotes) ? lotes : []).map((l) => [Number(l?.id), l]));

  const relacionados = (Array.isArray(consumos) ? consumos : [])
    .filter((c) => Number(c?.item_estoque_id) === alvoId);

  let total = 0;
  let temConsumoValido = false;
  const loteIds = new Set();

  relacionados.forEach((consumo) => {
    if (String(consumo?.modo || 'por_cabeca') !== 'por_cabeca') return;
    const cabecaDia = toFiniteNumber(consumo?.consumo_por_cabeca_dia);
    if (!cabecaDia || cabecaDia <= 0) return;
    const lote = lotesMap.get(Number(consumo?.lote_id));
    const cabecas = toFiniteNumber(lote?.qtd ?? lote?.quantidade);
    if (!cabecas || cabecas <= 0) return;

    total += cabecaDia * cabecas;
    temConsumoValido = true;
    if (lote?.id !== undefined) loteIds.add(lote.id);
  });

  return {
    consumoDiario: temConsumoValido ? Math.round(total * 100) / 100 : null,
    lotesConsiderados: Array.from(loteIds),
  };
}

/**
 * @param {object} params
 * @param {Array} params.estoque
 * @param {Array} params.consumos - linhas de consumo_suplementacao
 * @param {Array} params.lotes
 */
export function montarResumoCoberturaEstoque({ estoque = [], consumos = [], lotes = [] }) {
  return (Array.isArray(estoque) ? estoque : []).map((item) => {
    const { consumoDiario, lotesConsiderados } = calcularConsumoDiarioTotalPorProduto({
      produtoId: item?.id,
      lotes,
      consumos,
    });
    const quantidadeAtual = toFiniteNumber(item?.quantidade_atual ?? item?.quantidade) ?? 0;
    const { diasRestantes, status } = calcularDiasRestantesEstoque({ quantidadeAtual, consumoDiario });

    return {
      produtoId: item?.id ?? null,
      produto: item?.produto || item?.nome || 'Produto sem nome',
      fazendaId: item?.fazenda_id ?? null,
      unidade: item?.unidade || item?.unidade_medida || 'un',
      quantidadeAtual,
      consumoDiarioEstimado: consumoDiario,
      diasRestantes,
      status,
      lotesRelacionados: lotesConsiderados,
    };
  });
}

export const STATUS_COBERTURA_ESTOQUE = STATUS;
