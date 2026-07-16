// Estorno de consumo de suplementação (correção de bloqueio estrutural).
// Puro, sem I/O. Antes desta função, `LotesPage.jsx` e `SuplementacaoPage.jsx`
// excluíam o mesmo registro de `consumo_suplementacao` com duas regras
// diferentes: só a versão de Suplementação devolvia a quantidade ao estoque.
// Esta é a ÚNICA fórmula de cálculo do estorno — ambas as telas (e o bot,
// quando ganhar a operação) devem chamar `services/consumoSuplementacao.js`,
// que usa esta função, em vez de reimplementar a regra.
const erro = (codigo) => ({ ok: false, erro: codigo });

/**
 * @param {object} registro — linha de `consumo_suplementacao` a excluir.
 * @param {object|null} produto — item de `estoque` vinculado (ou null se não houver).
 * @param {object|null} movimentoFinanceiro — lançamento de `movimentacoes_financeiras`
 *   com `origem_tipo:'consumo_suplementacao'` e `origem_id` igual ao do registro.
 * @returns {{ ok:true, qtdConsumida, deveRestaurarEstoque, novoSaldoEstoque, financeiroIdParaExcluir }}
 */
export function calcularEstornoConsumoSuplementacao({ registro, produto, movimentoFinanceiro } = {}) {
  if (!registro?.id) return erro('CONSUMO_INVALIDO');

  const qtdConsumida = Number(registro?.qtd_total ?? registro?.quantidade_total ?? registro?.quantidade ?? 0);
  const deveRestaurarEstoque = Boolean(produto) && qtdConsumida > 0;
  const novoSaldoEstoque = deveRestaurarEstoque
    ? Number(produto.quantidade_atual ?? produto.quantidade ?? 0) + qtdConsumida
    : null;

  return {
    ok: true,
    qtdConsumida,
    deveRestaurarEstoque,
    novoSaldoEstoque,
    produtoId: produto?.id ?? null,
    financeiroIdParaExcluir: movimentoFinanceiro?.id ?? null,
  };
}
