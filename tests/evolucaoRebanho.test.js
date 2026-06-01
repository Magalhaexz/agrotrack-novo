import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEvolucaoRebanho } from '../src/domain/evolucaoRebanho.js';

test('computeEvolucaoRebanho calcula estoque inicial/final e variacao sem NaN', () => {
  const db = {
    animais: [{ qtd: 100, status: 'ativo' }],
    movimentacoes_animais: [
      { id: 1, data: '2026-01-10', tipo: 'compra', qtd: 10 },
      { id: 2, data: '2026-01-12', tipo: 'venda', qtd: 5 },
      { id: 3, data: '2026-01-15', tipo: 'morte', qtd: 2 },
      { id: 4, data: '2026-01-18', tipo: 'nascimento', qtd: 3 },
      { id: 5, data: '2026-01-20', tipo: 'transferencia_entrada', qtd: 4 },
      { id: 6, data: '2026-01-22', tipo: 'transferencia_saida', qtd: 1 },
    ],
  };

  const { resumo } = computeEvolucaoRebanho(db, '2026-01-01', '2026-01-31');
  assert.equal(resumo.compras, 10);
  assert.equal(resumo.vendas, 5);
  assert.equal(resumo.mortes, 2);
  assert.equal(resumo.nascimentos, 3);
  assert.equal(resumo.transferencias_entrada, 4);
  assert.equal(resumo.transferencias_saida, 1);
  assert.equal(Number.isFinite(resumo.estoque_inicial), true);
  assert.equal(Number.isFinite(resumo.estoque_final), true);
  assert.equal(Number.isFinite(resumo.variacao_inventario), true);
  assert.equal(
    resumo.estoque_inicial + resumo.compras + resumo.nascimentos + resumo.transferencias_entrada
      - resumo.vendas - resumo.mortes - resumo.transferencias_saida,
    resumo.estoque_final
  );
});

