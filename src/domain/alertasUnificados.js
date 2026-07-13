// Motor Único de Alertas Internos do HERDON (Sprint 5, ampliado nos Sprints 9 e 10).
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
// produzem e monta um alerta resumido por categoria. `agruparSaidaLote` e
// `agruparEstoqueValidade` (Sprint 9) são exceção controlada: cobrem dois
// sinais que só existiam no legado (`utils/alerts.js`) lendo os mesmos
// campos brutos (`lote.saida`, `estoque.data_validade`) que o legado já lia
// — não duplicam nenhum cálculo existente, só fecham uma lacuna de
// cobertura. `agruparCarenciaAtiva` (Sprint 10) segue o mesmo princípio:
// lê `sanitario.data_fim_carencia` (campo novo, migration
// `add_sanitario_carencia_field`), sem alterar o detector de "manejo
// sanitário vencido/vencendo" (`alertasInteligentes.js#detectarSanidadeProxima`,
// que só olha `sanitario.proxima`). O legado (`utils/alerts.js`,
// `hojeNaFazenda.construirHojeNaFazenda`) continua existindo e alimentando o
// painel acionável (resolver/adiar) — ver
// docs/SPRINT9_CENTRAL_ALERTAS_FINAL_RESULTADO.md e
// docs/SPRINT10_AGENDA_SANITARIA_RESULTADO.md para as auditorias completas.
import { toDateKey, daysBetween } from './calcHelpers.js';
import { gerarAlertasPriorizados, SEVERIDADE } from './alertasInteligentes.js';
import {
  listarContasFinanceiras,
  listarLotesSemPesagemRecente,
  listarLotesSemPasto,
  listarLotesPorStatusDecisaoVenda,
  construirResumoPastos,
} from './hojeNaFazenda.js';
import { getDataVencimento } from './financeiroStatus.js';
import { PROXIMOS_7_DIAS, CARENCIA_CRITICA_DIAS } from './janelasAlertas.js';

import { hojeLocalISO } from './dataCivil.js';
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
  return hojeLocalISO();
}

function pluralizar(quantidade, singular, plural) {
  return quantidade === 1 ? singular : plural;
}

// Sprint 12 — contrato interno para montar um alerta com segurança:
// normaliza `dataReferencia` (string/Date vira "YYYY-MM-DD" válido ou
// `null` — nunca `undefined`, nunca inventa `new Date()` como fallback) e
// mantém `loteId`/`loteNome` como `null` quando não há lote seguro. Não é
// exportado: uso interno deste arquivo só.
function criarAlerta({ id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId, dataReferencia = null, loteId = null, loteNome = null, metadata = null }) {
  return {
    id,
    tipo,
    prioridade,
    origem,
    titulo,
    descricao,
    acaoSugerida,
    pageId,
    dataReferencia: toDateKey(dataReferencia) || null,
    loteId: loteId ?? null,
    loteNome: loteNome ?? null,
    ...(metadata ? { metadata } : {}),
  };
}

// Aceita as variações de nome de campo já usadas em diferentes tabelas do
// app (`lote_id` na maioria, `loteId` em objetos já normalizados, `id_lote`
// em alguns imports legados) — nunca infere lote a partir de texto solto.
function obterLoteId(item) {
  if (!item) return null;
  const candidato = item.lote_id ?? item.loteId ?? item.id_lote ?? null;
  if (candidato == null || candidato === '') return null;
  const numero = Number(candidato);
  return Number.isFinite(numero) ? numero : null;
}

function obterLoteNome(item) {
  if (!item) return null;
  const candidato = item.lote_nome ?? item.loteNome ?? item.nome_lote ?? item.nome ?? null;
  const texto = String(candidato ?? '').trim();
  return texto || null;
}

