// Assistente HERDON baseado em regras (Sprint 5).
//
// Não é IA: são funções puras que reaproveitam o que os motores anteriores já
// calculam (alertasInteligentes.js, insightsFazenda.js, saudeLote.js,
// relatorioLote.js) e traduzem o resultado em uma resposta curta, prática e
// com evidência. Nenhum limiar/severidade é recalculado aqui — só composição
// e texto em português a partir de dados já existentes.
//
// Regra de ouro: nunca inventar dado. Quando falta informação para responder
// com segurança, a resposta diz exatamente o que falta cadastrar em vez de
// chutar um número ou um lote.
import { toNumber, daysBetween, toDateKey } from './calcHelpers.js';
import {
  SEVERIDADE,
  gerarAlertasPriorizados,
  detectarEstoqueBaixo,
} from './alertasInteligentes.js';
import { construirInsightsFazenda, listarAtencaoImediata } from './insightsFazenda.js';
import { listarSaudeLotes } from './saudeLote.js';
import { gerarResumoRelatorioLote } from './relatorioLote.js';
import { formatCurrency } from '../utils/calculations.js';

const SEVERIDADE_ORDEM = {
  [SEVERIDADE.CRITICO]: 0,
  [SEVERIDADE.ALTO]: 1,
  [SEVERIDADE.MEDIO]: 2,
  [SEVERIDADE.BAIXO]: 3,
};

const SEVERIDADE_POR_CLASSIFICACAO_SAUDE = {
  critico: SEVERIDADE.CRITICO,
  risco: SEVERIDADE.ALTO,
  atencao: SEVERIDADE.MEDIO,
  saudavel: SEVERIDADE.BAIXO,
};

// Frase curta por fator de saúde negativo — só rótulo de apresentação sobre o
// que `calcularSaudeLote` (saudeLote.js) já decidiu. Não é um novo cálculo.
const FRASE_CURTA_POR_FATOR = {
  gmd: 'GMD abaixo da meta',
  pesagem: 'sem pesagem recente',
  tarefas: 'com tarefa atrasada',
  sanidade: 'com sanidade pendente',
  estoque: 'com estoque vinculado em risco',
  custo: 'com custo acima do esperado',
  mortalidade: 'com perdas registradas',
};

const PERGUNTAS = [
  {
    id: 'lote_pior_desempenho',
    titulo: 'Qual lote está performando pior?',
    categoria: 'lotes',
    descricao: 'Cruza saúde do lote, GMD, alertas e tarefas/sanidade para apontar o lote que mais precisa de atenção.',
  },
  {
    id: 'lote_prioritario',
    titulo: 'Qual lote devo priorizar?',
    categoria: 'lotes',
    descricao: 'Usa os alertas críticos/altos e o score de saúde para dizer qual lote resolver primeiro.',
  },
  {
    id: 'custo_mais_pesado',
    titulo: 'O que mais aumentou meu custo?',
    categoria: 'financeiro',
    descricao: 'Compara as despesas recentes com o período anterior e aponta a categoria que mais pesou.',
  },
  {
    id: 'vale_a_pena_lote',
    titulo: 'Esse lote está valendo a pena?',
    categoria: 'lotes',
    descricao: 'Usa custo, GMD e a decisão de venda já calculada do lote para responder se compensa manter ou vender.',
  },
  {
    id: 'proxima_pesagem',
    titulo: 'Quando devo pesar de novo?',
    categoria: 'lotes',
    descricao: 'Verifica a frequência de pesagem dos lotes ativos e aponta quem está sem pesagem recente.',
  },
  {
    id: 'produto_acabando',
    titulo: 'Qual produto está acabando?',
    categoria: 'estoque',
    descricao: 'Usa o consumo recente do estoque para prever o que está prestes a esgotar.',
  },
  {
    id: 'atencao_hoje',
    titulo: 'O que precisa da minha atenção hoje?',
    categoria: 'geral',
    descricao: 'Lista os alertas priorizados (crítico e alto) do dia, em ordem de urgência.',
  },
  {
    id: 'sanidade_pendente',
    titulo: 'Tenho manejo sanitário próximo ou atrasado?',
    categoria: 'sanidade',
    descricao: 'Verifica manejos sanitários vencidos ou dentro da janela de aviso.',
  },
];

const TITULO_POR_PERGUNTA = PERGUNTAS.reduce((acc, p) => {
  acc[p.id] = p.titulo;
  return acc;
}, {});

