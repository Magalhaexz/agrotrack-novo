import { toNumber, safeDivide } from './calcHelpers.js';
import { getResumoLote } from './resumoLote.js';

export const DIAS_MINIMOS_PARA_AVALIACAO = 30;
export const LIMIAR_CUSTO_ALTO_PCT = 0.85;
export const PRECO_ARROBA_PADRAO = 270;

export const STATUS_DECISAO = {
  PRONTO_AVALIAR: 'pronto_avaliar',
  ACOMPANHAR: 'acompanhar',
  ABAIXO_META_GMD: 'abaixo_meta_gmd',
  CUSTO_ALTO: 'custo_alto',
  DADOS_INSUFICIENTES: 'dados_insuficientes',
};

const STATUS_LABEL = {
  [STATUS_DECISAO.PRONTO_AVALIAR]: 'Pronto para avaliar venda',
  [STATUS_DECISAO.ACOMPANHAR]: 'Acompanhar por mais alguns dias',
  [STATUS_DECISAO.ABAIXO_META_GMD]: 'Abaixo da meta de ganho',
  [STATUS_DECISAO.CUSTO_ALTO]: 'Custo alto por arroba',
  [STATUS_DECISAO.DADOS_INSUFICIENTES]: 'Dados insuficientes',
};

const MENSAGEM_DADOS_INSUFICIENTES = 'Ainda faltam dados de pesagem ou financeiro para uma decisão segura.';

// Ordem de checagem = ordem de prioridade quando mais de um dado falta —
// cabeças primeiro, porque sem elas nada mais pode ser calculado (Sprint 35:
// "Dados insuficientes" sozinho não dizia ao produtor o que fazer a seguir).
const DESCRICAO_CAMPO_FALTANTE = [
  { campo: 'qtdCabecas', descricao: 'a quantidade de cabeças (cadastre o grupo de animais do lote)' },
  { campo: 'pesoAtual', descricao: 'o peso médio atual (registre uma pesagem)' },
  { campo: 'arrobas', descricao: 'as arrobas estimadas (confirme peso e rendimento de carcaça)' },
  { campo: 'custoTotal', descricao: 'o custo total do lote (lance uma despesa vinculada a ele)' },
];

/**
 * Monta o objeto `dados` consumido pelas demais funções deste domínio, a
 * partir do que já existe em `getResumoLote` (resumoLote.js) — não recalcula
 * GMD, arrobas, custo ou lucro, só reorganiza os campos com nomes estáveis
 * para este domínio e adiciona o preço-alvo da arroba do lote.
 */
export function montarDadosDecisaoVenda(db, loteId) {
  const resumo = getResumoLote(db, loteId);
  const lote = resumo.lote;

  return {
    encontrado: Boolean(lote),
    status: lote?.status || null,
    qtdCabecas: resumo.totalAnimais,
    pesoInicial: resumo.pesoInicialMedio,
    pesoAtual: resumo.pesoAtualMedio,
    rendimentoCarcaca: toNumber(lote?.rendimento_carcaca) || 52,
    precoArroba: toNumber(lote?.preco_arroba) || PRECO_ARROBA_PADRAO,
    custoTotal: resumo.custoTotal,
    receitaTotal: resumo.receitaTotal,
    lucroTotal: resumo.lucroTotal,
    margemPct: resumo.margemPct,
    custoPorArroba: resumo.custoPorArroba,
    lucroPorArroba: resumo.lucroPorArroba,
    arrobas: resumo.arrobasCarcaca,
    gmdAtual: resumo.gmdMedio,
    gmdMeta: toNumber(lote?.gmd_meta) || null,
    dias: resumo.dias,
  };
}

/**
 * Arrobas de carcaça a partir de peso vivo, cabeças e rendimento — mesma
 * fórmula de `calcularResultadoLote` (calculos.js), reaplicada aqui porque
 * também precisa funcionar para um peso PROJETADO (hipotético, ainda não
 * registrado), o que as funções existentes não fazem — elas só leem o peso
 * atual dos animais reais.
 */