/** Menor data válida entre uma lista de valores — usada para resumir a `dataReferencia` de um grupo com vários itens. `null` quando nenhum item tem data. */
function dataMinima(valores) {
  const chaves = (Array.isArray(valores) ? valores : [])
    .map((valor) => toDateKey(valor))
    .filter(Boolean)
    .sort();
  return chaves[0] || null;
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
    // `loteId`/`loteNome` só quando o grupo tem 1 item só (ambíguo com mais
    // de um lote); `dataReferencia` já vem de cada item (Sprint 12, ver
    // `alertasInteligentes.js`) — usa a mais próxima/urgente do grupo.
    const unico = quantidade === 1 ? grupo.itens[0] : null;
    return criarAlerta({
      id: `unificado-${grupo.tipo}-${grupo.prioridade}`,
      tipo: grupo.tipo,
      prioridade: grupo.prioridade,
      origem: ORIGEM_POR_TIPO_INTELIGENTE[grupo.tipo] || 'rebanho',
      titulo: tituloGrupoInteligente(grupo.tipo, grupo.prioridade, quantidade),
      descricao: grupo.itens.slice(0, 3).map((item) => item.titulo).join(' · '),
      acaoSugerida: grupo.itens[0].acaoSugerida,
      pageId: grupo.pageId,
      dataReferencia: dataMinima(grupo.itens.map((item) => item.dataReferencia)),
      loteId: unico?.loteId ?? null,
      loteNome: unico?.loteNome ?? null,
    });
  });
}

/** Resolve loteId/loteNome só quando a lista tem exatamente 1 lançamento com lote_id — ambíguo com mais de um. */
function loteUnicoFinanceiro(lista, lotesMap) {
  if (!Array.isArray(lista) || lista.length !== 1) return { loteId: null, loteNome: null };
  const mov = lista[0];
  const loteId = obterLoteId(mov);
  if (loteId == null) return { loteId: null, loteNome: null };
  const lote = lotesMap.get(loteId);
  return { loteId, loteNome: lote?.nome ?? obterLoteNome(mov) };
}

/** Contas a pagar vencidas / vencendo hoje / vencendo em 7 dias — reaproveita `listarContasFinanceiras` (mesma função da Visão Geral de Pagamentos, Sprint 3). */
function agruparFinanceiro(db, hoje) {
  const alertas = [];
  const { vencidas, proximas } = listarContasFinanceiras(db, PROXIMOS_7_DIAS);
  const vencendoHoje = proximas.filter((mov) => getDataVencimento(mov) === hoje);
  const proximos7Dias = proximas.filter((mov) => getDataVencimento(mov) !== hoje);
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [Number(l.id), l]));

  const descricaoDe = (lista) => lista.slice(0, 3).map((mov) => mov.descricao || mov.categoria || 'Despesa').join(' · ');

  if (vencidas.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-financeiro-vencidas',
      tipo: 'financeiro-vencido',
      prioridade: PRIORIDADE.CRITICO,
      origem: 'financeiro',
      titulo: `${vencidas.length} ${pluralizar(vencidas.length, 'conta está', 'contas estão')} vencida${vencidas.length > 1 ? 's' : ''}`,
      descricao: descricaoDe(vencidas),
      acaoSugerida: 'Regularizar os pagamentos vencidos.',
      pageId: 'financeiro',
      dataReferencia: dataMinima(vencidas.map(getDataVencimento)),
      ...loteUnicoFinanceiro(vencidas, lotesMap),
    }));
  }
  if (vencendoHoje.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-financeiro-hoje',
      tipo: 'financeiro-vence-hoje',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'financeiro',
      titulo: `${vencendoHoje.length} ${pluralizar(vencendoHoje.length, 'pagamento vence', 'pagamentos vencem')} hoje`,
      descricao: descricaoDe(vencendoHoje),
      acaoSugerida: 'Confirmar o pagamento hoje para não vencer.',
      pageId: 'financeiro',
      dataReferencia: dataMinima(vencendoHoje.map(getDataVencimento)),
      ...loteUnicoFinanceiro(vencendoHoje, lotesMap),
    }));
  }
  if (proximos7Dias.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-financeiro-7-dias',
      tipo: 'financeiro-vence-7-dias',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'financeiro',
      titulo: `${proximos7Dias.length} ${pluralizar(proximos7Dias.length, 'pagamento vence', 'pagamentos vencem')} nos próximos 7 dias`,
      descricao: descricaoDe(proximos7Dias),
      acaoSugerida: 'Planejar o pagamento dentro da semana.',
      pageId: 'financeiro',
      dataReferencia: dataMinima(proximos7Dias.map(getDataVencimento)),
      ...loteUnicoFinanceiro(proximos7Dias, lotesMap),
    }));
  }
  return alertas;
}

