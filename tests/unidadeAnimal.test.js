import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCapacidadeTotalUa,
  calcularDiagnosticoCapacidade,
  calcularUaPorAnimal,
  calcularUaPorLote,
  calcularUaTotalFazenda,
} from '../src/domain/unidadeAnimal.js';

test('calcularUaPorAnimal aplica formula UA = peso_vivo_kg / 450', () => {
  assert.equal(calcularUaPorAnimal(450), 1);
  assert.equal(calcularUaPorAnimal(225), 0.5);
});

test('calcularUaPorLote e calcularUaTotalFazenda agregam corretamente', () => {
  const animais = [
    { lote_id: 1, qtd: 10, p_at: 450 },
    { lote_id: 1, qtd: 5, p_at: 225 },
    { lote_id: 2, qtd: 4, p_at: 450 },
  ];

  assert.equal(calcularUaPorLote(animais, 1), 12.5);
  assert.equal(calcularUaPorLote(animais, 2), 4);
  assert.equal(calcularUaTotalFazenda(animais), 16.5);
});

test('calcularDiagnosticoCapacidade retorna saldo e status da capacidade', () => {
  const animais = [{ lote_id: 1, qtd: 20, p_at: 450 }];
  const pastagens = [{ area_ha: 10, capacidade_suporte_ua_ha: 1.5 }];

  const diagnostico = calcularDiagnosticoCapacidade({ animais, pastagens });

  assert.equal(calcularCapacidadeTotalUa(pastagens), 15);
  assert.equal(diagnostico.uaTotalFazenda, 20);
  assert.equal(diagnostico.saldoCapacidadeUa, -5);
  assert.equal(diagnostico.statusCapacidade, 'superlotado');
  assert.equal(diagnostico.superlotado, true);
});