export function calcularArrobasEstimadas({ qtdCabecas, peso, rendimentoCarcaca } = {}) {
  const rendimento = toNumber(rendimentoCarcaca) > 0 ? toNumber(rendimentoCarcaca) / 100 : 0.52;
  return safeDivide(toNumber(qtdCabecas) * toNumber(peso) * rendimento, 15);
}

export function calcularCustoPorArroba({ custoTotal, arrobas } = {}) {
  return safeDivide(custoTotal, arrobas);
}

/**
 * Preço mínimo de venda da arroba para não ter prejuízo. Para um lote já
 * custeado até hoje, é numericamente igual ao custo por arroba realizado —
 * mantido como função própria porque o significado para o produtor é
 * diferente ("abaixo deste preço você perde dinheiro", não "isto já custou").
 */
export function calcularPontoEquilibrioArroba({ custoTotal, arrobas } = {}) {
  return safeDivide(custoTotal, arrobas);
}

function temDadosSuficientes(dados) {
  if (!dados) return false;
  return toNumber(dados.qtdCabecas) > 0 && toNumber(dados.pesoAtual) > 0 && toNumber(dados.arrobas) > 0 && toNumber(dados.custoTotal) > 0;
}

/**
 * Lista, em ordem de prioridade, o(s) campo(s) que faltam para calcular
 * custo por arroba e decisão de venda — usada para trocar o "Dados
 * insuficientes" genérico por uma instrução do que fazer a seguir.
 */
export function listarCamposFaltantesDecisaoVenda(dados) {
  return DESCRICAO_CAMPO_FALTANTE.filter(({ campo }) => toNumber(dados?.[campo]) <= 0);
}

function gerarMensagemDadosInsuficientes(dados) {
  const faltantes = listarCamposFaltantesDecisaoVenda(dados);
  if (!faltantes.length) return MENSAGEM_DADOS_INSUFICIENTES;
  if (faltantes.length === 1) {
    return `Ainda falta ${faltantes[0].descricao} para calcular o custo por arroba e a decisão de venda deste lote.`;
  }
  const descricoes = faltantes.map((item) => item.descricao);
  const ultima = descricoes.pop();
  return `Ainda faltam ${descricoes.join(', ')} e ${ultima} para calcular o custo por arroba e a decisão de venda deste lote.`;
}

/** Simula vender o lote hoje, pelo preço de arroba e arrobas já calculados em `dados`. */
export function simularVendaHoje(dados = {}) {
  const arrobas = toNumber(dados.arrobas);
  const precoArroba = toNumber(dados.precoArroba) || PRECO_ARROBA_PADRAO;
  const custo = toNumber(dados.custoTotal);
  const receita = arrobas * precoArroba;
  return {
    arrobas,
    precoArroba,
    receita,
    custo,
    lucro: receita - custo,
  };
}

/**
 * Simula manter o lote por mais `diasAdicionais`, com GMD e custo diário por
 * cabeça informados pelo produtor (ou estimados a partir de `dados`).
 */
export function simularManterLote(dados = {}, opcoes = {}) {
  const diasAdicionais = Math.max(0, toNumber(opcoes.diasAdicionais));
  const gmdEsperado = toNumber(opcoes.gmdEsperado) || toNumber(dados.gmdAtual);
  const custoDiarioPorCabeca = toNumber(opcoes.custoDiarioPorCabeca);
  const precoArroba = toNumber(opcoes.precoArroba) || toNumber(dados.precoArroba) || PRECO_ARROBA_PADRAO;
  const qtdCabecas = toNumber(dados.qtdCabecas);

  const pesoProjetado = toNumber(dados.pesoAtual) + gmdEsperado * diasAdicionais;
  const arrobasProjetadas = calcularArrobasEstimadas({
    qtdCabecas,
    peso: pesoProjetado,
    rendimentoCarcaca: dados.rendimentoCarcaca,
  });
  const custoAdicional = custoDiarioPorCabeca * qtdCabecas * diasAdicionais;
  const custoProjetado = toNumber(dados.custoTotal) + custoAdicional;
  const receitaProjetada = arrobasProjetadas * precoArroba;
  const lucroProjetado = receitaProjetada - custoProjetado;

  return {
    diasAdicionais,
    pesoProjetado,
    arrobasProjetadas,
    custoAdicional,
    custoProjetado,
    receitaProjetada,
    lucroProjetado,
  };
}

