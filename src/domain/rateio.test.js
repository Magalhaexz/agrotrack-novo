import test from 'node:test';
import assert from 'node:assert/strict';
import { ratearIgualitario, ratearPorCabecas, ratearPorPeso } from './rateio.js';

// --- ratearPorCabecas ---

test('ratearPorCabecas divide igualmente entre lotes iguais', () => {
  const lotes = [
    { lote_id: 1, qtdCabecas: 100 },
    { lote_id: 2, qtdCabecas: 100 },
  ];
  const result = ratearPorCabecas(10000, lotes);
  assert.equal(result[0].custoRateado, 5000);
  assert.equal(result[1].custoRateado, 5000);
});

test('ratearPorCabecas é proporcional para lotes desiguais', () => {
  const lotes = [
    { lote_id: 1, qtdCabecas: 200 },
    { lote_id: 2, qtdCabecas: 100 },
  ];
  const result = ratearPorCabecas(3000, lotes);
  assert.ok(Math.abs(result[0].custoRateado - 2000) < 0.01, `lote1 esperado 2000, recebido ${result[0].custoRateado}`);
  assert.ok(Math.abs(result[1].custoRateado - 1000) < 0.01, `lote2 esperado 1000, recebido ${result[1].custoRateado}`);
});

test('ratearPorCabecas soma igual ao custo total', () => {
  const lotes = [
    { lote_id: 1, qtdCabecas: 73 },
    { lote_id: 2, qtdCabecas: 127 },
    { lote_id: 3, qtdCabecas: 50 },
  ];
  const result = ratearPorCabecas(9876, lotes);
  const soma = result.reduce((s, r) => s + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 9876) < 0.01, `soma esperada 9876, recebida ${soma}`);
});

test('ratearPorCabecas lote sem cabeças recebe zero', () => {
  const lotes = [
    { lote_id: 1, qtdCabecas: 100 },
    { lote_id: 2, qtdCabecas: 0 },
  ];
  const result = ratearPorCabecas(5000, lotes);
  assert.equal(result[1].custoRateado, 0);
  assert.equal(result[0].custoRateado, 5000);
});

test('ratearPorCabecas com custo zero retorna zeros', () => {
  const lotes = [{ lote_id: 1, qtdCabecas: 100 }];
  const result = ratearPorCabecas(0, lotes);
  assert.equal(result[0].custoRateado, 0);
});

test('ratearPorCabecas quando todos têm zero cabeças retorna zeros', () => {
  const lotes = [
    { lote_id: 1, qtdCabecas: 0 },
    { lote_id: 2, qtdCabecas: 0 },
  ];
  const result = ratearPorCabecas(5000, lotes);
  assert.equal(result[0].custoRateado, 0);
  assert.equal(result[1].custoRateado, 0);
});

// --- ratearPorPeso ---

test('ratearPorPeso divide proporcionalmente ao peso total', () => {
  const lotes = [
    { lote_id: 1, pesoTotal: 40000 },
    { lote_id: 2, pesoTotal: 60000 },
  ];
  const result = ratearPorPeso(10000, lotes);
  assert.ok(Math.abs(result[0].custoRateado - 4000) < 0.01);
  assert.ok(Math.abs(result[1].custoRateado - 6000) < 0.01);
});

test('ratearPorPeso soma igual ao custo total', () => {
  const lotes = [
    { lote_id: 1, pesoTotal: 35000 },
    { lote_id: 2, pesoTotal: 28000 },
    { lote_id: 3, pesoTotal: 17000 },
  ];
  const result = ratearPorPeso(15000, lotes);
  const soma = result.reduce((s, r) => s + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 15000) < 0.01);
});

test('ratearPorPeso com peso zero em todos retorna zeros', () => {
  const lotes = [
    { lote_id: 1, pesoTotal: 0 },
    { lote_id: 2, pesoTotal: 0 },
  ];
  const result = ratearPorPeso(5000, lotes);
  assert.equal(result[0].custoRateado, 0);
  assert.equal(result[1].custoRateado, 0);
});

// --- ratearIgualitario ---

test('ratearIgualitario divide igualmente entre todos os lotes', () => {
  const result = ratearIgualitario(9000, 3);
  assert.equal(result.length, 3);
  result.forEach((r) => assert.equal(r.custoRateado, 3000));
});

test('ratearIgualitario com zero lotes retorna array vazio', () => {
  const result = ratearIgualitario(5000, 0);
  assert.deepEqual(result, []);
});

test('ratearIgualitario soma aproximadamente igual ao custo total', () => {
  const result = ratearIgualitario(1000, 3);
  const soma = result.reduce((s, r) => s + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 1000) < 0.01, `soma esperada 1000, recebida ${soma}`);
});

test('ratearIgualitario com um lote recebe custo total', () => {
  const result = ratearIgualitario(7500, 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].custoRateado, 7500);
});