/** loteId/loteNome só quando a lista tem exatamente 1 lote — ambíguo com mais de um. */
function loteUnicoDireto(lotes) {
  if (!Array.isArray(lotes) || lotes.length !== 1) return { loteId: null, loteNome: null };
  const lote = lotes[0];
  return { loteId: lote?.id ?? null, loteNome: lote?.nome ?? null };
}

/** Lotes sem pesagem recente / sem pasto definido — reaproveita `hojeNaFazenda.js`. */
function agruparRebanho(db) {
  const alertas = [];
  const semPesagem = listarLotesSemPesagemRecente(db);
  const semPasto = listarLotesSemPasto(db);
  const nomeDe = (lista) => lista.slice(0, 3).map((lote) => lote.nome || `Lote ${lote.id}`).join(' · ');

  if (semPesagem.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-rebanho-sem-pesagem',
      tipo: 'sem-pesagem',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${semPesagem.length} ${pluralizar(semPesagem.length, 'lote precisa', 'lotes precisam')} de pesagem`,
      descricao: nomeDe(semPesagem),
      acaoSugerida: 'Registrar uma nova pesagem para o lote.',
      pageId: 'pesagens',
      // `ultima_pesagem` é a data que torna o alerta relevante (quando existe
      // — lotes nunca pesados não têm essa data, fica null).
      dataReferencia: dataMinima(semPesagem.map((lote) => lote.ultima_pesagem)),
      ...loteUnicoDireto(semPesagem),
    }));
  }
  if (semPasto.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-rebanho-sem-pasto',
      tipo: 'sem-pasto',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${semPasto.length} ${pluralizar(semPasto.length, 'lote está', 'lotes estão')} sem pasto definido`,
      descricao: nomeDe(semPasto),
      acaoSugerida: 'Vincular o lote a um pasto cadastrado.',
      pageId: 'lotes',
      ...loteUnicoDireto(semPasto),
    }));
  }
  return alertas;
}

/** loteId/loteNome só quando a lista de `{lote, ...}` tem exatamente 1 item — ambíguo com mais de um. */
function loteUnicoDecisao(itens) {
  if (!Array.isArray(itens) || itens.length !== 1) return { loteId: null, loteNome: null };
  const lote = itens[0]?.lote;
  return { loteId: lote?.id ?? null, loteNome: lote?.nome ?? null };
}

