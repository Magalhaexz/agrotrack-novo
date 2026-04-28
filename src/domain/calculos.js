/**
 * Converte um valor para número, usando 0 como fallback para valores nulos ou indefinidos.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeDivide(value, divisor) {
  if (!Number.isFinite(divisor) || divisor === 0) return 0;
  const result = value / divisor;
  return Number.isFinite(result) ? result : 0;
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
  const custos = Array.isArray(db?.custos) ? db.custos : [];

  const despesasLote = movimentosFinanceiros.filter(
    (mov) => mov.tipo === 'despesa' && pertenceAoLote(mov, loteId)
  );

  const despesasCustosMap = new Map();
  despesasLote.forEach((mov) => {
    if (mov?.origem === 'custo' && mov?.origem_id != null) {
      despesasCustosMap.set(Number(mov.origem_id), true);
    }
  });

  // Otimização: calcular todas as categorias de custo em uma única passagem
  const baseCustos = despesasLote.reduce(
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

  const custosLegadosNaoRepresentados = custos.filter((custo) => {
    if (!pertenceAoLote(custo, loteId)) return false;
    if (custo?.id == null) return true;
    return !despesasCustosMap.has(Number(custo.id));
  });

  custosLegadosNaoRepresentados.forEach((custo) => {
    baseCustos.custoOutros += toNumber(custo?.val);
  });

  return {
    custoAnimais: baseCustos.custoAnimais,
    custoEstoque: baseCustos.custoEstoque,
    custoOutros: baseCustos.custoOutros,
    custoTotal: baseCustos.custoAnimais + baseCustos.custoEstoque + baseCustos.custoOutros,
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
  const custoTotal = toNumber(custo.custoTotal);
  const receitaTotal = toNumber(receita.receitaTotal);
  const lucroTotal = receitaTotal - custoTotal;

  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const animaisLote = animais.filter((item) => pertenceAoLote(item, loteId));
  const qtdCabecas = animaisLote.reduce((acc, item) => acc + toNumber(item.qtd), 0);
  const pesoMedioAtual = qtdCabecas
    ? safeDivide(
        animaisLote.reduce((acc, item) => acc + toNumber(item.p_at) * toNumber(item.qtd), 0),
        qtdCabecas
      )
    : 0;
  const arrobaViva = safeDivide(pesoMedioAtual, 15);

  const lucroPorCabeca = safeDivide(lucroTotal, qtdCabecas);
  const arrobasTotaisVivas = qtdCabecas * arrobaViva;
  const lucroPorArroba = safeDivide(lucroTotal, arrobasTotaisVivas);
  const margemPct = receitaTotal > 0 ? safeDivide(lucroTotal * 100, receitaTotal) : 0;

  return {
    custoTotal,
    receitaTotal,
    lucroTotal,
    margemPct,
    qtdCabecas,
    lucroPorCabeca, // Corrigido o nome da propriedade
    pesoMedioAtual,
    arrobaViva,
    lucroPorArroba,
  };
}