const PERGUNTAS_QUE_PRECISAM_DE_LOTE = new Set([
  'lote_pior_desempenho',
  'lote_prioritario',
  'vale_a_pena_lote',
  'proxima_pesagem',
]);

/**
 * Lista as perguntas prontas do assistente. Perguntas sobre lote só aparecem
 * quando já existe pelo menos um lote cadastrado — perguntar "qual lote está
 * pior" sem nenhum lote não tem resposta possível.
 */
export function listarPerguntasAssistente(db = {}) {
  const temLote = Array.isArray(db?.lotes) && db.lotes.length > 0;
  return PERGUNTAS
    .filter((pergunta) => temLote || !PERGUNTAS_QUE_PRECISAM_DE_LOTE.has(pergunta.id))
    .map(({ id, titulo, categoria, descricao }) => ({ id, titulo, categoria, descricao }));
}

/**
 * Diagnóstico de prontidão de dados do assistente, usado pela tela para
 * decidir entre mostrar as perguntas ou orientar o cadastro inicial.
 */
export function avaliarProntidaoAssistente(db = {}) {
  const temFazenda = Array.isArray(db?.fazendas) && db.fazendas.length > 0;
  const temLote = Array.isArray(db?.lotes) && db.lotes.length > 0;
  const temPesagem = Array.isArray(db?.pesagens) && db.pesagens.length > 0;
  const temEstoque = Array.isArray(db?.estoque) && db.estoque.length > 0;
  const temCusto = Array.isArray(db?.movimentacoes_financeiras) && db.movimentacoes_financeiras.length > 0;

  return {
    pronto: temFazenda && temLote,
    pendencias: [
      { chave: 'fazenda', label: 'Cadastre uma fazenda', pagina: 'fazendas', feito: temFazenda },
      { chave: 'lote', label: 'Cadastre lotes', pagina: 'lotes', feito: temLote },
      { chave: 'pesagem', label: 'Lance uma pesagem', pagina: 'pesagens', feito: temPesagem },
      { chave: 'estoque', label: 'Cadastre estoque', pagina: 'estoque', feito: temEstoque },
      { chave: 'custo', label: 'Lance custos', pagina: 'financeiro', feito: temCusto },
    ],
  };
}

function montarResposta({
  perguntaId,
  resposta,
  severidade = null,
  dadosInsuficientes = false,
  evidencias = [],
  acoesSugeridas = [],
  links = [],
}) {
  return {
    perguntaId,
    titulo: TITULO_POR_PERGUNTA[perguntaId] || perguntaId,
    resposta,
    severidade,
    dadosInsuficientes,
    evidencias,
    acoesSugeridas,
    links,
  };
}

function respostaSemDados(perguntaId, resposta, links = []) {
  return montarResposta({ perguntaId, resposta, dadosInsuficientes: true, links });
}

