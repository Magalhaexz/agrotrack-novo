import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularDiasNoLote, daysBetween } from './calcHelpers.js';

// --- calcularDiasNoLote (F-03) ---

test('calcularDiasNoLote retorna dias corretos entre duas datas', () => {
  // jan/01 → abr/11: 31+28+31+10 = 100 dias
  assert.equal(calcularDiasNoLote('2025-01-01', '2025-04-11'), 100);
});

test('calcularDiasNoLote retorna 0 para dataEntrada inválida', () => {
  assert.equal(calcularDiasNoLote(null, '2025-04-11'), 0);
  assert.equal(calcularDiasNoLote('', '2025-04-11'), 0);
  assert.equal(calcularDiasNoLote(undefined, '2025-04-11'), 0);
});

test('calcularDiasNoLote retorna 0 para datas iguais', () => {
  assert.equal(calcularDiasNoLote('2025-06-15', '2025-06-15'), 0);
});

test('calcularDiasNoLote retorna 0 quando referência é anterior à entrada', () => {
  assert.equal(calcularDiasNoLote('2025-06-15', '2025-01-01'), 0);
});

test('calcularDiasNoLote usa data atual quando dataReferencia não fornecida', () => {
  const past = '2000-01-01';
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(calcularDiasNoLote(past), daysBetween(past, today));
});

test('calcularDiasNoLote 30 dias exatos', () => {
  assert.equal(calcularDiasNoLote('2025-03-01', '2025-03-31'), 30);
});
