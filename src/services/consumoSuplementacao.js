// Exclusão/estorno de consumo de suplementação — I/O único, reaproveitado por
// `LotesPage.jsx` e `SuplementacaoPage.jsx` (e disponível para o bot do
// Telegram). Extraído para corrigir o bloqueio estrutural em que as duas
// telas excluíam o mesmo registro com regras diferentes (só uma devolvia o
// estoque) — ver `domain/consumoSuplementacao.js` para a fórmula pura.
import { deleteOperationalRecord, updateOperationalRecord } from './operationalPersistence.js';
import { calcularEstornoConsumoSuplementacao } from '../domain/consumoSuplementacao.js';

/**
 * @param {object} db — precisa de `estoque` e `movimentacoes_financeiras`.
 * @param {object} session
 * @param {object} registro — linha de `consumo_suplementacao` a excluir.
 * @returns {{ ok:true, consumoId, produtoId, novoSaldoEstoque, financeiroIdExcluido } | { ok:false, error }}
 */
export async function excluirEEstornarConsumoSuplementacao(db, session, registro) {
  const produto = registro?.item_estoque_id
    ? (db.estoque || []).find((item) => Number(item.id) === Number(registro.item_estoque_id))
    : null;
  const movimentoFinanceiro = (db.movimentacoes_financeiras || []).find(
    (mov) => String(mov?.origem_tipo || '') === 'consumo_suplementacao' && Number(mov?.origem_id) === Number(registro?.id)
  );

  const calculo = calcularEstornoConsumoSuplementacao({ registro, produto, movimentoFinanceiro });
  if (!calculo.ok) return { ok: false, error: 'Registro de consumo inválido.' };

  const consumoPersist = await deleteOperationalRecord('consumo_suplementacao', registro.id, session);
  if (!consumoPersist?.persisted) {
    return { ok: false, error: consumoPersist?.error || 'Não foi possível excluir o consumo agora.' };
  }

  if (calculo.deveRestaurarEstoque) {
    await updateOperationalRecord('estoque', Number(calculo.produtoId), {
      quantidade_atual: calculo.novoSaldoEstoque, quantidade: calculo.novoSaldoEstoque,
    }, session);
  }
  if (calculo.financeiroIdParaExcluir) {
    await deleteOperationalRecord('movimentacoes_financeiras', calculo.financeiroIdParaExcluir, session);
  }

  return {
    ok: true,
    consumoId: Number(registro.id),
    produtoId: calculo.produtoId,
    novoSaldoEstoque: calculo.novoSaldoEstoque,
    financeiroIdExcluido: calculo.financeiroIdParaExcluir,
  };
}