function juntarComE(itens) {
  const lista = itens.filter(Boolean);
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

/** 1. Qual lote está performando pior — score de saúde do lote (pior primeiro). */
function responderLotePiorDesempenho(db, agora) {
  const ranking = listarSaudeLotes(db, agora).filter((l) => l.encontrado);
  const comDados = ranking.filter((l) => !l.dadosInsuficientes);

  if (ranking.length === 0) {
    return respostaSemDados(
      'lote_pior_desempenho',
      'Ainda não há lotes ativos cadastrados. Cadastre um lote para o HERDON comparar o desempenho.',
      [{ label: 'Ver lotes', page: 'lotes' }]
    );
  }

  if (comDados.length === 0) {
    return respostaSemDados(
      'lote_pior_desempenho',
      'Ainda não há pesagens suficientes para responder com segurança. Cadastre pelo menos uma pesagem do lote para o HERDON calcular o desempenho.',
      [{ label: 'Registrar pesagem', page: 'pesagens', intent: { action: 'novo' } }, { label: 'Ver lotes', page: 'lotes' }]
    );
  }

  const pior = comDados[0];
  const resumo = gerarResumoRelatorioLote(db, pior.loteId, { agora });
  const problemas = pior.fatores.filter((f) => f.disponivel && f.pontos < 0).map((f) => FRASE_CURTA_POR_FATOR[f.chave] || f.label);
  const acaoPrincipal = resumo.decisoes?.[0] || 'Continuar acompanhando o lote de perto';

  const resposta = `O ${pior.nome} merece atenção primeiro. Ele está com saúde ${pior.score}/100`
    + (problemas.length ? `, ${juntarComE(problemas)}` : '')
    + `. Ação sugerida: ${acaoPrincipal}.`;

  return montarResposta({
    perguntaId: 'lote_pior_desempenho',
    resposta,
    severidade: SEVERIDADE_POR_CLASSIFICACAO_SAUDE[pior.classificacao] || SEVERIDADE.MEDIO,
    evidencias: pior.explicacoes,
    acoesSugeridas: resumo.decisoes || [],
    links: [
      { label: 'Ver relatório do lote', page: 'relatorioLote' },
      { label: 'Ver decisões da fazenda', page: 'decisoesFazenda' },
    ],
  });
}

/** 2. Qual lote devo priorizar — alertas críticos/altos vinculados a um lote. */
function responderLotePrioritario(db, agora) {
  const alertasLote = gerarAlertasPriorizados(db, agora)
    .filter((a) => a.entidade?.tipo === 'lote' && a.tipo !== 'peso_alvo');

  if (alertasLote.length > 0) {
    const principal = alertasLote[0];
    const loteId = principal.entidade.id;
    const doMesmoLote = alertasLote.filter((a) => toNumber(a.entidade.id) === toNumber(loteId));

    const resposta = `O ${principal.entidade.nome} deve ser priorizado agora. ${principal.descricao} Ação sugerida: ${principal.acaoSugerida}`
      + (doMesmoLote.length > 1 ? ` Há também outros ${doMesmoLote.length - 1} ponto(s) de atenção neste lote.` : '');

    return montarResposta({
      perguntaId: 'lote_prioritario',
      resposta,
      severidade: principal.severidade,
      evidencias: doMesmoLote.map((a) => a.descricao),
      acoesSugeridas: [...new Set(doMesmoLote.map((a) => a.acaoSugerida))],
      links: [
        { label: 'Abrir tela relacionada', page: principal.pagina },
        { label: 'Ver decisões da fazenda', page: 'decisoesFazenda' },
      ],
    });
  }

  const ranking = listarSaudeLotes(db, agora).filter((l) => l.encontrado && !l.dadosInsuficientes);
  if (ranking.length === 0) {
    return respostaSemDados(
      'lote_prioritario',
      'Ainda não há dados suficientes de lotes para indicar uma prioridade. Cadastre pesagens, tarefas ou sanidade vinculadas aos lotes.',
      [{ label: 'Ver lotes', page: 'lotes' }]
    );
  }

  const pior = ranking[0];
  if (pior.classificacao === 'saudavel') {
    return montarResposta({
      perguntaId: 'lote_prioritario',
      resposta: 'Nenhum lote precisa de atenção urgente agora — todos estão com saúde boa. Continue com o acompanhamento de rotina.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver decisões da fazenda', page: 'decisoesFazenda' }],
    });
  }

  const problemas = pior.fatores.filter((f) => f.disponivel && f.pontos < 0).map((f) => FRASE_CURTA_POR_FATOR[f.chave] || f.label);
  return montarResposta({
    perguntaId: 'lote_prioritario',
    resposta: `O ${pior.nome} deve ser priorizado agora. Está com saúde ${pior.score}/100${problemas.length ? `, ${juntarComE(problemas)}` : ''}.`,
    severidade: SEVERIDADE_POR_CLASSIFICACAO_SAUDE[pior.classificacao] || SEVERIDADE.MEDIO,
    evidencias: pior.explicacoes,
    links: [{ label: 'Ver relatório do lote', page: 'relatorioLote' }, { label: 'Ver decisões da fazenda', page: 'decisoesFazenda' }],
  });
}

function hojeISO(agora) {
  return toDateKey(agora) || new Date().toISOString().slice(0, 10);
}

/** Maior categoria de despesa nos últimos `dias` — descreve, não altera o alerta de custo. */
function categoriaComMaiorDespesa(db, agora, dias = 30) {
  const hoje = hojeISO(agora);
  const despesas = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const porCategoria = new Map();

  despesas.forEach((mov) => {
    if (mov?.tipo !== 'despesa') return;
    const diasAtras = daysBetween(mov?.data_competencia || mov?.data, hoje);
    if (diasAtras < 0 || diasAtras >= dias) return;
    const categoria = mov.categoria || 'Sem categoria';
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + toNumber(mov.valor));
  });

  let melhorCategoria = null;
  let melhorValor = 0;
  porCategoria.forEach((valor, categoria) => {
    if (valor > melhorValor) {
      melhorValor = valor;
      melhorCategoria = categoria;
    }
  });

  return melhorCategoria ? { categoria: melhorCategoria, valor: melhorValor } : null;
}

