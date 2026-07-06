// Motor Único de Alertas Internos do HERDON (Sprint 5).
//
// Fonte canônica para exibir alertas: agrupa e padroniza o que já é
// calculado por `alertasInteligentes.js` (GMD, peso alvo, estoque, tarefas
// atrasadas, sanidade, custo) e por `hojeNaFazenda.js` (contas a pagar,
// lotes sem pesagem/pasto, decisão de venda, pastos) num único formato:
//
//   { id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia }
//
// prioridade ∈ {critico, atencao, decisao, informativo}
// origem ∈ {financeiro, estoque, rebanho, sanidade, tarefas, decisao}
//
// Não recalcula nada — só lê os arrays/severidades que essas funções já
// produzem e monta um alerta resumido por categoria. Os sistemas legados
// (`utils/alerts.js`, `hojeNaFazenda.construirHojeNaFazenda`) continuam
// existindo e não foram alterados — ver
// docs/SPRINT5_MOTOR_UNICO_ALERTAS_RESULTADO.md para o mapa completo.
import { toDateKey } from './calcHelpers.js';
import { gerarAlertasPriorizados, SEVERIDADE } from './alertasInteligentes.js';
import {
  listarContasFinanceiras,
  listarLotesSemPesagemRecente,
  listarLotesSemPasto,
  listarLotesPorStatusDecisaoVenda,
  construirResumoPastos,
} from './hojeNaFazenda.js';
import { getDataVencimento } from './financeiroStatus.js';

export const PRIORIDADE = {
  CRITICO: 'critico',
  ATENCAO: 'atencao',
  DECISAO: 'decisao',
  INFORMATIVO: 'informativo',
};

const PRIORIDADE_POR_SEVERIDADE = {
  [SEVERIDADE.CRITICO]: PRIORIDADE.CRITICO,
  [SEVERIDADE.ALTO]: PRIORIDADE.ATENCAO,
  [SEVERIDADE.MEDIO]: PRIORIDADE.ATENCAO,
  [SEVERIDADE.BAIXO]: PRIORIDADE.INFORMATIVO,
};

const ORDEM_PRIORIDADE = {
  [PRIORIDADE.CRITICO]: 0,
  [PRIORIDADE.ATENCAO]: 1,
  [PRIORIDADE.DECISAO]: 2,
  [PRIORIDADE.INFORMATIVO]: 3,
};

const ORIGEM_POR_TIPO_INTELIGENTE = {
  gmd: 'rebanho',
  peso_alvo: 'decisao',
  estoque: 'estoque',
  tarefa: 'tarefas',
  sanidade: 'sanidade',
  custo: 'financeiro',
};

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

function alertaPadrao({ id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia = null }) {
  return { id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia };
}

function tituloGrupoInteligente(tipo, prioridade, quantidade) {
  const plural = quantidade > 1;
  switch (tipo) {
    case 'gmd':
      return `${quantidade} ${pluralizar(quantidade, 'lote está', 'lotes estão')} ${prioridade === PRIORIDADE.CRITICO ? 'bem abaixo' : 'abaixo'} do GMD esperado`;
    case 'peso_alvo':
      return `${quantidade} ${pluralizar(quantidade, 'lote está', 'lotes estão')} perto ou no peso alvo`;
    case 'estoque':
      return `${quantidade} ${pluralizar(quantidade, 'item está', 'itens estão')} ${prioridade === PRIORIDADE.CRITICO ? 'com estoque crítico' : 'com estoque em atenção'}`;
    case 'tarefa':
      return `${quantidade} ${pluralizar(quantidade, 'tarefa está', 'tarefas estão')} atrasada${plural ? 's' : ''}`;
    case 'sanidade':
      return `${quantidade} ${pluralizar(quantidade, 'manejo sanitário está', 'manejos sanitários estão')} vencido${plural ? 's' : ''} ou próximo${plural ? 's' : ''}`;
    case 'custo':
      return 'Custo da fazenda subiu acima do previsto';
    default:
      return `${quantidade} alerta${plural ? 's' : ''}`;
  }
}

/**
 * Agrupa os alertas por-entidade de `gerarAlertasPriorizados()` (GMD, peso
 * alvo, estoque, tarefa, sanidade, custo) em 1 alerta resumido por tipo e
 * faixa de prioridade — não recalcula severidade, só lê `alerta.severidade`
 * (já calculada) e conta quantos itens caem em cada faixa.
 */