/** Lote pronto para avaliar venda / custo por arroba alto — reaproveita `decisaoVenda.js` via `hojeNaFazenda.js`. */
function agruparDecisao(db) {
  const alertas = [];
  const { prontosParaAvaliar, custoAlto } = listarLotesPorStatusDecisaoVenda(db);
  const nomeDe = (lista) => lista.slice(0, 3).map((item) => item.lote.nome || `Lote ${item.lote.id}`).join(' · ');

  if (prontosParaAvaliar.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-decisao-prontos-venda',
      tipo: 'pronto-venda',
      prioridade: PRIORIDADE.DECISAO,
      origem: 'decisao',
      titulo: `${prontosParaAvaliar.length} ${pluralizar(prontosParaAvaliar.length, 'lote está', 'lotes estão')} pronto${prontosParaAvaliar.length > 1 ? 's' : ''} para avaliar venda`,
      descricao: nomeDe(prontosParaAvaliar),
      acaoSugerida: 'Avaliar a decisão de venda do lote.',
      pageId: 'resultados',
      // Sem data única real: "pronto para venda"/"custo alto" são estados
      // calculados agora, não vencimentos — dataReferencia fica null (Sprint 12).
      ...loteUnicoDecisao(prontosParaAvaliar),
    }));
  }
  if (custoAlto.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-decisao-custo-alto',
      tipo: 'custo-alto-arroba',
      prioridade: PRIORIDADE.DECISAO,
      origem: 'decisao',
      titulo: `${custoAlto.length} ${pluralizar(custoAlto.length, 'lote está', 'lotes estão')} com custo por arroba alto`,
      descricao: nomeDe(custoAlto),
      acaoSugerida: 'Revisar o custo do lote antes de decidir.',
      pageId: 'resultados',
      ...loteUnicoDecisao(custoAlto),
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
    alertas.push(criarAlerta({
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
    alertas.push(criarAlerta({
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

// Janela de "próxima" saída de lote — mesmo valor usado pelo legado
// (`utils/alerts.js`, LOTE_SAIDA_ALERT_DIAS), para não introduzir um terceiro
// limite divergente para o mesmo sinal (Sprint 9 — auditoria de alertas).
// Sprint 16: valor movido para janelasAlertas.js (mesmo número, só nomeado
// numa fonte única — ver docs/DECISAO_ALERTAS_CENTRAL_UNICA.md).
const LOTE_SAIDA_DIAS_PROXIMA = PROXIMOS_7_DIAS;

/**
 * Data de saída prevista vencida / próxima (Sprint 9) — sinal que só existia
 * no legado (`utils/alerts.js`) até esta sprint. Lê `lotes[].saida`
 * diretamente (mesmo campo que o legado usa), sem recalcular nada que já
 * exista em outro detector.
 */
function agruparSaidaLote(db, hoje) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const ativosComSaida = lotes.filter((l) => l?.status === 'ativo' && l?.saida);

  const vencidas = [];
  const proximas = [];
  ativosComSaida.forEach((lote) => {
    const saida = toDateKey(lote.saida);
    if (!saida) return;
    const dias = daysBetween(hoje, saida);
    if (dias < 0) vencidas.push(lote);
    else if (dias <= LOTE_SAIDA_DIAS_PROXIMA) proximas.push(lote);
  });

  const alertas = [];
  const nomeDe = (lista) => lista.slice(0, 3).map((lote) => lote.nome || `Lote ${lote.id}`).join(' · ');

  if (vencidas.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-lote-saida-vencida',
      tipo: 'lote-saida-vencida',
      prioridade: PRIORIDADE.CRITICO,
      origem: 'rebanho',
      titulo: `${vencidas.length} ${pluralizar(vencidas.length, 'lote tinha', 'lotes tinham')} saída prevista vencida`,
      descricao: nomeDe(vencidas),
      acaoSugerida: 'Confirmar a venda/saída ou atualizar a data prevista do lote.',
      pageId: 'lotes',
      dataReferencia: dataMinima(vencidas.map((lote) => lote.saida)),
      ...loteUnicoDireto(vencidas),
    }));
  }
  if (proximas.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-lote-saida-proxima',
      tipo: 'lote-saida-proxima',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'rebanho',
      titulo: `${proximas.length} ${pluralizar(proximas.length, 'lote tem', 'lotes têm')} saída prevista próxima`,
      descricao: nomeDe(proximas),
      acaoSugerida: 'Planejar a saída/venda do lote.',
      pageId: 'lotes',
      dataReferencia: dataMinima(proximas.map((lote) => lote.saida)),
      ...loteUnicoDireto(proximas),
    }));
  }
  return alertas;
}