/** 3. O que mais aumentou meu custo — alerta de custo + maior categoria de despesa. */
function responderCustoMaisPesado(db, agora) {
  const despesas = (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [])
    .filter((m) => m?.tipo === 'despesa');

  if (despesas.length === 0) {
    return respostaSemDados(
      'custo_mais_pesado',
      'Ainda não há despesas registradas para analisar custos. Cadastre as movimentações financeiras da fazenda.',
      [{ label: 'Ver financeiro', page: 'financeiro', intent: { action: 'novo' } }]
    );
  }

  const alertaCusto = gerarAlertasPriorizados(db, agora).find((a) => a.tipo === 'custo');
  if (!alertaCusto) {
    return montarResposta({
      perguntaId: 'custo_mais_pesado',
      resposta: 'Os custos da fazenda estão dentro do esperado nos últimos 30 dias, sem alta relevante em relação ao período anterior.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver financeiro', page: 'financeiro' }],
    });
  }

  const destaque = categoriaComMaiorDespesa(db, agora);
  const resposta = `${alertaCusto.titulo}. ${alertaCusto.descricao}`
    + (destaque ? ` A categoria que mais pesou nos últimos 30 dias foi ${destaque.categoria}, com ${formatCurrency(destaque.valor)}.` : '')
    + ` Ação sugerida: ${alertaCusto.acaoSugerida}`;

  return montarResposta({
    perguntaId: 'custo_mais_pesado',
    resposta,
    severidade: alertaCusto.severidade,
    evidencias: destaque ? [`Categoria com maior despesa: ${destaque.categoria} (${formatCurrency(destaque.valor)})`] : [],
    acoesSugeridas: [alertaCusto.acaoSugerida],
    links: [{ label: 'Ver financeiro', page: 'financeiro' }],
  });
}

/** 4. Esse lote está valendo a pena — reaproveita o relatório completo do lote. */
function responderValeAPenaLote(db, agora, options = {}) {
  const lotesAtivos = (Array.isArray(db?.lotes) ? db.lotes : []).filter((l) => l?.status === 'ativo');
  const loteId = options.loteId ?? lotesAtivos[0]?.id ?? null;

  if (loteId == null) {
    return respostaSemDados(
      'vale_a_pena_lote',
      'Cadastre um lote para o HERDON avaliar se vale a pena mantê-lo ou vendê-lo.',
      [{ label: 'Ver lotes', page: 'lotes' }]
    );
  }

  const resumo = gerarResumoRelatorioLote(db, loteId, { agora });
  if (!resumo.encontrado) {
    return respostaSemDados('vale_a_pena_lote', 'Lote não encontrado. Selecione outro lote.', [{ label: 'Ver lotes', page: 'lotes' }]);
  }

  if (resumo.dadosInsuficientes) {
    return respostaSemDados(
      'vale_a_pena_lote',
      resumo.mensagemDadosInsuficientes || 'Ainda não há dados suficientes de custo e preço para avaliar se este lote está valendo a pena.',
      [{ label: 'Ver relatório do lote', page: 'relatorioLote' }]
    );
  }

  const nome = resumo.lote?.nome || `Lote ${loteId}`;
  const statusLabel = resumo.decisaoVenda?.statusLabel;
  let resposta = `${statusLabel ? `${nome}: ${statusLabel}.` : `Avaliação do ${nome}:`} ${resumo.decisaoVenda?.mensagem || ''}`.trim();
  if (resumo.lucroEstimado != null) {
    resposta += ` Se vendido hoje, o lucro estimado é de ${formatCurrency(resumo.lucroEstimado)}.`;
  } else {
    resposta += ' Ainda não há preço de venda suficiente para estimar o lucro se vendido hoje.';
  }

  return montarResposta({
    perguntaId: 'vale_a_pena_lote',
    resposta,
    severidade: SEVERIDADE_POR_CLASSIFICACAO_SAUDE[resumo.saudeLote?.classificacao] || null,
    dadosInsuficientes: resumo.receitaIndisponivel,
    evidencias: [
      resumo.custoPorArroba != null ? `Custo por arroba: ${formatCurrency(resumo.custoPorArroba)}` : null,
      resumo.gmd != null ? `GMD atual: ${resumo.gmd.toFixed(2)} kg/dia` : null,
    ].filter(Boolean),
    acoesSugeridas: resumo.decisoes || [],
    links: [{ label: 'Ver relatório do lote', page: 'relatorioLote' }],
  });
}

