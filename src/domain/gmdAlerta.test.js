import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarDesempenhoGmd } from './gmdAlerta.js';

test('avaliarDesempenhoGmd alerta quando GMD realizado fica abaixo da meta', () => {
  const r = avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0.8, qtdPesagens: 3 });
  assert.equal(r.status, 'abaixo');
  assert.equal(r.diferenca, -0.4);
  assert.match(r.mensagem, /abaixo do GMD esperado/i);
});

test('avaliarDesempenhoGmd retorna ok quando dentro ou acima da meta', () => {
  assert.equal(avaliarDesempenhoGmd({ gmdMeta: 1.0, gmdReal: 1.0, qtdPesagens: 2 }).status, 'ok');
  assert.equal(avaliarDesempenhoGmd({ gmdMeta: 1.0, gmdReal: 1.3, qtdPesagens: 5 }).status, 'ok');
});

test('avaliarDesempenhoGmd não alerta sem pesagens suficientes', () => {
  assert.equal(avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0.5, qtdPesagens: 1 }).status, 'sem_dados');
  assert.equal(avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0, qtdPesagens: 0 }).status, 'sem_dados');
});

test('avaliarDesempenhoGmd não alerta sem meta cadastrada', () => {
  assert.equal(avaliarDesempenhoGmd({ gmdMeta: 0, gmdReal: 0.5, qtdPesagens: 4 }).status, 'sem_dados');
});
