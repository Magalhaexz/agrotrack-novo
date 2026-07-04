// Relatório bonito/compartilhável do lote (Sprint 4). Função pura de
// orquestração — NÃO recalcula nada: só chama `buildRelatorioLote`
// (relatorios.js, já reaproveita getResumoLote/decisaoVenda/manejoResultado)
// e `calcularSaudeLote` (saudeLote.js, Sprint 3, já reaproveita os detectores
// do motor de alertas — Sprint 1) e reorganiza o resultado no formato que a
// UI/exportação precisa, com os nomes de campo pedidos para este relatório.
import { toNumber } from './calcHelpers.js';
import { buildRelatorioLote } from './relatorios.js';
import { calcularSaudeLote } from './saudeLote.js';
import { STATUS_DECISAO } from './decisaoVenda.js';

// Título curto (estilo "alerta") por fator de saúde negativo — usado tanto na
// UI quanto no texto de WhatsApp. Não é um novo cálculo: só um rótulo em
// português para uma chave que `calcularSaudeLote` já decidiu ser um problema.
const ALERTA_TITULO_POR_FATOR = {
  gmd: 'Lote abaixo da meta de GMD',
  pesagem: 'Lote sem pesagem recente',
  tarefas: 'Tarefa atrasada neste lote',
  sanidade: 'Sanidade próxima ou pendente',
  estoque: 'Estoque crítico vinculado a este lote',
  custo: 'Custo do lote acima do esperado',
  mortalidade: 'Perdas registradas neste lote',
};

// Ação sugerida por fator negativo — mesmo princípio: rótulo de apresentação
// sobre um resultado já calculado, não uma nova regra de negócio.
const ACAO_POR_FATOR = {
  gmd: 'Revisar suplementação e programar nova pesagem',
  pesagem: 'Priorizar nova pesagem',
  tarefas: 'Concluir ou reagendar a tarefa atrasada',
  sanidade: 'Regularizar manejo sanitário',
  estoque: 'Repor estoque',
  custo: 'Revisar custo do lote',
  mortalidade: 'Investigar causa das perdas',
};

/**
 * Deriva os "alertas do lote" a partir dos fatores negativos já calculados
 * por `calcularSaudeLote` — não roda nenhum detector de novo.
 */
function derivarAlertasDoLote(saudeLote) {
  if (!saudeLote || saudeLote.dadosInsuficientes) return [];
  return saudeLote.fatores
    .filter((fator) => fator.disponivel && fator.pontos < 0)
    .map((fator) => ({
      chave: fator.chave,
      titulo: ALERTA_TITULO_POR_FATOR[fator.chave] || fator.label,
      descricao: fator.descricao,
      pontos: fator.pontos,
    }));
}

/**
 * Decisões sugeridas: uma frase por fator de saúde negativo, mais "avaliar
 * venda" quando `decisaoVenda` (já calculada em `buildRelatorioLote`) indicar
 * que o lote está pronto. Nunca inventa uma ação para um problema que não
 * existe — só traduz o que os fatores/decisão de venda já apontaram.
 */
function gerarDecisoesSugeridas(saudeLote, decisaoVenda) {
  const decisoes = [];

  if (saudeLote && !saudeLote.dadosInsuficientes) {
    saudeLote.fatores
      .filter((fator) => fator.disponivel && fator.pontos < 0)
      .forEach((fator) => {
        const texto = ACAO_POR_FATOR[fator.chave];
        if (texto && !decisoes.includes(texto)) decisoes.push(texto);
      });
  }

  if (decisaoVenda?.status === STATUS_DECISAO.PRONTO_AVALIAR) {
    decisoes.push('Avaliar venda deste lote');
  }

  if (decisoes.length === 0 && decisaoVenda?.status && decisaoVenda.status !== STATUS_DECISAO.DADOS_INSUFICIENTES) {
    decisoes.push('Continuar acompanhando — nenhuma ação urgente identificada agora');
  }

  return decisoes;
}

/**
 * Status de GMD para exibição (acima / dentro / abaixo / sem_dados),
 * derivado do fator 'gmd' de `calcularSaudeLote` (que já decide se há dado
 * suficiente e se está abaixo da meta) — só adiciona a distinção cosmética
 * entre "acima" e "dentro" a partir do sinal da diferença já conhecida.
 */
