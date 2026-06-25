import { toNumber, safeDivide, daysBetween } from './calcHelpers.js';
import { montarDadosDecisaoVenda } from './decisaoVenda.js';

export const LIMIAR_SANIDADE_EM_DIA_DIAS = 60;
export const LIMIAR_SANIDADE_ATENCAO_DIAS = 120;
export const PERIODO_OCORRENCIAS_RECENTES_DIAS = 90;
export const LIMIAR_CUSTO_SUPLEMENTO_PCT = 0.4;
export const DIAS_MINIMOS_AVALIAR_SUPLEMENTACAO = 30;

const TIPOS_SANITARIOS_CRITICOS = ['mortalidade', 'doenca', 'doença', 'enfermidade', 'descarte'];

export const STATUS_SANIDADE = {
  SEM_REGISTRO: 'sem_registro',
  EM_DIA: 'em_dia',
  ATENCAO: 'atencao',
  REVISAR_MANEJO: 'revisar_manejo',
};

const STATUS_SANIDADE_LABEL = {
  [STATUS_SANIDADE.SEM_REGISTRO]: 'Sem registro',
  [STATUS_SANIDADE.EM_DIA]: 'Em dia',
  [STATUS_SANIDADE.ATENCAO]: 'Atenção',
  [STATUS_SANIDADE.REVISAR_MANEJO]: 'Revisar manejo',
};

export const STATUS_SUPLEMENTACAO = {
  SEM_REGISTRO: 'sem_registro',
  DADOS_INSUFICIENTES: 'dados_insuficientes',
  CUSTO_ALTO: 'custo_alto',
  DESEMPENHO_POSITIVO: 'desempenho_positivo',
  ACOMPANHAR_GMD: 'acompanhar_gmd',
};

const STATUS_SUPLEMENTACAO_LABEL = {
  [STATUS_SUPLEMENTACAO.SEM_REGISTRO]: 'Sem registro de suplemento',
  [STATUS_SUPLEMENTACAO.DADOS_INSUFICIENTES]: 'Sem dados suficientes',
  [STATUS_SUPLEMENTACAO.CUSTO_ALTO]: 'Custo de suplemento elevado',
  [STATUS_SUPLEMENTACAO.DESEMPENHO_POSITIVO]: 'Suplementação com desempenho positivo',
  [STATUS_SUPLEMENTACAO.ACOMPANHAR_GMD]: 'Acompanhar GMD',
};

export const NIVEL_RISCO = { BAIXO: 'baixo', MEDIO: 'medio', ALTO: 'alto' };

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Leitura sanitária de um lote: última ocorrência, dias desde o último
 * manejo, ocorrências no período e status em 4 categorias. Não dá
 * recomendação veterinária (medicamento/dose/protocolo) — só sinaliza
 * recência e, quando existe, tipo de ocorrência que merece acompanhamento.
 */
export function analisarSanidadeLote({ registros = [], dataReferencia } = {}) {
  const hoje = dataReferencia || hojeIso();
  const lista = arr(registros)
    .filter((registro) => registro?.data_aplic)
    .slice()
    .sort((a, b) => String(b.data_aplic).localeCompare(String(a.data_aplic)));

  if (!lista.length) {
    return {
      status: STATUS_SANIDADE.SEM_REGISTRO,
      statusLabel: STATUS_SANIDADE_LABEL[STATUS_SANIDADE.SEM_REGISTRO],
      mensagem: 'Este lote está sem registro sanitário recente.',
      ultimaOcorrencia: null,
      diasDesdeUltimoManejo: null,
      totalOcorrenciasPeriodo: 0,
      tipoMaisRecente: null,
    };
  }

  const ultimaOcorrencia = lista[0];
  const diasDesdeUltimoManejo = daysBetween(ultimaOcorrencia.data_aplic, hoje);
  const totalOcorrenciasPeriodo = lista.filter(
    (registro) => daysBetween(registro.data_aplic, hoje) <= PERIODO_OCORRENCIAS_RECENTES_DIAS
  ).length;
  const tipoMaisRecente = ultimaOcorrencia.tipo || null;

  const temOcorrenciaCritica = lista.some(
    (registro) =>
      daysBetween(registro.data_aplic, hoje) <= PERIODO_OCORRENCIAS_RECENTES_DIAS &&
      TIPOS_SANITARIOS_CRITICOS.includes(String(registro.tipo || '').toLowerCase())
  );

  let status;
  let mensagem;
  if (temOcorrenciaCritica) {
    status = STATUS_SANIDADE.REVISAR_MANEJO;
    mensagem = 'Há ocorrências sanitárias que merecem acompanhamento.';
  } else if (diasDesdeUltimoManejo <= LIMIAR_SANIDADE_EM_DIA_DIAS) {
    status = STATUS_SANIDADE.EM_DIA;
    mensagem = 'Este lote possui registro sanitário recente.';
  } else if (diasDesdeUltimoManejo <= LIMIAR_SANIDADE_ATENCAO_DIAS) {
    status = STATUS_SANIDADE.ATENCAO;
    mensagem = 'Já faz um tempo desde o último manejo sanitário deste lote — vale conferir se está tudo em dia.';
  } else {
    status = STATUS_SANIDADE.REVISAR_MANEJO;
    mensagem = 'Este lote está há muito tempo sem registro sanitário — vale revisar o manejo.';
  }

  return { status, statusLabel: STATUS_SANIDADE_LABEL[status], mensagem, ultimaOcorrencia, diasDesdeUltimoManejo, totalOcorrenciasPeriodo, tipoMaisRecente };
}

