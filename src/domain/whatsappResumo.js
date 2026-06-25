import { formatCurrency, formatDate, formatNumber } from '../utils/calculations.js';

function linha(rotulo, valor) {
  return `${rotulo}: ${valor}`;
}

function minusculaInicial(texto) {
  if (!texto) return texto;
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

/** Linha compacta de manejo/sanidade/suplementação para o resumo do lote (Sprint 33). */
function linhaManejoResultado(manejo) {
  if (!manejo?.encontrado) {
    return 'Manejo: sem registros suficientes.';
  }

  const temSanidade = manejo.sanidade?.status && manejo.sanidade.status !== 'sem_registro';
  const temSuplemento = Boolean(manejo.suplementacao?.temRegistro);

  if (!temSanidade && !temSuplemento) {
    return 'Manejo: sem registros suficientes.';
  }

  const partes = [];
  if (temSanidade) partes.push(`Sanidade ${minusculaInicial(manejo.sanidade.statusLabel)}`);
  if (temSuplemento) partes.push(`Suplemento: ${formatCurrency(manejo.suplementacao.custoPorCabeca)}/cab`);
  if (manejo.insights?.[0]) partes.push(`Insight: ${manejo.insights[0]}`);

  return `Manejo: ${partes.join(' · ')}`;
}

export function gerarResumoLoteTexto(relatorio) {
  if (!relatorio?.encontrado) {
    return 'HERDON — Resumo do Lote\n\nLote não encontrado.';
  }

  const { lote, totalAnimais, pesoAtualMedio, gmdMedio, lucroTotal, situacao, fazendaNome, custoPorArroba, lucroPorArroba, decisaoVenda } = relatorio;

  const linhas = [
    'HERDON — Resumo do Lote',
    '',
    linha('Lote', lote?.nome || '—'),
    linha('Fazenda', fazendaNome || '—'),
    linha('Cabeças', formatNumber(totalAnimais, 0)),
    linha('Peso médio atual', `${formatNumber(pesoAtualMedio, 1)} kg`),
    linha('GMD', `${formatNumber(gmdMedio, 2)} kg/dia`),
    linha('Resultado estimado', formatCurrency(lucroTotal)),
    linha('Status', situacao),
  ];

  if (decisaoVenda) {
    linhas.push(`Custo/@: ${formatCurrency(custoPorArroba)} · Lucro/@: ${formatCurrency(lucroPorArroba)} · Status: ${decisaoVenda.statusLabel}`);
  }

  if (relatorio.manejoResultado !== undefined) {
    linhas.push(linhaManejoResultado(relatorio.manejoResultado));
  }

  return linhas.join('\n');
}

export function gerarResumoPesagensTexto(linhas, { loteNome } = {}) {
  if (!linhas?.length) {
    return 'HERDON — Resumo de Pesagens\n\nAinda não há pesagens para este período.';
  }

  const ultima = linhas[0];
  const cabecalho = ['HERDON — Resumo de Pesagens', ''];
  if (loteNome) cabecalho.push(linha('Lote', loteNome));

  return [
    ...cabecalho,
    linha('Última pesagem', formatDate(ultima.data)),
    linha('Peso médio', `${formatNumber(ultima.pesoMedio, 1)} kg`),
    ultima.gmdEntrePesagens != null ? linha('GMD entre pesagens', `${formatNumber(ultima.gmdEntrePesagens, 2)} kg/dia`) : null,
    linha('Total de pesagens no período', formatNumber(linhas.length, 0)),
  ]
    .filter(Boolean)
    .join('\n');
}

export function gerarResumoFinanceiroTexto(relatorio) {
  if (!relatorio) {
    return 'HERDON — Resumo Financeiro\n\nAinda não há lançamentos financeiros no período.';
  }

  const principal = relatorio.maioresCategorias?.[0];

  return [
    'HERDON — Resumo Financeiro',
    '',
    linha('Entrou', formatCurrency(relatorio.entrou)),
    linha('Saiu', formatCurrency(relatorio.saiu)),
    linha('Saldo', formatCurrency(relatorio.saldo)),
    principal ? linha('Maior custo', `${principal.categoria} (${formatCurrency(principal.total)})`) : null,
    linha('Contas vencidas', formatNumber(relatorio.contasVencidas?.length || 0, 0)),
  ]
    .filter(Boolean)
    .join('\n');
}

export function gerarResumoPastagensTexto(relatorio) {
  if (!relatorio) {
    return 'HERDON — Resumo de Pastos\n\nCadastre os pastos da fazenda para acompanhar a ocupação.';
  }

  return [
    'HERDON — Resumo de Pastos',
    '',
    linha('Total de pastos', formatNumber(relatorio.totalPastos, 0)),
    linha('Pastos com lote', formatNumber(relatorio.pastosComLote, 0)),
    linha('Pastos vazios', formatNumber(relatorio.pastosSemLote, 0)),
    linha('Pastos acima da capacidade', formatNumber(relatorio.pastosAcimaCapacidade?.length || 0, 0)),
    linha('Pastos em atenção', formatNumber(relatorio.pastosEmAtencao?.length || 0, 0)),
    linha('Lotes sem pasto', formatNumber(relatorio.lotesSemPasto, 0)),
  ].join('\n');
}

export function gerarResumoGeralTexto(relatorio) {
  if (!relatorio) {
    return 'HERDON — Resumo Geral da Fazenda\n\nSem dados suficientes.';
  }

  return [
    'HERDON — Resumo Geral da Fazenda',
    '',
    linha('Fazendas', formatNumber(relatorio.totalFazendas, 0)),
    linha('Pastos', formatNumber(relatorio.totalPastos, 0)),
    linha('Lotes ativos', formatNumber(relatorio.totalLotesAtivos, 0)),
    linha('Cabeças', formatNumber(relatorio.totalCabecas, 0)),
    linha('Peso médio geral', `${formatNumber(relatorio.pesoMedioGeral, 1)} kg`),
    linha('Resultado financeiro', formatCurrency(relatorio.lucroTotalFazenda)),
    linha('Alertas críticos', formatNumber(relatorio.alertasCriticos?.length || 0, 0)),
  ].join('\n');
}