/**
 * Validade de produto no estoque vencida / próxima (Sprint 9) — sinal que só
 * existia no legado (`utils/alerts.js`) até esta sprint. `alertasInteligentes.js`
 * só cobre risco de faltar por quantidade/consumo, nunca data de validade.
 * Reaproveita `item.alerta_dias_antes` (mesmo campo configurado pelo usuário
 * na página de Estoque) em vez de inventar um limite novo.
 */
function agruparEstoqueValidade(db, hoje) {
  const itens = Array.isArray(db?.estoque) ? db.estoque : [];

  const vencidos = [];
  const proximos = [];
  itens.forEach((item) => {
    if (!item?.data_validade) return;
    const validade = toDateKey(item.data_validade);
    if (!validade) return;
    const dias = daysBetween(hoje, validade);
    const alertaDiasAntes = Number(item.alerta_dias_antes) || 0;
    if (dias < 0) vencidos.push(item);
    else if (dias <= alertaDiasAntes) proximos.push(item);
  });

  const alertas = [];
  const nomeDe = (lista) => lista.slice(0, 3).map((item) => item.produto || 'Produto').join(' · ');

  if (vencidos.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-estoque-vencido',
      tipo: 'estoque-vencido',
      prioridade: PRIORIDADE.CRITICO,
      origem: 'estoque',
      titulo: `${vencidos.length} ${pluralizar(vencidos.length, 'produto está', 'produtos estão')} vencido${vencidos.length > 1 ? 's' : ''} no estoque`,
      descricao: nomeDe(vencidos),
      acaoSugerida: 'Retirar ou descartar o produto vencido do estoque.',
      pageId: 'estoque',
      dataReferencia: dataMinima(vencidos.map((item) => item.data_validade)),
      // Estoque não é vinculado a lote — loteId/loteNome ficam null (Sprint 12).
    }));
  }
  if (proximos.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-estoque-validade-proxima',
      tipo: 'estoque-validade-proxima',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'estoque',
      titulo: `${proximos.length} ${pluralizar(proximos.length, 'produto está', 'produtos estão')} perto do vencimento no estoque`,
      descricao: nomeDe(proximos),
      acaoSugerida: 'Priorizar o uso do produto antes do vencimento.',
      pageId: 'estoque',
      dataReferencia: dataMinima(proximos.map((item) => item.data_validade)),
    }));
  }
  return alertas;
}

// Janela de "vencendo em breve" para carência — deliberadamente mais curta
// que a janela financeira de 7 dias (risco de segurança alimentar, não bug —
// ver docs/DECISAO_ALERTAS_CENTRAL_UNICA.md). Sprint 16: valor movido para
// janelasAlertas.js (mesmo número, só nomeado numa fonte única).
const CARENCIA_DIAS_VENCENDO = CARENCIA_CRITICA_DIAS;

/**
 * Carência de manejo sanitário ativa / vencendo em breve (Sprint 10) — lê
 * `sanitario.data_fim_carencia` (campo novo desta sprint). O detector de
 * "manejo sanitário vencido/vencendo" (`alertasInteligentes.js#detectarSanidadeProxima`,
 * que já olha `sanitario.proxima`) não muda — carência é um sinal
 * complementar, não substitui nem duplica aquele.
 */
