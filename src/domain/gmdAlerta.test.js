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

// ── P1-05B: gmdDisponivel (fonte canônica) evita falso alerta ───────────────
// `qtdPesagens` é uma contagem de linhas — não garante que elas tenham
// `peso_medio` válido (produzindo um GMD real). `gmdDisponivel` vem da fonte
// canônica (domain/gmd.js) e é o sinal confiável.

test('avaliarDesempenhoGmd: gmdDisponivel=false nunca gera alerta, mesmo com qtdPesagens suficiente', () => {
  const r = avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0, qtdPesagens: 3, gmdDisponivel: false });
  assert.equal(r.status, 'sem_dados');
});

test('avaliarDesempenhoGmd: GMD real igual a zero, com gmdDisponivel=true, ainda alerta (dado real, não ausência)', () => {
  const r = avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0, qtdPesagens: 3, gmdDisponivel: true });
  assert.equal(r.status, 'abaixo');
});

test('avaliarDesempenhoGmd: GMD válido acima da meta com gmdDisponivel=true retorna ok', () => {
  const r = avaliarDesempenhoGmd({ gmdMeta: 1.0, gmdReal: 1.3, qtdPesagens: 3, gmdDisponivel: true });
  assert.equal(r.status, 'ok');
});

test('avaliarDesempenhoGmd: sem informar gmdDisponivel (chamador antigo) preserva o comportamento por qtdPesagens', () => {
  const r = avaliarDesempenhoGmd({ gmdMeta: 1.2, gmdReal: 0.8, qtdPesagens: 3 });
  assert.equal(r.status, 'abaixo');
});