function agruparAlertasInteligentes(db, agora) {
  const brutos = gerarAlertasPriorizados(db, agora);
  const grupos = new Map();

  brutos.forEach((alerta) => {
    // `peso_alvo` é tratado como sinal de decisão (lote perto de vender), não
    // como severidade técnica — mesmo critério já usado no Dashboard (Sprint 4)
    // para "lote pronto para venda".
    const prioridade = alerta.tipo === 'peso_alvo'
      ? PRIORIDADE.DECISAO
      : (PRIORIDADE_POR_SEVERIDADE[alerta.severidade] || PRIORIDADE.INFORMATIVO);

    const chave = `${alerta.tipo}:${prioridade}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { tipo: alerta.tipo, prioridade, pageId: alerta.pagina, itens: [] });
    }
    grupos.get(chave).itens.push(alerta);
  });

  return Array.from(grupos.values()).map((grupo) => {
    const quantidade = grupo.itens.length;
    return alertaPadrao({
      id: `unificado-${grupo.tipo}-${grupo.prioridade}`,
      tipo: grupo.tipo,
      prioridade: grupo.prioridade,
      origem: ORIGEM_POR_TIPO_INTELIGENTE[grupo.tipo] || 'rebanho',
      titulo: tituloGrupoInteligente(grupo.tipo, grupo.prioridade, quantidade),
      descricao: grupo.itens.slice(0, 3).map((item) => item.titulo).join(' · '),
      acaoSugerida: grupo.itens[0].acaoSugerida,
      pageId: grupo.pageId,
    });
  });
}

/** Contas a pagar vencidas / vencendo hoje / vencendo em 7 dias — reaproveita `listarContasFinanceiras` (mesma função da Visão Geral de Pagamentos, Sprint 3). */
function agruparFinanceiro(db, hoje) {
  const alertas = [];
  const { vencidas, proximas } = listarContasFinanceiras(db, 7);
  const vencendoHoje = proximas.filter((mov) => getDataVencimento(mov) === hoje);
  const proximos7Dias = proximas.filter((mov) => getDataVencimento(mov) !== hoje);

  const descricaoDe = (lista) => lista.slice(0, 3).map((mov) => mov.descricao || mov.categoria || 'Despesa').join(' · ');

  if (vencidas.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-financeiro-vencidas',
      tipo: 'financeiro-vencido',
      prioridade: PRIORIDADE.CRITICO,
      origem: 'financeiro',
      titulo: `${vencidas.length} ${pluralizar(vencidas.length, 'conta está', 'contas estão')} vencida${vencidas.length > 1 ? 's' : ''}`,
      descricao: descricaoDe(vencidas),
      acaoSugerida: 'Regularizar os pagamentos vencidos.',
      pageId: 'financeiro',
    }));
  }
  if (vencendoHoje.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-financeiro-hoje',
      tipo: 'financeiro-vence-hoje',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'financeiro',
      titulo: `${vencendoHoje.length} ${pluralizar(vencendoHoje.length, 'pagamento vence', 'pagamentos vencem')} hoje`,
      descricao: descricaoDe(vencendoHoje),
      acaoSugerida: 'Confirmar o pagamento hoje para não vencer.',
      pageId: 'financeiro',
    }));
  }
  if (proximos7Dias.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-financeiro-7-dias',
      tipo: 'financeiro-vence-7-dias',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'financeiro',
      titulo: `${proximos7Dias.length} ${pluralizar(proximos7Dias.length, 'pagamento vence', 'pagamentos vencem')} nos próximos 7 dias`,
      descricao: descricaoDe(proximos7Dias),
      acaoSugerida: 'Planejar o pagamento dentro da semana.',
      pageId: 'financeiro',
    }));
  }
  return alertas;
}

/** Lotes sem pesagem recente / sem pasto definido — reaproveita `hojeNaFazenda.js`. */
function agruparRebanho(db) {
  const alertas = [];
  const semPesagem = listarLotesSemPesagemRecente(db);
  const semPasto = listarLotesSemPasto(db);
  const nomeDe = (lista) => lista.slice(0, 3).map((lote) => lote.nome || `Lote ${lote.id}`).join(' · ');

  if (semPesagem.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-rebanho-sem-pesagem',
      tipo: 'sem-pesagem',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${semPesagem.length} ${pluralizar(semPesagem.length, 'lote precisa', 'lotes precisam')} de pesagem`,
      descricao: nomeDe(semPesagem),
      acaoSugerida: 'Registrar uma nova pesagem para o lote.',
      pageId: 'pesagens',
    }));
  }
  if (semPasto.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-rebanho-sem-pasto',
      tipo: 'sem-pasto',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${semPasto.length} ${pluralizar(semPasto.length, 'lote está', 'lotes estão')} sem pasto definido`,
      descricao: nomeDe(semPasto),
      acaoSugerida: 'Vincular o lote a um pasto cadastrado.',
      pageId: 'lotes',
    }));
  }
  return alertas;
}

/** Lote pronto para avaliar venda / custo por arroba alto — reaproveita `decisaoVenda.js` via `hojeNaFazenda.js`. */
function agruparDecisao(db) {
  const alertas = [];
  const { prontosParaAvaliar, custoAlto } = listarLotesPorStatusDecisaoVenda(db);
  const nomeDe = (lista) => lista.slice(0, 3).map((item) => item.lote.nome || `Lote ${item.lote.id}`).join(' · ');

  if (prontosParaAvaliar.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-decisao-prontos-venda',
      tipo: 'pronto-venda',
      prioridade: PRIORIDADE.DECISAO,
      origem: 'decisao',
      titulo: `${prontosParaAvaliar.length} ${pluralizar(prontosParaAvaliar.length, 'lote está', 'lotes estão')} pronto${prontosParaAvaliar.length > 1 ? 's' : ''} para avaliar venda`,
      descricao: nomeDe(prontosParaAvaliar),
      acaoSugerida: 'Avaliar a decisão de venda do lote.',
      pageId: 'resultados',
    }));
  }
  if (custoAlto.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-decisao-custo-alto',
      tipo: 'custo-alto-arroba',
      prioridade: PRIORIDADE.DECISAO,
      origem: 'decisao',
      titulo: `${custoAlto.length} ${pluralizar(custoAlto.length, 'lote está', 'lotes estão')} com custo por arroba alto`,
      descricao: nomeDe(custoAlto),
      acaoSugerida: 'Revisar o custo do lote antes de decidir.',
      pageId: 'resultados',
    }));
  }
  return alertas;
}

/** Pastos acima da capacidade / em atenção — reaproveita `construirResumoPastos` (`hojeNaFazenda.js`). */
function agruparPastos(db) {
  const alertas = [];
  const resumo = construirResumoPastos(db);
  const nomeDe = (lista) => lista.slice(0, 3).map((pasto) => pasto.nome).join(' · ');

  if (resumo.pastosAcimaCapacidade.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-pastos-acima-capacidade',
      tipo: 'pasto-acima-capacidade',
      prioridade: PRIORIDADE.CRITICO,
      origem: 'rebanho',
      titulo: `${resumo.pastosAcimaCapacidade.length} ${pluralizar(resumo.pastosAcimaCapacidade.length, 'pasto está', 'pastos estão')} acima da capacidade`,
      descricao: nomeDe(resumo.pastosAcimaCapacidade),
      acaoSugerida: 'Redistribuir lotes entre pastos.',
      pageId: 'pastagens',
    }));
  }
  if (resumo.pastosEmAtencao.length > 0) {
    alertas.push(alertaPadrao({
      id: 'unificado-pastos-atencao',
      tipo: 'pasto-atencao',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${resumo.pastosEmAtencao.length} ${pluralizar(resumo.pastosEmAtencao.length, 'pasto precisa', 'pastos precisam')} de atenção na lotação`,
      descricao: nomeDe(resumo.pastosEmAtencao),
      acaoSugerida: 'Acompanhar a lotação do pasto.',
      pageId: 'pastagens',
    }));
  }
  return alertas;
}

