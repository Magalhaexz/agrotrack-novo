import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndicadoresArroba } from './arroba.js';

test('calcularIndicadoresArroba calcula @ viva e @ carcaca com peso valido', () => {
  const result = calcularIndicadoresArroba({
    peso: 450,
    rendimento: 52,
    precoPorArroba: 300,
  });

  assert.equal(result.temPesoValido, true);
  assert.equal(result.arrobaViva, 30);
  assert.equal(result.arrobaCarcaca, 15.6);
  assert.equal(result.valorEstimado, 4680);
});

test('calcularIndicadoresArroba usa rendimento padrao quando rendimento invalido', () => {
  const result = calcularIndicadoresArroba({
    peso: 300,
    rendimento: '',
    precoPorArroba: 0,
  });

  assert.equal(result.temPesoValido, true);
  assert.equal(result.arrobaViva, 20);
  assert.equal(result.arrobaCarcaca, 10.4);
  assert.equal(result.valorEstimado, null);
});

test('calcularIndicadoresArroba retorna placeholders seguros quando peso ausente', () => {
  const result = calcularIndicadoresArroba({
    peso: '',
    rendimento: 52,
    precoPorArroba: 300,
  });

  assert.equal(result.temPesoValido, false);
  assert.equal(result.arrobaViva, null);
  assert.equal(result.arrobaCarcaca, null);
  assert.equal(result.valorEstimado, null);
});

