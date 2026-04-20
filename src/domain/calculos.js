function toNumber(value) {
  return Number(value || 0);
}

function pertenceAoLote(item, loteId) {
  return Number(item?.lote_id) === Number(loteId);
}

export function calcularCustoLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const despesasLote = movimentosFinanceiros.filter(
    (mov) => mov.tipo === 'despesa' && pertenceAoLote(mov, loteId)
  );

  const custoAnimais = despesasLote
    .filter((mov) => mov.categoria === 'compra_animal')
    .reduce((acc, mov) => acc + toNumber(mov.valor), 0);

  const custoEstoque = despesasLote
    .filter((mov) => mov.categoria === 'compra_estoque')
    .reduce((acc, mov) => acc + toNumber(mov.valor), 0);

  const custoOutros = despesasLote
    .filter((mov) => !['compra_animal', 'compra_estoque'].includes(mov.categoria))
    .reduce((acc, mov) => acc + toNumber(mov.valor), 0);

  return {
    custoAnimais,
    custoEstoque,
    custoOutros,
    custoTotal: custoAnimais + custoEstoque + custoOutros,
  };
}

export function calcularReceitaLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const receitasLote = movimentosFinanceiros.filter(
    (mov) => mov.tipo === 'receita' && pertenceAoLote(mov, loteId)
  );

  const receitaVendas = receitasLote
    .filter((mov) => mov.categoria === 'venda_animal')
    .reduce((acc, mov) => acc + toNumber(mov.valor), 0);

  const receitaOutros = receitasLote
    .filter((mov) => mov.categoria !== 'venda_animal')
    .reduce((acc, mov) => acc + toNumber(mov.valor), 0);

  return {
    receitaVendas,
    receitaOutros,
    receitaTotal: receitaVendas + receitaOutros,
  };
}

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
    lucroporCabeca: lucroPorCabeca,
    pesoMedioAtual,
    arrobaViva,
    lucroPorArroba,
  };
}
