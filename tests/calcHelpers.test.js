import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysToDate,
  calculateConsumptionCost,
  calculateDailyConsumptionKg,
  calculateEstimatedDays,
  daysBetween,
  parseMoedaBRL,
  toNumber,
} from '../src/domain/calcHelpers.js';
import {
  calcularCapacidadeTotalUa,
  calcularUaPorAnimal,
} from '../src/domain/unidadeAnimal.js';

test('calc helpers: parseia numeros em pt-BR e invalido vira zero', () => {
  assert.equal(toNumber('1.234,56'), 1234.56);
  assert.equal(toNumber('1,234.56'), 1234.56);
  assert.equal(toNumber('2,5'), 2.5);
  assert.equal(toNumber('texto'), 0);
});

test('calc helpers: dias estimados e data prevista usam a formula esperada', () => {
  assert.equal(calculateEstimatedDays('320', '520', '1,25'), 160);
  assert.equal(addDaysToDate('2026-01-01', 160), '2026-06-10');
  assert.equal(addDaysToDate('2026-01-01', -10), '2025-12-22');
  assert.equal(addDaysToDate('data-invalida', 10), '');
});

test('calc helpers: consumo e custo usam peso medio e percentual com seguranca', () => {
  assert.equal(
    calculateDailyConsumptionKg({
      mode: 'percentual_pv',
      heads: '10',
      pesoInicial: '320',
      pesoFinal: '520',
      percentualPv: '2',
      kgPorCabeca: '8,5',
    }),
    84
  );
  assert.equal(
    calculateDailyConsumptionKg({
      mode: 'kg_cab_dia',
      heads: '10',
      pesoInicial: '320',
      pesoFinal: '520',
      percentualPv: '2',
      kgPorCabeca: '8,5',
    }),
    85
  );
  assert.equal(calculateConsumptionCost('84', '2,50'), 210);
});

test('calc helpers: UA e capacidade tratam strings e valores ausentes', () => {
  assert.equal(calcularUaPorAnimal('450'), 1);
  assert.equal(
    calcularCapacidadeTotalUa([{ area_ha: '10,5', capacidade_suporte_ua_ha: '1,5' }]),
    15.75
  );
});

test('calc helpers: dias entre datas eh seguro para entradas invalidas', () => {
  assert.equal(daysBetween('2026-01-01', '2026-01-10'), 9);
  assert.equal(daysBetween('data-invalida', '2026-01-10'), 0);
});

test('parseMoedaBRL: ponto isolado eh sempre separador de milhar (P1-12)', () => {
  assert.equal(parseMoedaBRL('250.000'), 250000);
  assert.equal(parseMoedaBRL('250.000,00'), 250000);
  assert.equal(parseMoedaBRL('250000'), 250000);
  assert.equal(parseMoedaBRL(250000), 250000);
  assert.equal(parseMoedaBRL('250,50'), 250.5);
  assert.equal(parseMoedaBRL('R$ 250.000,00'), 250000);
  assert.equal(parseMoedaBRL('1.234.567,89'), 1234567.89);
});

test('parseMoedaBRL: vazio, invalido e negativo nao quebram o calculo', () => {
  assert.equal(parseMoedaBRL(''), 0);
  assert.equal(parseMoedaBRL('   '), 0);
  assert.equal(parseMoedaBRL(null), 0);
  assert.equal(parseMoedaBRL(undefined), 0);
  assert.equal(parseMoedaBRL('texto'), 0);
  assert.equal(parseMoedaBRL('-150000'), -150000);
  assert.equal(parseMoedaBRL('-250.000,50'), -250000.5);
  assert.equal(Number.isFinite(parseMoedaBRL('abc.def')), true);
  assert.equal(Number.isFinite(parseMoedaBRL(Infinity)), true);
});
