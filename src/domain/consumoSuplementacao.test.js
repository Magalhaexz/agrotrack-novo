import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstornoConsumoSuplementacao } from './consumoSuplementacao.js';

test('calcula devolução de estoque quando há produto vinculado e quantidade > 0', () => {
  const r = calcularEstornoConsumoSuplementacao({
    registro: { id: 1, qtd_total: 80 },
    produto: { id: 50, quantidade_atual: 120 },
    movimentoFinanceiro: { id: 900 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.deveRestaurarEstoque, true);
  assert.equal(r.novoSaldoEstoque, 200);
  assert.equal(r.produtoId, 50);
  assert.equal(r.financeiroIdParaExcluir, 900);
});

test('não devolve estoque quando não há produto vinculado', () => {
  const r = calcularEstornoConsumoSuplementacao({ registro: { id: 1, qtd_total: 80 }, produto: null, movimentoFinanceiro: null });
  assert.equal(r.deveRestaurarEstoque, false);
  assert.equal(r.novoSaldoEstoque, null);
  assert.equal(r.financeiroIdParaExcluir, null);
});

test('não devolve estoque quando quantidade consumida é zero', () => {
  const r = calcularEstornoConsumoSuplementacao({ registro: { id: 1, qtd_total: 0 }, produto: { id: 50, quantidade_atual: 120 } });
  assert.equal(r.deveRestaurarEstoque, false);
});

test('aceita as 3 variações de campo de quantidade (qtd_total/quantidade_total/quantidade)', () => {
  assert.equal(calcularEstornoConsumoSuplementacao({ registro: { id: 1, qtd_total: 10 }, produto: { id: 1, quantidade_atual: 0 } }).novoSaldoEstoque, 10);
  assert.equal(calcularEstornoConsumoSuplementacao({ registro: { id: 1, quantidade_total: 10 }, produto: { id: 1, quantidade_atual: 0 } }).novoSaldoEstoque, 10);
  assert.equal(calcularEstornoConsumoSuplementacao({ registro: { id: 1, quantidade: 10 }, produto: { id: 1, quantidade_atual: 0 } }).novoSaldoEstoque, 10);
});

test('rejeita registro sem id', () => {
  const r = calcularEstornoConsumoSuplementacao({ registro: {}, produto: null });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'CONSUMO_INVALIDO');
});