/**
 * Compara vender hoje com manter por mais dias. Resultado sempre marcado
 * como estimativa — não é uma recomendação de compra/venda real.
 */
export function compararVenderOuManter(dados = {}, opcoesManter = {}) {
  const vendaHoje = simularVendaHoje(dados);
  const manter = simularManterLote(dados, opcoesManter);
  const diferenca = manter.lucroProjetado - vendaHoje.lucro;

  return {
    vendaHoje,
    manter,
    diferenca,
    recomendacao: diferenca > 0 ? 'manter' : diferenca < 0 ? 'vender' : 'indiferente',
    aviso: 'Simulação estimada. Não substitui avaliação comercial do produtor.',
  };
}

/**
 * Classifica a situação do lote para decisão de venda em 5 categorias
 * simples, em ordem de prioridade: dados insuficientes → GMD abaixo da
 * meta → custo alto por arroba → pronto para avaliar → acompanhar. Nunca
 * recomenda "vender agora" — só "avaliar venda", deixando a decisão final
 * com o produtor.
 */
export function classificarDecisaoVenda(dados = {}) {
  if (!temDadosSuficientes(dados)) {
    return {
      status: STATUS_DECISAO.DADOS_INSUFICIENTES,
      statusLabel: STATUS_LABEL[STATUS_DECISAO.DADOS_INSUFICIENTES],
      mensagem: gerarMensagemDadosInsuficientes(dados),
    };
  }

  const gmdMeta = toNumber(dados.gmdMeta);
  if (gmdMeta > 0 && toNumber(dados.gmdAtual) < gmdMeta * 0.9) {
    return {
      status: STATUS_DECISAO.ABAIXO_META_GMD,
      statusLabel: STATUS_LABEL[STATUS_DECISAO.ABAIXO_META_GMD],
      mensagem: 'O ganho de peso deste lote está abaixo da meta. Avalie suplementação, sanidade ou pasto antes de decidir a venda.',
    };
  }

  const precoArroba = toNumber(dados.precoArroba) || PRECO_ARROBA_PADRAO;
  const custoPorArroba = toNumber(dados.custoPorArroba);
  if (custoPorArroba > 0 && custoPorArroba >= precoArroba * LIMIAR_CUSTO_ALTO_PCT) {
    return {
      status: STATUS_DECISAO.CUSTO_ALTO,
      statusLabel: STATUS_LABEL[STATUS_DECISAO.CUSTO_ALTO],
      mensagem: 'O custo por arroba está alto. Revise suplementação, sanidade ou permanência no lote.',
    };
  }

  const prontoParaAvaliar = toNumber(dados.lucroTotal) > 0 && toNumber(dados.dias) >= DIAS_MINIMOS_PARA_AVALIACAO;
  if (prontoParaAvaliar) {
    return {
      status: STATUS_DECISAO.PRONTO_AVALIAR,
      statusLabel: STATUS_LABEL[STATUS_DECISAO.PRONTO_AVALIAR],
      mensagem: 'Este lote já tem peso e resultado suficientes para avaliar venda.',
    };
  }

  return {
    status: STATUS_DECISAO.ACOMPANHAR,
    statusLabel: STATUS_LABEL[STATUS_DECISAO.ACOMPANHAR],
    mensagem: 'Este lote ainda está em fase de crescimento. Continue acompanhando o ganho de peso e o custo por mais alguns dias antes de decidir a venda.',
  };
}

/** Mensagem de uma linha, pronta para relatório/alerta/WhatsApp. */
export function gerarInsightVenda(dados = {}) {
  return classificarDecisaoVenda(dados).mensagem;
}