export function calcularCustoSuplementacaoPorCabeca({ custoSuplementoTotal, qtdCabecas } = {}) {
  return safeDivide(custoSuplementoTotal, qtdCabecas);
}

export function calcularCustoSuplementacaoPorArroba({ custoSuplementoTotal, arrobas } = {}) {
  return safeDivide(custoSuplementoTotal, arrobas);
}

/**
 * Soma os registros de consumo de suplemento (`db.consumo_suplementacao`)
 * de um lote e calcula custo por cabeça/arroba. Não recalcula o custo do
 * lote como um todo — isso já existe em `calcularResultadoLote`
 * (calculos.js); aqui só isolamos a parte que é suplementação.
 */
export function analisarSuplementacaoLote({ registros = [], qtdCabecas, arrobas, dias } = {}) {
  const lista = arr(registros);
  const custoSuplementoTotal = lista.reduce((soma, registro) => soma + toNumber(registro?.custo_total), 0);
  const quantidadeTotal = lista.reduce(
    (soma, registro) => soma + toNumber(registro?.quantidade_total ?? registro?.qtd_total ?? registro?.quantidade),
    0
  );

  return {
    temRegistro: lista.length > 0,
    totalRegistros: lista.length,
    custoSuplementoTotal,
    quantidadeTotal,
    custoPorCabeca: calcularCustoSuplementacaoPorCabeca({ custoSuplementoTotal, qtdCabecas }),
    custoPorArroba: calcularCustoSuplementacaoPorArroba({ custoSuplementoTotal, arrobas }),
    dias: toNumber(dias),
  };
}

/**
 * Classifica a eficiência da suplementação em 5 categorias, comparando o
 * custo de suplemento por arroba com o custo por arroba TOTAL do lote
 * (já calculado na Sprint 32, `decisaoVenda.js`) e com o GMD realizado x
 * meta. Nunca afirma causalidade absoluta — fala em "indício"/"acompanhar".
 */
