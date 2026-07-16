import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTipoPesagem,
  resolverUltimaPesagemLote,
  recalcularPesoAtualLote,
  calculateAverageGmdByLote,
} from './pesagensLote.js';

test('resolveTipoPesagem distingue lote de animal', () => {
  assert.equal(resolveTipoPesagem({ tipo: 'animal' }), 'animal');
  assert.equal(resolveTipoPesagem({ origem: 'animal' }), 'animal');
  assert.equal(resolveTipoPesagem({}), 'lote');
  assert.equal(resolveTipoPesagem({ tipo: 'lote' }), 'lote');
});

test('resolverUltimaPesagemLote pega a mais recente por data, empate por id maior', () => {
  const pesagens = [
    { id: 1, data: '2026-07-01', peso_medio: 300 },
    { id: 2, data: '2026-07-10', peso_medio: 320 },
    { id: 3, data: '2026-07-10', peso_medio: 325 },
  ];
  const r = resolverUltimaPesagemLote(pesagens);
  assert.equal(r.id, 3);
});

test('resolverUltimaPesagemLote retorna null para lista vazia', () => {
  assert.equal(resolverUltimaPesagemLote([]), null);
});

test('recalcularPesoAtualLote usa a última pesagem de lote', () => {
  const db = { animais: [] };
  const pesagens = [
    { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
  ];
  const r = recalcularPesoAtualLote(db, 10, pesagens);
  assert.equal(r.pesoAtual, 320);
  assert.equal(r.ultimaPesagem, '2026-07-10');
});

test('recalcularPesoAtualLote cai para média de animais quando não há pesagem de lote', () => {
  const db = { animais: [{ lote_id: 10, qtd: 2, p_at: 300 }, { lote_id: 10, qtd: 2, p_at: 340 }] };
  const r = recalcularPesoAtualLote(db, 10, []);
  assert.equal(r.pesoAtual, 320);
  assert.equal(r.ultimaPesagem, null);
});

test('recalcularPesoAtualLote ignora pesagens de outros lotes e de animal individual', () => {
  const db = { animais: [] };
  const pesagens = [
    { id: 1, lote_id: 99, data: '2026-07-15', peso_medio: 999 },
    { id: 2, lote_id: 10, tipo: 'animal', data: '2026-07-14', peso_medio: 111 },
    { id: 3, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
  ];
  const r = recalcularPesoAtualLote(db, 10, pesagens);
  assert.equal(r.pesoAtual, 300);
});

test('calculateAverageGmdByLote calcula ganho médio diário entre primeira e última pesagem', () => {
  const pesagens = [
    { lote_id: 1, data: '2026-07-01', peso_medio: 300 },
    { lote_id: 1, data: '2026-07-11', peso_medio: 310 },
  ];
  const gmd = calculateAverageGmdByLote(pesagens);
  assert.equal(gmd, 1);
});

test('calculateAverageGmdByLote retorna null sem pesagens suficientes', () => {
  assert.equal(calculateAverageGmdByLote([]), null);
  assert.equal(calculateAverageGmdByLote([{ lote_id: 1, data: '2026-07-01', peso_medio: 300 }]), null);
});