/**
 * Tarefas com vencimento hoje (ainda não atrasadas). `alertasInteligentes.js`
 * só cobre tarefas já atrasadas — esta é a única checagem nova desta sprint,
 * e é a mesma lógica que já estava (duplicada) no Dashboard desde o Sprint 4,
 * agora centralizada aqui.
 */
function agruparTarefasHoje(db, hoje) {
  const tarefas = Array.isArray(db?.tarefas) ? db.tarefas : [];
  const doDia = tarefas.filter((tarefa) => (
    String(tarefa?.status || '').toLowerCase() !== 'concluida'
    && String(tarefa?.status || '').toLowerCase() !== 'feita'
    && String(tarefa?.data_vencimento || '') === hoje
  ));
  if (doDia.length === 0) return [];

  return [alertaPadrao({
    id: 'unificado-tarefas-hoje',
    tipo: 'tarefa-hoje',
    prioridade: PRIORIDADE.ATENCAO,
    origem: 'tarefas',
    titulo: `${doDia.length} ${pluralizar(doDia.length, 'tarefa é', 'tarefas são')} para hoje`,
    descricao: doDia.slice(0, 3).map((tarefa) => tarefa.titulo || 'Tarefa').join(' · '),
    acaoSugerida: 'Concluir as tarefas do dia.',
    pageId: 'tarefas',
  })];
}

/**
 * Motor Único de Alertas Internos — fonte canônica para Dashboard, Decisões
 * da Fazenda e uma futura integração externa (Telegram/WhatsApp). Devolve a
 * lista padronizada, ordenada por prioridade (crítico → atenção → decisão →
 * informativo).
 */
export function gerarAlertasUnificados(db = {}, opcoes = {}) {
  const agora = opcoes.agora || new Date();
  const hoje = toDateKey(agora) || hojeIso();

  const alertas = [
    ...agruparAlertasInteligentes(db, agora),
    ...agruparFinanceiro(db, hoje),
    ...agruparRebanho(db),
    ...agruparDecisao(db),
    ...agruparPastos(db),
    ...agruparTarefasHoje(db, hoje),
  ];

  return alertas.slice().sort((a, b) => {
    const ordemA = ORDEM_PRIORIDADE[a.prioridade] ?? 99;
    const ordemB = ORDEM_PRIORIDADE[b.prioridade] ?? 99;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return String(a.id).localeCompare(String(b.id));
  });
}
