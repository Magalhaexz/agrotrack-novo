import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hojeLocalISO } from './dataCivil.js';

test('hojeLocalISO retorna o dia civil de America/Sao_Paulo, nao o dia UTC', () => {
  // 2026-01-15T23:30:00Z = 2026-01-15T20:30:00-03:00 -> mesmo dia UTC e local
  assert.equal(hojeLocalISO(new Date('2026-01-15T23:30:00Z')), '2026-01-15');

  // 2026-01-16T02:30:00Z = 2026-01-15T23:30:00-03:00 -> UTC ja virou o dia
  // seguinte, mas em Sao Paulo ainda e o dia anterior (o bug que isso corrige)
  assert.equal(hojeLocalISO(new Date('2026-01-16T02:30:00Z')), '2026-01-15');

  // Virada de mes/ano tambem deve respeitar o fuso local
  assert.equal(hojeLocalISO(new Date('2026-01-01T02:00:00Z')), '2025-12-31');
});

test('hojeLocalISO formata sempre com dois digitos', () => {
  assert.equal(hojeLocalISO(new Date('2026-03-05T12:00:00Z')), '2026-03-05');
});
