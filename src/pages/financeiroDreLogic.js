// computeDRE (FinanceiroPage.jsx) extraída para ser testável (mesmo padrão de
// financeiroLancamentoLogic.js/lotesLogic.js/calendarioOperacionalLogic.js).
//
// Correções estruturais pós-auditoria (Parte 4): a aba DRE e sua exportação
// somavam despesasGerais/receitasGerais, o gráfico mensal e a quebra por
// categoria sem excluir lançamentos `cancelado`/`previsto` — só as linhas por
// lote (via getResumoLote) já filtravam corretamente. Agora tudo usa
// deveEntrarNoResultadoLote, a mesma regra de competência do resto do app.
import { deveEntrarNoResultadoLote } from '../domain/financeiroStatus.js';

export function computeDRE(db, lotesRows) {
  const movimentacoes = (Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [])
    .filter(deveEntrarNoResultadoLote);
  const receitaLotes = lotesRows.reduce((sum, row) => sum + row.receitaTotal, 0);
  const despesaLotes = lotesRows.reduce((sum, row) => sum + row.custoTotal, 0);
  const despesasGerais = movimentacoes.filter((item) => item.tipo === 'despesa' && !item.lote_id).reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const receitasGerais = movimentacoes.filter((item) => item.tipo === 'receita' && !item.lote_id).reduce((sum, item) => sum + Number(item.valor || 0), 0);

  const mensalMap = {};
  movimentacoes.forEach((item) => {
    const mes = String(item.data || '').slice(0, 7);
    if (!mes) {
      return;
    }
    if (!mensalMap[mes]) {
      mensalMap[mes] = { mes, receita: 0, despesa: 0 };
    }
    mensalMap[mes][item.tipo === 'receita' ? 'receita' : 'despesa'] += Number(item.valor || 0);
  });

  const despesaPorCategoria = {};
  movimentacoes
    .filter((item) => item.tipo === 'despesa')
    .forEach((item) => {
      const categoria = item.categoria || 'Outro';
      despesaPorCategoria[categoria] = (despesaPorCategoria[categoria] || 0) + Number(item.valor || 0);
    });

  return {
    receita: receitaLotes + receitasGerais,
    despesa: despesaLotes + despesasGerais,
    resultado: receitaLotes + receitasGerais - despesaLotes - despesasGerais,
    mensal: Object.values(mensalMap).sort((a, b) => a.mes.localeCompare(b.mes)),
    despesaPorCategoria,
  };
}
