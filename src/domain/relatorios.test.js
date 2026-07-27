import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelatorioPesagens } from './relatorios.js';

// Sprint Funcional 15: pesagens individuais por cabeça (tipo:'animal') nunca
// podem aparecer no relatório por lote — só a pesagem agregada (tipo:'lote')
// representa a média oficial. Regressão do vazamento encontrado na auditoria
// (buildRelatorioPesagens não filtrava por tipo antes desta sprint).
test('buildRelatorioPesagens ignora pesagens individuais de animal, só usa a média oficial do lote', () => {
  const db = {
    lotes: [{ id: 10, nome: 'Lote 10', qtd: 3 }],
    pesagens: [
      { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300, tipo: 'lote' },
      { id: 2, lote_id: 10, data: '2026-07-01', peso_medio: 999, tipo: 'animal', animal_id: 'a1' },
      { id: 3, lote_id: 10, data: '2026-07-10', peso_medio: 320, tipo: 'lote' },
    ],
  };

  const linhas = buildRelatorioPesagens(db, { loteId: 10 });

  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((linha) => linha.pesoMedio !== 999));
  assert.deepEqual(linhas.map((linha) => linha.pesoMedio).sort((a, b) => a - b), [300, 320]);
});

test('buildRelatorioPesagens retorna vazio quando só existem pesagens individuais (sem agregada)', () => {
  const db = {
    lotes: [{ id: 10, nome: 'Lote 10', qtd: 3 }],
    pesagens: [
      { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300, tipo: 'animal', animal_id: 'a1' },
      { id: 2, lote_id: 10, data: '2026-07-01', peso_medio: 320, tipo: 'animal', animal_id: 'a2' },
    ],
  };

  const linhas = buildRelatorioPesagens(db, { loteId: 10 });
  assert.deepEqual(linhas, []);
});