/** 5. Quando devo pesar de novo — frequência de pesagem (fator já calculado em saudeLote.js). */
function responderProximaPesagem(db, agora) {
  const ranking = listarSaudeLotes(db, agora).filter((l) => l.encontrado);
  if (ranking.length === 0) {
    return respostaSemDados(
      'proxima_pesagem',
      'Cadastre um lote para o HERDON acompanhar a frequência de pesagem.',
      [{ label: 'Ver lotes', page: 'lotes' }]
    );
  }

  const semPesagemRecente = ranking.filter((l) => !l.dadosInsuficientes
    && l.fatores.some((f) => f.chave === 'pesagem' && f.disponivel && f.pontos < 0));

  if (semPesagemRecente.length === 0) {
    return montarResposta({
      perguntaId: 'proxima_pesagem',
      resposta: 'Todos os lotes ativos têm pesagem recente registrada. Continue com a frequência atual de pesagens.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver pesagens', page: 'pesagens' }],
    });
  }

  const pior = semPesagemRecente[0];
  const resposta = `O ${pior.nome} está sem pesagem recente. Recomendo agendar uma nova pesagem para atualizar o GMD e melhorar as decisões.`
    + (semPesagemRecente.length > 1 ? ` Outros ${semPesagemRecente.length - 1} lote(s) também estão sem pesagem recente.` : '');

  return montarResposta({
    perguntaId: 'proxima_pesagem',
    resposta,
    severidade: SEVERIDADE.MEDIO,
    evidencias: semPesagemRecente.map((l) => l.nome),
    acoesSugeridas: ['Registrar nova pesagem'],
    links: [{ label: 'Registrar pesagem', page: 'pesagens', intent: { action: 'novo' } }, { label: 'Ver lotes', page: 'lotes' }],
  });
}

/** 6. Qual produto está acabando — detectarEstoqueBaixo, priorizado por severidade. */
function responderProdutoAcabando(db, agora) {
  const itens = Array.isArray(db?.estoque) ? db.estoque : [];
  if (itens.length === 0) {
    return respostaSemDados(
      'produto_acabando',
      'Cadastre os itens de estoque da fazenda para o HERDON acompanhar o consumo e avisar quando algo estiver acabando.',
      [{ label: 'Ver estoque', page: 'estoque', intent: { action: 'novo' } }]
    );
  }

  const alertasEstoque = detectarEstoqueBaixo(db, agora);
  if (alertasEstoque.length === 0) {
    return montarResposta({
      perguntaId: 'produto_acabando',
      resposta: 'Nenhum produto do estoque está em risco de acabar no momento.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver estoque', page: 'estoque' }],
    });
  }

  const principal = alertasEstoque
    .slice()
    .sort((a, b) => (SEVERIDADE_ORDEM[a.severidade] ?? 99) - (SEVERIDADE_ORDEM[b.severidade] ?? 99))[0];

  const resposta = `O ${principal.entidade.nome} merece atenção. ${principal.descricao} Ação sugerida: ${principal.acaoSugerida}`;

  return montarResposta({
    perguntaId: 'produto_acabando',
    resposta,
    severidade: principal.severidade,
    evidencias: alertasEstoque.map((a) => a.titulo),
    acoesSugeridas: [...new Set(alertasEstoque.map((a) => a.acaoSugerida))],
    links: [{ label: 'Ver estoque', page: 'estoque' }, { label: 'Registrar entrada de estoque', page: 'estoque', intent: { action: 'novo' } }],
  });
}

const LABEL_PAGINA = {
  resultados: 'resultados',
  estoque: 'estoque',
  sanitario: 'sanidade',
  tarefas: 'tarefas',
  financeiro: 'financeiro',
};

