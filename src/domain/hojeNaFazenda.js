import { toNumber, toDateKey, daysBetween } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';
import { isMovimentacaoCancelada, isMovimentacaoPaga, getDataVencimento } from './financeiroStatus.js';
import { calcularOcupacaoPastos, listarLotesSemPasto } from './ocupacaoPastos.js';
import { montarDadosDecisaoVenda, classificarDecisaoVenda, STATUS_DECISAO } from './decisaoVenda.js';
import { montarDadosManejoResultado, STATUS_SANIDADE, STATUS_SUPLEMENTACAO } from './manejoResultado.js';

import { hojeLocalISO } from './dataCivil.js';
export { listarLotesSemPasto };

const PESAGEM_LIMITE_DIAS = 30;
const FINANCEIRO_PROXIMO_DIAS = 3;

function hojeIso() {
  return hojeLocalISO();
}

function lotesAtivosDe(db) {
  return (Array.isArray(db?.lotes) ? db.lotes : []).filter((lote) => lote?.status === 'ativo');
}

export function listarLotesSemPesagemRecente(db = {}, limiteDias = PESAGEM_LIMITE_DIAS) {
  const hoje = hojeIso();
  return lotesAtivosDe(db).filter((lote) => {
    if (!lote.ultima_pesagem) return true;
    const dias = daysBetween(lote.ultima_pesagem, hoje);
    return dias > limiteDias;
  });
}

export function listarLotesComGmdAbaixoDaMeta(db = {}) {
  return lotesAtivosDe(db).filter((lote) => {
    const meta = toNumber(lote.gmd_meta);
    if (meta <= 0) return false;
    const resumo = getResumoLote(db, lote.id);
    if (resumo.totalAnimais <= 0 || resumo.dias <= 0) return false;
    return resumo.gmdMedio < meta;
  });
}

/**
 * Lotes que precisam de revisão de manejo sanitário ou de suplementação,
 * a partir de `manejoResultado.js` (Sprint 33) — combinados num único
 * critério para não poluir o Dashboard com várias prioridades parecidas.
 */
export function listarLotesParaRevisaoManejo(db = {}) {
  return lotesAtivosDe(db).filter((lote) => {
    const dados = montarDadosManejoResultado(db, lote.id);
    if (!dados.encontrado) return false;
    const sanidadeRevisar = dados.sanidade?.status === STATUS_SANIDADE.REVISAR_MANEJO;
    const suplementoCustoAlto = dados.suplementacao?.status === STATUS_SUPLEMENTACAO.CUSTO_ALTO;
    return sanidadeRevisar || suplementoCustoAlto;
  });
}

/** Lotes em cada categoria de decisão de venda, a partir de `decisaoVenda.js`. */
export function listarLotesPorStatusDecisaoVenda(db = {}) {
  const lotesComStatus = lotesAtivosDe(db).map((lote) => ({
    lote,
    decisao: classificarDecisaoVenda(montarDadosDecisaoVenda(db, lote.id)),
  }));

  return {
    prontosParaAvaliar: lotesComStatus.filter((item) => item.decisao.status === STATUS_DECISAO.PRONTO_AVALIAR),
    custoAlto: lotesComStatus.filter((item) => item.decisao.status === STATUS_DECISAO.CUSTO_ALTO),
  };
}

export function listarContasFinanceiras(db = {}, diasProximo = FINANCEIRO_PROXIMO_DIAS) {
  const movimentos = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const hoje = hojeIso();
  const vencidas = [];
  const proximas = [];

  movimentos.forEach((mov) => {
    if (!mov || mov.tipo !== 'despesa') return;
    if (isMovimentacaoPaga(mov) || isMovimentacaoCancelada(mov)) return;
    const vencimento = toDateKey(getDataVencimento(mov));
    if (!vencimento) return;
    const dias = daysBetween(hoje, vencimento);
    if (dias < 0) vencidas.push(mov);
    else if (dias <= diasProximo) proximas.push(mov);
  });

  return { vencidas, proximas };
}

export function listarEstoqueBaixo(db = {}) {
  return (Array.isArray(db?.estoque) ? db.estoque : []).filter((item) => {
    const atual = toNumber(item?.quantidade_atual);
    const minimo = toNumber(item?.quantidade_minima);
    return minimo > 0 && atual <= minimo;
  });
}