function agruparCarenciaAtiva(db, hoje) {
  const registros = Array.isArray(db?.sanitario) ? db.sanitario : [];
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [Number(l.id), l]));
  const nomeLote = (loteId) => lotesMap.get(Number(loteId))?.nome || (loteId ? `Lote ${loteId}` : 'sem lote vinculado');

  // Guarda o registro inteiro (não só o nome) para poder derivar
  // dataReferencia/loteId/loteNome do grupo sem recalcular nada (Sprint 12).
  const vencendoEmBreve = [];
  const ativos = [];

  registros.forEach((item) => {
    if (!item?.data_fim_carencia) return;
    const fimCarencia = toDateKey(item.data_fim_carencia);
    if (!fimCarencia) return;
    const diasRestantes = daysBetween(hoje, fimCarencia);
    if (diasRestantes < 0) return; // carência já terminou — nada a avisar

    if (diasRestantes <= CARENCIA_DIAS_VENCENDO) {
      vencendoEmBreve.push(item);
    } else {
      ativos.push(item);
    }
  });

  const nomesDe = (lista) => lista.slice(0, 3).map((item) => nomeLote(item.lote_id)).join(' · ');
  const loteUnicoCarencia = (lista) => {
    if (lista.length !== 1) return { loteId: null, loteNome: null };
    const lote = lotesMap.get(Number(lista[0].lote_id));
    return { loteId: lote?.id ?? null, loteNome: lote?.nome ?? null };
  };

  const alertas = [];
  if (vencendoEmBreve.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-carencia-vencendo',
      tipo: 'carencia-vencendo',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'sanidade',
      titulo: `${vencendoEmBreve.length} ${pluralizar(vencendoEmBreve.length, 'lote termina', 'lotes terminam')} a carência em breve`,
      descricao: nomesDe(vencendoEmBreve),
      acaoSugerida: 'Confirmar o fim da carência antes de liberar a venda.',
      pageId: 'sanitario',
      dataReferencia: dataMinima(vencendoEmBreve.map((item) => item.data_fim_carencia)),
      ...loteUnicoCarencia(vencendoEmBreve),
    }));
  }
  if (ativos.length > 0) {
    alertas.push(criarAlerta({
      id: 'unificado-carencia-ativa',
      tipo: 'carencia-ativa',
      prioridade: PRIORIDADE.ATENCAO,
      origem: 'sanidade',
      titulo: `${ativos.length} ${pluralizar(ativos.length, 'lote está', 'lotes estão')} em período de carência`,
      descricao: nomesDe(ativos),
      acaoSugerida: 'Não vender ou abater até o fim da carência.',
      pageId: 'sanitario',
      dataReferencia: dataMinima(ativos.map((item) => item.data_fim_carencia)),
      ...loteUnicoCarencia(ativos),
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
  const lotesMap = new Map((Array.isArray(db?.lotes) ? db.lotes : []).map((l) => [Number(l.id), l]));
  const doDia = tarefas.filter((tarefa) => (
    String(tarefa?.status || '').toLowerCase() !== 'concluida'
    && String(tarefa?.status || '').toLowerCase() !== 'feita'
    && String(tarefa?.data_vencimento || '') === hoje
  ));
  if (doDia.length === 0) return [];

  const loteUnico = doDia.length === 1 && doDia[0]?.lote_id != null
    ? lotesMap.get(Number(doDia[0].lote_id))
    : null;

  return [criarAlerta({
    id: 'unificado-tarefas-hoje',
    tipo: 'tarefa-hoje',
    prioridade: PRIORIDADE.ATENCAO,
    origem: 'tarefas',
    titulo: `${doDia.length} ${pluralizar(doDia.length, 'tarefa é', 'tarefas são')} para hoje`,
    descricao: doDia.slice(0, 3).map((tarefa) => tarefa.titulo || 'Tarefa').join(' · '),
    acaoSugerida: 'Concluir as tarefas do dia.',
    pageId: 'tarefas',
    // `hoje` é o próprio `data_vencimento` da tarefa (é por isso que ela caiu
    // neste grupo) — não é um fallback inventado.
    dataReferencia: hoje,
    loteId: loteUnico?.id ?? null,
    loteNome: loteUnico?.nome ?? null,
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
    ...agruparSaidaLote(db, hoje),
    ...agruparEstoqueValidade(db, hoje),
    ...agruparCarenciaAtiva(db, hoje),
  ];

  return alertas.slice().sort((a, b) => {
    const ordemA = ORDEM_PRIORIDADE[a.prioridade] ?? 99;
    const ordemB = ORDEM_PRIORIDADE[b.prioridade] ?? 99;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return String(a.id).localeCompare(String(b.id));
  });
}
