import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemEhNutricao } from './estoqueLogic.js';

test('categoria explicita nao-nutricao vence heuristico de nome (bug bash BB-02)', () => {
  assert.equal(itemEhNutricao({ categoria: 'Medicamento', produto: 'Sal Mineral' }), false);
  assert.equal(itemEhNutricao({ categoria: 'Vacina', produto: 'Dieta Concentrada' }), false);
});

test('categoria explicita de nutricao classifica como nutricao', () => {
  assert.equal(itemEhNutricao({ categoria: 'Suplemento', produto: 'Ração 18%' }), true);
});

test('metadata.modulo=nutricao (fluxo de Suplementação) sempre vence', () => {
  assert.equal(itemEhNutricao({ categoria: 'Medicamento', metadata: { modulo: 'nutricao' } }), true);
});

test('sem categoria, cai no heuristico por nome (dado legado)', () => {
  assert.equal(itemEhNutricao({ produto: 'Sal Mineral' }), true);
  assert.equal(itemEhNutricao({ produto: 'Seringa descartável' }), false);
});