export function classificarEficienciaSuplementacao(dados = {}) {
  const custoSuplementoTotal = toNumber(dados.custoSuplementoTotal);

  if (custoSuplementoTotal <= 0) {
    return {
      status: STATUS_SUPLEMENTACAO.SEM_REGISTRO,
      statusLabel: STATUS_SUPLEMENTACAO_LABEL[STATUS_SUPLEMENTACAO.SEM_REGISTRO],
      mensagem: 'Não há registro de suplementação para este lote no período.',
    };
  }

  const semBaseSuficiente = toNumber(dados.dias) < DIAS_MINIMOS_AVALIAR_SUPLEMENTACAO || toNumber(dados.arrobas) <= 0;
  if (semBaseSuficiente) {
    return {
      status: STATUS_SUPLEMENTACAO.DADOS_INSUFICIENTES,
      statusLabel: STATUS_SUPLEMENTACAO_LABEL[STATUS_SUPLEMENTACAO.DADOS_INSUFICIENTES],
      mensagem: 'Ainda faltam pesagens suficientes para avaliar o efeito da suplementação.',
    };
  }

  const custoPorArrobaLote = toNumber(dados.custoPorArrobaLote);
  const proporcaoCustoArroba = custoPorArrobaLote > 0 ? toNumber(dados.custoPorArroba) / custoPorArrobaLote : 0;
  if (proporcaoCustoArroba >= LIMIAR_CUSTO_SUPLEMENTO_PCT) {
    return {
      status: STATUS_SUPLEMENTACAO.CUSTO_ALTO,
      statusLabel: STATUS_SUPLEMENTACAO_LABEL[STATUS_SUPLEMENTACAO.CUSTO_ALTO],
      mensagem: 'O custo de suplemento está pesando no custo por arroba deste lote.',
    };
  }

  const gmdMeta = toNumber(dados.gmdMeta);
  if (gmdMeta > 0 && toNumber(dados.gmdAtual) >= gmdMeta) {
    return {
      status: STATUS_SUPLEMENTACAO.DESEMPENHO_POSITIVO,
      statusLabel: STATUS_SUPLEMENTACAO_LABEL[STATUS_SUPLEMENTACAO.DESEMPENHO_POSITIVO],
      mensagem: 'O lote possui custo de suplementação registrado e o GMD está dentro ou acima da meta — indício de que o suplemento está acompanhando o desempenho.',
    };
  }

  return {
    status: STATUS_SUPLEMENTACAO.ACOMPANHAR_GMD,
    statusLabel: STATUS_SUPLEMENTACAO_LABEL[STATUS_SUPLEMENTACAO.ACOMPANHAR_GMD],
    mensagem: 'O lote possui custo de suplementação registrado. Acompanhe se o GMD está compensando esse custo.',
  };
}

/** Sinal simples (não causal) entre custo de suplementação e GMD realizado x meta. */
export function relacionarSuplementoEGmd({ custoSuplementoTotal, gmdAtual, gmdMeta, dias } = {}) {
  const temSuplemento = toNumber(custoSuplementoTotal) > 0;
  const temGmd = toNumber(dias) >= DIAS_MINIMOS_AVALIAR_SUPLEMENTACAO && toNumber(gmdAtual) > 0;

  if (!temSuplemento || !temGmd) {
    return { sinal: 'sem_dados', mensagem: 'Ainda faltam dados de pesagem para relacionar suplementação e ganho de peso.' };
  }

  const meta = toNumber(gmdMeta);
  if (meta > 0 && toNumber(gmdAtual) >= meta) {
    return { sinal: 'indicio_positivo', mensagem: 'Acompanhe se o ganho de peso permanece acima da meta.' };
  }

  return {
    sinal: 'indicio_atencao',
    mensagem: 'O ganho de peso está abaixo da meta apesar do custo de suplementação — compare e avalie o que pode estar pesando no desempenho.',
  };
}

/** Risco operacional simples, combinando status sanitário e GMD x meta — não é diagnóstico veterinário. */
export function classificarRiscoSanitario({ statusSanidade, gmdAtual, gmdMeta } = {}) {
  if (statusSanidade === STATUS_SANIDADE.REVISAR_MANEJO) {
    return {
      nivel: NIVEL_RISCO.ALTO,
      mensagem: 'Há sinais sanitários que podem afetar o desempenho deste lote — vale revisar antes de decidir os próximos passos.',
    };
  }
  if (statusSanidade === STATUS_SANIDADE.ATENCAO || statusSanidade === STATUS_SANIDADE.SEM_REGISTRO) {
    return {
      nivel: NIVEL_RISCO.MEDIO,
      mensagem: 'Não há informação sanitária recente suficiente para descartar risco operacional.',
    };
  }

  const meta = toNumber(gmdMeta);
  if (meta > 0 && toNumber(gmdAtual) < meta * 0.9) {
    return {
      nivel: NIVEL_RISCO.MEDIO,
      mensagem: 'O ganho de peso abaixo da meta pode indicar risco operacional — vale investigar a causa.',
    };
  }

  return { nivel: NIVEL_RISCO.BAIXO, mensagem: 'Nenhum sinal de risco operacional identificado com os dados disponíveis.' };
}

