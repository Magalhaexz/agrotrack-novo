import { toNumber, toDateKey, daysBetween } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';
import { isMovimentacaoCancelada, isMovimentacaoPaga, getDataVencimento } from './financeiroStatus.js';

const PESAGEM_LIMITE_DIAS = 30;
const FINANCEIRO_PROXIMO_DIAS = 3;

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function lotesAtivosDe(db) {
  return (Array.isArray(db?.lotes) ? db.lotes : []).filter((lote) => lote?.status === 'ativo');
}

export function listarLotesSemPesagemRecente(db = {}, limiteDias = PESAGEM_LIMITE_DIAS) {
  const hoje = new Date();
  return lotesAtivosDe(db).filter((lote) => {
    if (!lote.ultima_pesagem) return true;
    const dias = (hoje - new Date(lote.ultima_pesagem)) / (1000 * 60 * 60 * 24);
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

export function listarLotesSemPasto(db = {}) {
  return lotesAtivosDe(db).filter((lote) => !lote.pastagem_id);
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
 * Resumo de ocupação de pastos. Não calcula UA por animal — usa a contagem de
 * cabeças (lote.qtd) como indício simples de excesso, comparada com a
 * capacidade do pasto em UA (area_ha * capacidade_suporte_ua_ha). É uma
 * aproximação deliberada, não uma conversão correta de cabeças para UA.
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

  return {
    totalPastos: pastagens.length,
    pastosComLote: pastosComLote.length,
    pastosSemLote: pastosSemLote.length,
    lotesSemPasto: lotesSemPasto.length,
    pastosComIndicioDeExcesso,
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
  const { vencidas, proximas } = listarContasFinanceiras(db);
  const estoqueBaixo = listarEstoqueBaixo(db);

  const alertasCriticosTotal = (Array.isArray(alerts) ? alerts : []).filter((a) => a?.nivel === 'critical');
  const tiposJaCobertos = new Set(['pesagem', 'financeiro', 'estoque']);
  const alertasCriticosOutros = alertasCriticosTotal.filter((a) => !tiposJaCobertos.has(a?.tipo));

  const prioridades = [];

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
    },
    pastos: construirResumoPastos(db),
  };
}