/**
 * Resumo de ocupação de pastos. A lotação (`ocupacao`, `pastosEmAtencao`,
 * `pastosAcimaCapacidade`) vem de `calcularOcupacaoPastos()` (Sprint 25),
 * que compara UA estimada (peso vivo ÷ 450) com a capacidade do próprio
 * pasto em UA — mesma unidade nos dois lados, sem cálculo zootécnico avançado.
 * `pastosComIndicioDeExcesso` é mantido por compatibilidade com telas antigas.
 */
export function construirResumoPastos(db = {}) {
  const pastagens = Array.isArray(db?.pastagens) ? db.pastagens : [];
  const ativos = lotesAtivosDe(db);
  const pastoIdsComLote = new Set(ativos.map((lote) => lote.pastagem_id).filter(Boolean).map(String));

  const pastosComLote = pastagens.filter((pasto) => pastoIdsComLote.has(String(pasto.id)));
  const pastosSemLote = pastagens.filter((pasto) => !pastoIdsComLote.has(String(pasto.id)));
  const lotesSemPasto = listarLotesSemPasto(db);

  const pastosComIndicioDeExcesso = pastosComLote.filter((pasto) => {
    const capacidadeUa = toNumber(pasto.area_ha) * toNumber(pasto.capacidade_suporte_ua_ha);
    if (capacidadeUa <= 0) return false;
    const cabecasNoPasto = ativos
      .filter((lote) => String(lote.pastagem_id) === String(pasto.id))
      .reduce((soma, lote) => soma + toNumber(lote.qtd), 0);
    return cabecasNoPasto > capacidadeUa;
  });

  const ocupacao = calcularOcupacaoPastos(db);
  const pastosEmAtencao = ocupacao.filter((p) => p.status === 'atencao');
  const pastosAcimaCapacidade = ocupacao.filter((p) => p.status === 'acima_capacidade');
  const pastosSemDadosLotacao = ocupacao.filter((p) => p.status === 'sem_dados');

  return {
    totalPastos: pastagens.length,
    pastosComLote: pastosComLote.length,
    pastosSemLote: pastosSemLote.length,
    lotesSemPasto: lotesSemPasto.length,
    pastosComIndicioDeExcesso,
    ocupacao,
    pastosEmAtencao,
    pastosAcimaCapacidade,
    pastosSemDadosLotacao,
  };
}

function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

/**
 * Monta a lista de "prioridades do dia" em linguagem simples, a partir dos
 * dados já disponíveis em `db` e dos alertas já calculados pelo app
 * (`alerts`, vindo de buildAlerts). Cada item só aparece se houver pelo
 * menos 1 ocorrência. Retorna também o objeto bruto de cada categoria, para a
 * tela poder linkar para a lista completa quando quiser.
 */
