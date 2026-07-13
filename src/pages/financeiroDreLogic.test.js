import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDRE } from './financeiroDreLogic.js';

function db(movimentacoes) {
  return { movimentacoes_financeiras: movimentacoes };
}

test('computeDRE exclui lançamentos cancelados dos totais gerais', () => {
  const dre = computeDRE(
    db([
      { tipo: 'receita', valor: 1000, data: '2026-01-10', status: 'realizado' },
      { tipo: 'despesa', valor: 300, data: '2026-01-12', status: 'cancelado', categoria: 'Racao' },
    ]),
    []
  );

  assert.equal(dre.receita, 1000);
  assert.equal(dre.despesa, 0);
  assert.equal(dre.resultado, 1000);
  assert.deepEqual(dre.despesaPorCategoria, {});
});

test('computeDRE exclui previsto do gráfico mensal', () => {
  const dre = computeDRE(
    db([
      { tipo: 'despesa', valor: 200, data: '2026-02-05', status: 'previsto', categoria: 'Frete' },
      { tipo: 'despesa', valor: 50, data: '2026-02-06', status: 'realizado', categoria: 'Frete' },
    ]),
    []
  );

  const fevereiro = dre.mensal.find((m) => m.mes === '2026-02');
  assert.equal(fevereiro.despesa, 50);
  assert.equal(dre.despesaPorCategoria.Frete, 50);
});

test('computeDRE soma receita/despesa de lote (lotesRows) independente do status geral', () => {
  const lotesRows = [{ receitaTotal: 500, custoTotal: 200 }];
  const dre = computeDRE(db([]), lotesRows);

  assert.equal(dre.receita, 500);
  assert.equal(dre.despesa, 200);
  assert.equal(dre.resultado, 300);
});
