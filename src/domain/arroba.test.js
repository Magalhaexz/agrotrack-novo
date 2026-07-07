import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularIndicadoresArroba,
  normalizarRendimentoCarcaca,
  calcularArrobasPesoVivo,
  calcularArrobasCarcaca,
  calcularArrobasGanho,
  calcularCustoPorArrobaCarcaca,
  calcularLucroPorArrobaCarcaca,
  calcularPrecoVendaPorArrobaCarcaca,
} from './arroba.js';

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

// ── Sprint 14 — fonte única de cálculo de arroba (docs/DECISAO_CALCULO_ARROBA_HERDON.md) ──

test('normalizarRendimentoCarcaca aceita 52 (percentual) e 0.52 (fração) com o mesmo resultado', () => {
  assert.equal(normalizarRendimentoCarcaca(52), 0.52);
  assert.equal(normalizarRendimentoCarcaca(0.52), 0.52);
});

test('normalizarRendimentoCarcaca cai no padrão de mercado (52%) quando o valor é nulo/zero/inválido', () => {
  assert.equal(normalizarRendimentoCarcaca(null), 0.52);
  assert.equal(normalizarRendimentoCarcaca(undefined), 0.52);
  assert.equal(normalizarRendimentoCarcaca(0), 0.52);
  assert.equal(normalizarRendimentoCarcaca('abc'), 0.52);
  assert.equal(normalizarRendimentoCarcaca(-10), 0.52);
});

test('calcularArrobasPesoVivo: 450 kg = 30 arrobas', () => {
  assert.equal(calcularArrobasPesoVivo(450), 30);
});

test('calcularArrobasPesoVivo retorna 0 sem quebrar com peso nulo', () => {
  assert.equal(calcularArrobasPesoVivo(null), 0);
});

test('calcularArrobasCarcaca: 450 kg com 50% de rendimento = 15 arrobas', () => {
  assert.equal(calcularArrobasCarcaca(450, 50), 15);
});

test('calcularArrobasCarcaca: rendimento 50 e 0.5 produzem o mesmo resultado', () => {
  const comPercentual = calcularArrobasCarcaca(450, 50);
  const comFracao = calcularArrobasCarcaca(450, 0.5);
  assert.equal(comPercentual, comFracao);
});

test('calcularArrobasCarcaca não quebra com peso ausente e cai no rendimento padrão sem ele', () => {
  assert.equal(calcularArrobasCarcaca(null, 52), 0);
  assert.equal(calcularArrobasCarcaca(450, null), calcularArrobasCarcaca(450, 52)); // cai no padrão 52%
});

test('calcularArrobasGanho: 300kg -> 450kg com 50% de rendimento', () => {
  // ganho de 150kg * 0.5 / 15 = 5 arrobas
  assert.equal(calcularArrobasGanho(300, 450, 50), 5);
});

test('calcularArrobasGanho não quebra com peso nulo', () => {
  assert.equal(calcularArrobasGanho(null, null, 52), 0);
});

test('calcularCustoPorArrobaCarcaca divide custo total pelas arrobas de carcaça', () => {
  // arrobasCarcaca = 450 * 0.5 / 15 = 15 -> custo/@ = 15000/15 = 1000
  assert.equal(calcularCustoPorArrobaCarcaca(15000, 450, 50), 1000);
});

test('calcularLucroPorArrobaCarcaca usa a MESMA base de calcularCustoPorArrobaCarcaca', () => {
  const custoPorArroba = calcularCustoPorArrobaCarcaca(15000, 450, 50);
  const lucroPorArroba = calcularLucroPorArrobaCarcaca(6000, 450, 50);
  // Mesmo peso/rendimento -> mesma quantidade de arrobas no denominador dos dois.
  assert.equal(15000 / custoPorArroba, 6000 / lucroPorArroba);
});

test('calcularPrecoVendaPorArrobaCarcaca divide receita pelas arrobas de carcaça', () => {
  assert.equal(calcularPrecoVendaPorArrobaCarcaca(4500, 450, 50), 300);
});

test('custo/lucro/preço por arroba de carcaça nunca retornam NaN/Infinity com arrobas zero', () => {
  assert.equal(calcularCustoPorArrobaCarcaca(1000, 0, 52), 0);
  assert.equal(calcularLucroPorArrobaCarcaca(1000, 0, 52), 0);
  assert.equal(calcularPrecoVendaPorArrobaCarcaca(1000, 0, 52), 0);
});