export function construirHojeNaFazenda(db = {}, { alerts = [] } = {}) {
  const lotesSemPesagem = listarLotesSemPesagemRecente(db);
  const lotesGmdBaixo = listarLotesComGmdAbaixoDaMeta(db);
  const lotesSemPasto = listarLotesSemPasto(db);
  const { prontosParaAvaliar: lotesProntosParaVenda, custoAlto: lotesCustoAltoArroba } = listarLotesPorStatusDecisaoVenda(db);
  const lotesParaRevisaoManejo = listarLotesParaRevisaoManejo(db);
  const { vencidas, proximas } = listarContasFinanceiras(db);
  const estoqueBaixo = listarEstoqueBaixo(db);

  const resumoPastos = construirResumoPastos(db);
  const { pastosEmAtencao, pastosAcimaCapacidade } = resumoPastos;

  const alertasCriticosTotal = (Array.isArray(alerts) ? alerts : []).filter((a) => a?.nivel === 'critical');
  const tiposJaCobertos = new Set(['pesagem', 'financeiro', 'estoque', 'pasto']);
  const alertasCriticosOutros = alertasCriticosTotal.filter((a) => !tiposJaCobertos.has(a?.tipo));

  const prioridades = [];

  if (pastosAcimaCapacidade.length > 0) {
    prioridades.push({
      id: 'pastos-acima-capacidade',
      tom: 'critico',
      texto: `${pastosAcimaCapacidade.length} ${pluralizar(pastosAcimaCapacidade.length, 'pasto está', 'pastos estão')} acima da capacidade`,
      rota: 'pastagens',
    });
  }
  if (vencidas.length > 0) {
    prioridades.push({
      id: 'contas-vencidas',
      tom: 'critico',
      texto: `${vencidas.length} ${pluralizar(vencidas.length, 'conta está vencida', 'contas estão vencidas')}`,
      rota: 'financeiro',
    });
  }
  if (lotesSemPesagem.length > 0) {
    prioridades.push({
      id: 'lotes-sem-pesagem',
      tom: 'atencao',
      texto: `${lotesSemPesagem.length} ${pluralizar(lotesSemPesagem.length, 'lote precisa', 'lotes precisam')} de pesagem`,
      rota: 'pesagens',
    });
  }
  if (proximas.length > 0) {
    prioridades.push({
      id: 'contas-proximas',
      tom: 'atencao',
      texto: `${proximas.length} ${pluralizar(proximas.length, 'conta vence', 'contas vencem')} nos próximos dias`,
      rota: 'financeiro',
    });
  }
  if (lotesSemPasto.length > 0) {
    prioridades.push({
      id: 'lotes-sem-pasto',
      tom: 'atencao',
      texto: `${lotesSemPasto.length} ${pluralizar(lotesSemPasto.length, 'lote está', 'lotes estão')} sem pasto definido`,
      rota: 'lotes',
    });
  }
  if (pastosEmAtencao.length > 0) {
    prioridades.push({
      id: 'pastos-em-atencao',
      tom: 'atencao',
      texto: `${pastosEmAtencao.length} ${pluralizar(pastosEmAtencao.length, 'pasto precisa', 'pastos precisam')} de atenção na lotação`,
      rota: 'pastagens',
    });
  }
  if (lotesGmdBaixo.length > 0) {
    prioridades.push({
      id: 'lotes-gmd-baixo',
      tom: 'atencao',
      texto: `${lotesGmdBaixo.length} ${pluralizar(lotesGmdBaixo.length, 'lote está', 'lotes estão')} com ganho de peso abaixo da meta`,
      rota: 'lotes',
    });
  }
  if (estoqueBaixo.length > 0) {
    prioridades.push({
      id: 'estoque-baixo',
      tom: 'atencao',
      texto: `${estoqueBaixo.length} ${pluralizar(estoqueBaixo.length, 'item está', 'itens estão')} com estoque baixo`,
      rota: 'estoque',
    });
  }
  if (lotesParaRevisaoManejo.length > 0) {
    prioridades.push({
      id: 'lotes-revisao-manejo',
      tom: 'atencao',
      texto: `${lotesParaRevisaoManejo.length} ${pluralizar(lotesParaRevisaoManejo.length, 'lote precisa', 'lotes precisam')} de revisão de manejo ou suplementação`,
      rota: 'resultados',
    });
  }
  if (lotesProntosParaVenda.length > 0) {
    prioridades.push({
      id: 'lotes-prontos-venda',
      tom: 'atencao',
      texto: `${lotesProntosParaVenda.length} ${pluralizar(lotesProntosParaVenda.length, 'lote precisa', 'lotes precisam')} de avaliação de venda`,
      rota: 'resultados',
    });
  }
  if (lotesCustoAltoArroba.length > 0) {
    prioridades.push({
      id: 'lotes-custo-alto-arroba',
      tom: 'atencao',
      texto: `${lotesCustoAltoArroba.length} ${pluralizar(lotesCustoAltoArroba.length, 'lote está', 'lotes estão')} com custo por arroba alto`,
      rota: 'resultados',
    });
  }
  if (alertasCriticosOutros.length > 0) {
    prioridades.push({
      id: 'alertas-criticos',
      tom: 'critico',
      texto: `${alertasCriticosOutros.length} ${pluralizar(alertasCriticosOutros.length, 'alerta exige', 'alertas exigem')} atenção`,
      rota: 'dashboard',
    });
  }

  return {
    prioridades,
    detalhes: {
      lotesSemPesagem,
      lotesGmdBaixo,
      lotesSemPasto,
      contasVencidas: vencidas,
      contasProximas: proximas,
      estoqueBaixo,
      alertasCriticosTotal,
      lotesProntosParaVenda,
      lotesCustoAltoArroba,
      lotesParaRevisaoManejo,
    },
    pastos: resumoPastos,
  };
}
