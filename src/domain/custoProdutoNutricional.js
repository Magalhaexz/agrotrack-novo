// Custo de produtos nutricionais/suplementos (cadastro em Nutrição/Suplementação).
//
// Bug corrigido: o formulário pede "custo por saco/bag/unidade" (custo da
// EMBALAGEM), mas o cálculo antigo multiplicava esse valor pelo estoque
// total já convertido (embalagens × conteúdo), inflando o custo total pelo
// conteúdo da embalagem — 3 sacos de 50kg a R$50/saco virava R$7.500 em vez
// de R$150. Este módulo é a única fonte das 3 fórmulas (usado pelo modal de
// cadastro/edição, pelo resumo exibido e por qualquer outro lugar que
// precise recalcular) — puro, sem I/O.

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Estoque total = quantidade de embalagens × conteúdo de cada uma. */
export function calcularQuantidadeTotalEstoque({ quantidadeEmbalagens, conteudoPorEmbalagem }) {
  return toFiniteNumber(quantidadeEmbalagens) * toFiniteNumber(conteudoPorEmbalagem);
}

/** Custo total = quantidade de embalagens × custo de cada uma (NÃO multiplica pelo conteúdo). */
export function calcularCustoTotalProduto({ quantidadeEmbalagens, custoPorEmbalagem }) {
  return toFiniteNumber(quantidadeEmbalagens) * toFiniteNumber(custoPorEmbalagem);
}

/** Custo por kg/litro/unidade de controle = custo total ÷ estoque total. */
export function calcularCustoPorUnidadeControle({ quantidadeTotalEstoque, custoTotal }) {
  const qtd = toFiniteNumber(quantidadeTotalEstoque);
  return qtd > 0 ? toFiniteNumber(custoTotal) / qtd : 0;
}

/**
 * Resumo completo a partir dos campos do formulário de cadastro/edição.
 * @param {object} params
 * @param {number|string} params.quantidadeEmbalagens
 * @param {number|string} params.conteudoPorEmbalagem
 * @param {number|string} params.custoPorEmbalagem
 */
export function calcularResumoProdutoNutricional({ quantidadeEmbalagens, conteudoPorEmbalagem, custoPorEmbalagem }) {
  const quantidadeTotalEstoque = calcularQuantidadeTotalEstoque({ quantidadeEmbalagens, conteudoPorEmbalagem });
  const custoTotal = calcularCustoTotalProduto({ quantidadeEmbalagens, custoPorEmbalagem });
  const custoPorUnidadeControle = calcularCustoPorUnidadeControle({ quantidadeTotalEstoque, custoTotal });
  return { quantidadeTotalEstoque, custoTotal, custoPorUnidadeControle };
}

/**
 * Custo do consumo de uma quantidade (kg/litro/unidade) de um produto cujo
 * valor_unitario já está normalizado como custo por unidade de controle
 * (nunca custo por embalagem).
 */
export function calcularCustoConsumo({ quantidadeConsumida, custoPorUnidadeControle }) {
  return toFiniteNumber(quantidadeConsumida) * toFiniteNumber(custoPorUnidadeControle);
}

const PLURAL_EMBALAGEM = {
  saco: 'sacos',
  bag: 'bags',
  unidade: 'unidades',
  tonelada: 'toneladas',
};

/** "1 saco" / "3 sacos" / "1 unidade" / "2 unidades" (singular/plural pelo tipo de embalagem). */
export function formatarRotuloEmbalagem(tipoEmbalagem, quantidade) {
  const tipo = String(tipoEmbalagem || 'unidade').toLowerCase();
  const qtd = toFiniteNumber(quantidade);
  if (Math.abs(qtd) === 1) return tipo;
  return PLURAL_EMBALAGEM[tipo] || `${tipo}s`;
}

const ROTULO_CUSTO_POR_EMBALAGEM = {
  saco: 'Custo por saco (R$)',
  bag: 'Custo por bag (R$)',
  unidade: 'Custo por unidade (R$)',
  tonelada: 'Custo por tonelada (R$)',
};

/** Rótulo dinâmico do campo de custo, conforme o tipo de embalagem escolhido. */
export function rotuloCustoPorEmbalagem(tipoEmbalagem) {
  return ROTULO_CUSTO_POR_EMBALAGEM[String(tipoEmbalagem || '').toLowerCase()] || 'Custo por embalagem (R$)';
}

/**
 * Resolve o custo por embalagem a mostrar no formulário de edição.
 *
 * Prioriza `metadata.custo_por_embalagem` (formato novo, já normalizado).
 * Se ausente, só assume que o `valor_unitario` antigo era o custo por
 * embalagem quando o item tem os DOIS marcadores do formulário nutricional
 * anterior (`metadata.modulo === 'nutricao'` e `metadata.tipo_embalagem`
 * presente) — era assim que aquele formulário recebia o valor. Para
 * qualquer item sem esses marcadores (produto genérico de Estoque, por
 * exemplo), não inventa essa semântica: devolve 0.
 */
export function resolverCustoPorEmbalagemParaEdicao(item) {
  const metadata = item?.metadata || {};
  const custoNovo = metadata.custo_por_embalagem;
  if (custoNovo !== undefined && custoNovo !== null && custoNovo !== '') {
    return toFiniteNumber(custoNovo);
  }

  const ehLegadoDoFormularioNutricional = String(metadata.modulo || '').toLowerCase() === 'nutricao'
    && Boolean(metadata.tipo_embalagem);
  if (!ehLegadoDoFormularioNutricional) return 0;

  return toFiniteNumber(item?.valor_unitario ?? item?.custo_unitario ?? item?.preco_unitario ?? 0);
}