/** 7. O que precisa da minha atenção hoje — insights/alertas priorizados da fazenda. */
function responderAtencaoHoje(db, agora) {
  const insights = construirInsightsFazenda(db, agora);
  const lista = listarAtencaoImediata(insights.alertas, 5);

  if (insights.totalAlertas === 0) {
    return montarResposta({
      perguntaId: 'atencao_hoje',
      resposta: 'Nenhum alerta pendente. A operação está sob controle hoje.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver decisões da fazenda', page: 'decisoesFazenda' }],
    });
  }

  if (lista.length === 0) {
    return montarResposta({
      perguntaId: 'atencao_hoje',
      resposta: 'Não há pontos críticos ou de alta prioridade hoje, mas existem alertas de menor prioridade para acompanhar de perto.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver decisões da fazenda', page: 'decisoesFazenda' }],
    });
  }

  const principal = lista[0];
  const resposta = `Hoje o HERDON encontrou ${lista.length} ponto${lista.length === 1 ? '' : 's'} que ${lista.length === 1 ? 'merece' : 'merecem'} atenção. O mais urgente: ${principal.titulo}. ${principal.descricao} Ação sugerida: ${principal.acaoSugerida}`;

  const paginasUnicas = [...new Set(lista.map((a) => a.pagina))].slice(0, 3);

  return montarResposta({
    perguntaId: 'atencao_hoje',
    resposta,
    severidade: principal.severidade,
    evidencias: lista.map((a) => `${a.titulo} — ${a.descricao}`),
    acoesSugeridas: [...new Set(lista.map((a) => a.acaoSugerida))],
    links: paginasUnicas.map((pagina) => ({ label: `Ver ${LABEL_PAGINA[pagina] || pagina}`, page: pagina })),
  });
}

/** 8. Sanidade próxima ou atrasada — detectarSanidadeProxima via motor de alertas. */
function responderSanidadePendente(db, agora) {
  const registros = Array.isArray(db?.sanitario) ? db.sanitario : [];
  if (registros.length === 0) {
    return respostaSemDados(
      'sanidade_pendente',
      'Cadastre os manejos sanitários da fazenda (vacinas, vermifugação, etc.) para o HERDON avisar quando estiverem próximos ou atrasados.',
      [{ label: 'Ver sanidade', page: 'sanitario', intent: { action: 'novo' } }]
    );
  }

  const alertasSanidade = gerarAlertasPriorizados(db, agora).filter((a) => a.tipo === 'sanidade');
  if (alertasSanidade.length === 0) {
    return montarResposta({
      perguntaId: 'sanidade_pendente',
      resposta: 'Nenhum manejo sanitário está próximo ou atrasado no momento.',
      severidade: SEVERIDADE.BAIXO,
      links: [{ label: 'Ver sanidade', page: 'sanitario' }],
    });
  }

  const principal = alertasSanidade[0];
  const resposta = `${principal.titulo}. ${principal.descricao} Ação sugerida: ${principal.acaoSugerida}`
    + (alertasSanidade.length > 1 ? ` Há também outros ${alertasSanidade.length - 1} manejo(s) pendente(s).` : '');

  return montarResposta({
    perguntaId: 'sanidade_pendente',
    resposta,
    severidade: principal.severidade,
    evidencias: alertasSanidade.map((a) => a.titulo),
    acoesSugeridas: [...new Set(alertasSanidade.map((a) => a.acaoSugerida))],
    links: [{ label: 'Ver sanidade', page: 'sanitario' }, { label: 'Registrar manejo sanitário', page: 'sanitario', intent: { action: 'novo' } }],
  });
}

const HANDLERS = {
  lote_pior_desempenho: responderLotePiorDesempenho,
  lote_prioritario: responderLotePrioritario,
  custo_mais_pesado: responderCustoMaisPesado,
  vale_a_pena_lote: responderValeAPenaLote,
  proxima_pesagem: responderProximaPesagem,
  produto_acabando: responderProdutoAcabando,
  atencao_hoje: responderAtencaoHoje,
  sanidade_pendente: responderSanidadePendente,
};

/**
 * Responde uma pergunta pronta do Assistente HERDON. Nunca inventa dado: se
 * faltar informação, `dadosInsuficientes` vem `true` e `resposta` explica o
 * que cadastrar. `options.loteId` é usado apenas por `vale_a_pena_lote`.
 */
export function responderPerguntaHerdon(db = {}, perguntaId, options = {}) {
  const agora = options.agora || new Date();
  const handler = HANDLERS[perguntaId];
  if (!handler) {
    return montarResposta({
      perguntaId,
      resposta: 'Pergunta não reconhecida pelo assistente.',
      dadosInsuficientes: true,
    });
  }
  return handler(db, agora, options);
}
