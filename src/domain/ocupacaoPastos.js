import { toNumber, toNonNegativeNumber } from './calcHelpers.js';
import { calcularUaPorLote } from './unidadeAnimal.js';

const LIMIAR_ATENCAO = 0.8;

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function lotesAtivosDe(lotes) {
  return arr(lotes).filter((l) => l?.status === 'ativo');
}

/**
 * Lotes ativos sem pasto vinculado (pastagem_id vazio/nulo).
 */
export function listarLotesSemPasto(db = {}) {
  return lotesAtivosDe(db?.lotes).filter((l) => !l.pastagem_id);
}

/**
 * Classifica a lotação de um pasto em 5 status, na ordem de prioridade:
 * 1. "vazio" — sem lote ativo vinculado, independentemente de ter área/capacidade cadastrada.
 * 2. "sem_dados" — tem lote(s), mas falta área e/ou capacidade para calcular o percentual.
 * 3. "ok" / "atencao" / "acima_capacidade" — pelo percentual UA estimada vs. capacidade total em UA.
 */
export function classificarLotacaoPasto({ quantidadeLotes, areaHa, capacidadeUaHa, percentualOcupacao }) {
  if (!quantidadeLotes) return 'vazio';
  if (!areaHa || !capacidadeUaHa || percentualOcupacao == null) return 'sem_dados';
  if (percentualOcupacao > 1) return 'acima_capacidade';
  if (percentualOcupacao >= LIMIAR_ATENCAO) return 'atencao';
  return 'ok';
}

export const STATUS_LOTACAO_LABEL = {
  vazio: 'Vazio',
  sem_dados: 'Sem dados suficientes',
  ok: 'Ok',
  atencao: 'Atenção',
  acima_capacidade: 'Acima da capacidade',
};

export function obterLabelStatusLotacao(status) {
  return STATUS_LOTACAO_LABEL[status] || STATUS_LOTACAO_LABEL.sem_dados;
}

/**
 * Ocupação de um único pasto. A lotação estimada usa Unidade Animal
 * (peso vivo ÷ 450, já calculada em `calcularUaPorLote` e usada hoje na
 * página de Pastos) comparada à capacidade do próprio pasto em UA
 * (área_ha × capacidade_suporte_ua_ha) — mesma unidade nos dois lados.
 * Não é um cálculo zootécnico avançado (sem ajuste por categoria, estação,
 * lactação etc.), apenas a fórmula simples já existente no HERDON.
 */
export function calcularOcupacaoPasto(pasto, lotes = [], animais = []) {
  const pastoId = pasto?.id;
  const lotesAtivos = lotesAtivosDe(lotes).filter((l) => String(l.pastagem_id) === String(pastoId));

  const cabecasEstimadas = lotesAtivos.reduce((soma, l) => soma + toNonNegativeNumber(l.qtd), 0);

  const animaisDosLotes = arr(animais).filter((a) => (
    lotesAtivos.some((l) => toNumber(l.id) === toNumber(a?.lote_id))
  ));
  // P1-08: peso ponderado com o MESMO fallback de peso de `calcularUaPorLote`
  // (unidadeAnimal.js) — por animal: p_at → peso_vivo_kg → p_ini; sem NENHUM
  // registro de animal no lote, cai para o peso atual do próprio lote
  // (`lote.p_at`), em vez de zerar. `uaEstimada` abaixo já usa essa mesma
  // fonte via `calcularUaPorLote`; isto só alinha os campos de peso exibidos
  // (`pesoMedioEstimado`/`pesoTotalEstimado`) a ela — nenhuma fórmula de UA
  // nova, e o peso "por cabeça canônica" (`l.qtd`) mantém o mesmo denominador
  // já usado por `cabecasEstimadas`.
  let somaPesoPonderado = 0;
  lotesAtivos.forEach((l) => {
    const animaisDoLote = animaisDosLotes.filter((a) => toNumber(a?.lote_id) === toNumber(l.id));
    const somaPesoAnimais = animaisDoLote.reduce(
      (s, a) => s + toNumber(a?.p_at || a?.peso_vivo_kg || a?.p_ini) * toNonNegativeNumber(a?.qtd),
      0
    );
    const somaQtdAnimais = animaisDoLote.reduce((s, a) => s + toNonNegativeNumber(a?.qtd), 0);
    const pesoMedioLote = somaQtdAnimais > 0 ? somaPesoAnimais / somaQtdAnimais : toNumber(l?.p_at);
    somaPesoPonderado += pesoMedioLote * toNonNegativeNumber(l.qtd);
  });
  const pesoMedioEstimado = cabecasEstimadas > 0 ? somaPesoPonderado / cabecasEstimadas : 0;
  const pesoTotalEstimado = somaPesoPonderado;

  // 3º argumento: usa lote.qtd (canônico) como contagem, não animais[] cru —
  // teste de campo PST-1, mesma causa raiz do bug de venda já corrigido em
  // src/services/movimentacoes.js.
  const uaEstimada = lotesAtivos.reduce((soma, l) => soma + calcularUaPorLote(animais, l.id, l), 0);

  const areaHa = toNumber(pasto?.area_ha) || null;
  const capacidadeUaHa = toNumber(pasto?.capacidade_suporte_ua_ha) || null;
  const capacidadeTotalUa = areaHa && capacidadeUaHa ? areaHa * capacidadeUaHa : null;
  const percentualOcupacao = capacidadeTotalUa ? uaEstimada / capacidadeTotalUa : null;

  const status = classificarLotacaoPasto({
    quantidadeLotes: lotesAtivos.length,
    areaHa,
    capacidadeUaHa,
    percentualOcupacao,
  });

  return {
    id: pastoId,
    nome: pasto?.nome || 'Pasto sem nome',
    fazendaId: pasto?.fazenda_id ?? pasto?.faz_id ?? null,
    areaHa,
    capacidadeUaHa,
    capacidadeTotalUa,
    lotesAtivos: lotesAtivos.map((l) => ({ id: l.id, nome: l.nome })),
    quantidadeLotes: lotesAtivos.length,
    cabecasEstimadas,
    pesoMedioEstimado,
    pesoTotalEstimado,
    uaEstimada,
    percentualOcupacao,
    status,
    statusLabel: obterLabelStatusLotacao(status),
  };
}

/**
 * Ocupação de todos os pastos (opcionalmente filtrados por fazenda).
 */
export function calcularOcupacaoPastos(db = {}, { fazendaId } = {}) {
  const pastagens = fazendaId
    ? arr(db?.pastagens).filter((p) => toNumber(p?.fazenda_id ?? p?.faz_id) === toNumber(fazendaId))
    : arr(db?.pastagens);
  const lotes = fazendaId
    ? arr(db?.lotes).filter((l) => toNumber(l?.fazenda_id ?? l?.faz_id) === toNumber(fazendaId))
    : arr(db?.lotes);
  const animais = arr(db?.animais);

  return pastagens.map((pasto) => calcularOcupacaoPasto(pasto, lotes, animais));
}
