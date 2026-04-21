/**
 * Converte um valor para número, usando 0 como fallback para valores nulos ou indefinidos.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  return Number(value || 0);
}

/**
 * Verifica se um item pertence a um lote específico.
 * @param {object} item - O item a ser verificado (deve ter uma propriedade lote_id).
 * @param {number|string} loteId - O ID do lote.
 * @returns {boolean} True se o item pertence ao lote, false caso contrário.
 */
function pertenceAoLote(item, loteId) {
  return toNumber(item?.lote_id) === toNumber(loteId);
}

/**
 * Calcula os custos totais e categorizados para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 * @returns {{custoAnimais: number, custoEstoque: number, custoOutros: number, custoTotal: number}} Os custos do lote.
 */
export function calcularCustoLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const despesasLote = movimentosFinanceiros.filter(
    (mov) => mov.tipo === 'despesa' && pertenceAoLote(mov, loteId)
  );

  // Otimização: calcular todas as categorias de custo em uma única passagem
  const { custoAnimais, custoEstoque, custoOutros } = despesasLote.reduce(
    (acc, mov) => {
      const valor = toNumber(mov.valor);
      if (mov.categoria === 'compra_animal') {
        acc.custoAnimais += valor;
      } else if (mov.categoria === 'compra_estoque') {
        acc.custoEstoque += valor;
      } else {
        acc.custoOutros += valor;
      }
      return acc;
    },
    { custoAnimais: 0, custoEstoque: 0, custoOutros: 0 }
  );

  return {
    custoAnimais,
    custoEstoque,
    custoOutros,
    custoTotal: custoAnimais + custoEstoque + custoOutros,
  };
}

/**
 * Calcula as receitas totais e categorizadas para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 * @returns {{receitaVendas: number, receitaOutros: number, receitaTotal: number}} As receitas do lote.
 */
export function calcularReceitaLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const receitasLote = movimentosFinanceiros.filter(
    (mov) => mov.tipo === 'receita' && pertenceAoLote(mov, loteId)
  );

  // Otimização: calcular todas as categorias de receita em uma única passagem
  const { receitaVendas, receitaOutros } = receitasLote.reduce(
    (acc, mov) => {
      const valor = toNumber(mov.valor);
      if (mov.categoria === 'venda_animal') {
        acc.receitaVendas += valor;
      } else {
        acc.receitaOutros += valor;
      }
      return acc;
    },
    { receitaVendas: 0, receitaOutros: 0 }
  );

  return {
    receitaVendas,
    receitaOutros,
    receitaTotal: receitaVendas + receitaOutros,
  };
}

/**
 * Calcula o resultado financeiro completo e indicadores zootécnicos para um lote.
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 * @returns {{custoTotal: number, receitaTotal: number, lucroTotal: number, qtdCabecas: number, lucroPorCabeca: number, pesoMedioAtual: number, arrobaViva: number, lucroPorArroba: number}} Os resultados do lote.
 */
export function calcularResultadoLote(db, loteId) {
  const custo = calcularCustoLote(db, loteId);
  const receita = calcularReceitaLote(db, loteId);
  const lucroTotal = receita.receitaTotal - custo.custoTotal;

  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const animaisLote = animais.filter((item) => pertenceAoLote(item, loteId));
  const qtdCabecas = animaisLote.reduce((acc, item) => acc + toNumber(item.qtd), 0);

  const pesoMedioAtual = qtdCabecas
    ? animaisLote.reduce((acc, item) => acc + toNumber(item.p_at) * toNumber(item.qtd), 0) /
      qtdCabecas
    : 0;
  const arrobaViva = pesoMedioAtual / 15;

  const lucroPorCabeca = qtdCabecas ? lucroTotal / qtdCabecas : 0;
  const arrobasTotaisVivas = qtdCabecas * arrobaViva;
  const lucroPorArroba = arrobasTotaisVivas ? lucroTotal / arrobasTotaisVivas : 0;

  return {
    custoTotal: custo.custoTotal,
    receitaTotal: receita.receitaTotal,
    lucroTotal,
    qtdCabecas,
    lucroPorCabeca, // Corrigido o nome da propriedade
    pesoMedioAtual,
    arrobaViva,
    lucroPorArroba,
  };
}