function derivarGmdStatus(saudeLote, gmdAtual, gmdEsperado) {
  const fator = saudeLote?.fatores?.find((item) => item.chave === 'gmd');
  if (!fator?.disponivel) return 'sem_dados';
  if (fator.pontos < 0) return 'abaixo';
  const diferenca = toNumber(gmdAtual) - toNumber(gmdEsperado);
  return diferenca > 0 ? 'acima' : 'dentro';
}

/**
 * Monta o objeto pronto para a UI/exportação do relatório de um lote.
 * Não inventa nenhum dado ausente: quando falta pesagem, custo ou preço de
 * venda, os campos correspondentes ficam `null` (nunca 0 disfarçado de dado
 * real) e `dadosInsuficientes`/`mensagemDadosInsuficientes` explicam o porquê
 * (reaproveitando a mensagem que `classificarDecisaoVenda` já monta).
 */
export function gerarResumoRelatorioLote(db = {}, loteId, options = {}) {
  const agora = options.agora || new Date();
  const relatorio = buildRelatorioLote(db, loteId);

  if (!relatorio.encontrado) {
    return {
      encontrado: false,
      lote: null,
      fazenda: null,
      geradoEm: agora,
      dadosInsuficientes: true,
      mensagemDadosInsuficientes: 'Lote não encontrado.',
      saudeLote: null,
      alertas: [],
      decisoes: [],
      relatorio,
    };
  }

  const saudeLote = calcularSaudeLote(db, loteId, agora);
  const alertas = derivarAlertasDoLote(saudeLote);
  const decisoes = gerarDecisoesSugeridas(saudeLote, relatorio.decisaoVenda);
  const gmdStatus = derivarGmdStatus(saudeLote, relatorio.gmdMedio, relatorio.gmdMeta);

  const dadosInsuficientes = relatorio.decisaoVenda?.status === STATUS_DECISAO.DADOS_INSUFICIENTES;
  const temPesagem = toNumber(relatorio.dias) > 0 && toNumber(relatorio.pesoAtualMedio) > 0;
  const temCusto = toNumber(relatorio.custoTotal) > 0;
  // simulacaoVenda só existe quando há dados suficientes (buildRelatorioLote
  // já retorna null quando não há) — por isso receita/lucro projetados nunca
  // aparecem "inventados" sem preço/arrobas calculáveis.
  const receitaPrevista = relatorio.simulacaoVenda ? relatorio.simulacaoVenda.vendaHoje.receita : null;
  const lucroEstimado = relatorio.simulacaoVenda ? relatorio.simulacaoVenda.vendaHoje.lucro : null;

  return {
    // Espalha o relatório original primeiro: mantém `gerarResumoLoteTexto`
    // (whatsappResumo.js) funcionando sem nenhuma alteração para quem ainda
    // usa o formato de buildRelatorioLote — os campos abaixo só sobrescrevem
    // com as versões "não inventadas" (null quando falta dado) e os nomes
    // pedidos para este relatório.
    ...relatorio,
    encontrado: true,
    lote: relatorio.lote,
    fazenda: relatorio.fazendaNome,
    geradoEm: agora,

    cabecas: relatorio.totalAnimais,
    pesoInicial: relatorio.pesoInicialMedio,
    pesoAtual: relatorio.pesoAtualMedio,
    pesoAlvo: toNumber(relatorio.lote?.peso_alvo) || null,
    dias: relatorio.dias,

    gmd: relatorio.gmdMedio,
    gmdEsperado: relatorio.gmdMeta,
    gmdDiferenca: relatorio.gmdMeta ? toNumber(relatorio.gmdMedio) - toNumber(relatorio.gmdMeta) : null,
    gmdStatus,

    custoTotal: temCusto ? relatorio.custoTotal : null,
    custoPorCabeca: temCusto ? relatorio.custoPorCabeca : null,
    custoPorArroba: temCusto ? relatorio.custoPorArroba : null,
    receitaPrevista,
    lucroEstimado,

    saudeLote,
    alertas,
    decisoes,

    pesagemInsuficiente: !temPesagem,
    custoIndisponivel: !temCusto,
    receitaIndisponivel: receitaPrevista === null,
    dadosInsuficientes,
    mensagemDadosInsuficientes: dadosInsuficientes ? relatorio.decisaoVenda.mensagem : null,

    // Objeto completo de buildRelatorioLote, para quem precisar de mais
    // detalhe (últimas pesagens, manejo/sanidade/suplementação, simulação).
    relatorio,
  };
}