/** Lista de mensagens (1 a 4 linhas) combinando sanidade, suplementação, GMD e risco — para relatório/WhatsApp. */
export function gerarInsightsManejoResultado({ sanidade, suplementacao, relacaoGmd, risco } = {}) {
  const insights = [];
  if (sanidade?.mensagem) insights.push(sanidade.mensagem);
  if (suplementacao?.mensagem) insights.push(suplementacao.mensagem);
  if (relacaoGmd?.mensagem) insights.push(relacaoGmd.mensagem);
  if (risco?.nivel === NIVEL_RISCO.ALTO || risco?.nivel === NIVEL_RISCO.MEDIO) {
    insights.push(risco.mensagem);
  }
  return insights;
}

/**
 * Sinais complementares para a Decisão de Venda (Sprint 32) — não muda a
 * classificação original (`classificarDecisaoVenda`), só acrescenta avisos
 * quando há custo de suplemento alto ou manejo sanitário recente a revisar.
 */
export function gerarSinaisComplementaresVenda(dadosManejo = {}) {
  const sinais = [];
  if (dadosManejo?.suplementacao?.status === STATUS_SUPLEMENTACAO.CUSTO_ALTO) {
    sinais.push('Atenção: custo de suplementação elevado pode estar afetando o custo por arroba.');
  }
  if (dadosManejo?.sanidade?.status === STATUS_SANIDADE.REVISAR_MANEJO) {
    sinais.push('Atenção: há manejo recente que merece acompanhamento antes da venda.');
  }
  return sinais;
}

/**
 * Monta a leitura integrada de manejo/sanidade/suplementação de um lote, a
 * partir de `db.sanitario`, `db.consumo_suplementacao` e dos dados de
 * decisão de venda já calculados (`montarDadosDecisaoVenda`, Sprint 32) —
 * não recalcula GMD, arrobas, custo ou lucro do lote.
 */
export function montarDadosManejoResultado(db, loteId) {
  const dadosVenda = montarDadosDecisaoVenda(db, loteId);

  if (!dadosVenda.encontrado) {
    return {
      encontrado: false,
      sanidade: analisarSanidadeLote({ registros: [] }),
      suplementacao: null,
      relacaoGmd: null,
      risco: null,
      insights: [],
    };
  }

  const registrosSanitario = arr(db?.sanitario).filter((registro) => toNumber(registro?.lote_id) === toNumber(loteId));
  const registrosSuplemento = arr(db?.consumo_suplementacao).filter(
    (registro) => toNumber(registro?.lote_id) === toNumber(loteId)
  );

  const sanidade = analisarSanidadeLote({ registros: registrosSanitario });
  const analiseSuplemento = analisarSuplementacaoLote({
    registros: registrosSuplemento,
    qtdCabecas: dadosVenda.qtdCabecas,
    arrobas: dadosVenda.arrobas,
    dias: dadosVenda.dias,
  });
  const classificacaoSuplemento = classificarEficienciaSuplementacao({
    custoSuplementoTotal: analiseSuplemento.custoSuplementoTotal,
    custoPorArroba: analiseSuplemento.custoPorArroba,
    custoPorArrobaLote: dadosVenda.custoPorArroba,
    gmdAtual: dadosVenda.gmdAtual,
    gmdMeta: dadosVenda.gmdMeta,
    dias: dadosVenda.dias,
    arrobas: dadosVenda.arrobas,
  });
  const suplementacao = { ...analiseSuplemento, ...classificacaoSuplemento };

  const relacaoGmd = relacionarSuplementoEGmd({
    custoSuplementoTotal: analiseSuplemento.custoSuplementoTotal,
    gmdAtual: dadosVenda.gmdAtual,
    gmdMeta: dadosVenda.gmdMeta,
    dias: dadosVenda.dias,
  });
  const risco = classificarRiscoSanitario({
    statusSanidade: sanidade.status,
    gmdAtual: dadosVenda.gmdAtual,
    gmdMeta: dadosVenda.gmdMeta,
  });
  const insights = gerarInsightsManejoResultado({ sanidade, suplementacao, relacaoGmd, risco });

  return { encontrado: true, sanidade, suplementacao, relacaoGmd, risco, insights };
}
