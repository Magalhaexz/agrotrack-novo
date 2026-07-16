import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararEdicaoPesagem, prepararExclusaoPesagem } from './cadastroPesagem.js';

function db() {
  return {
    lotes: [
      { id: 10, nome: 'Recria', status: 'ativo' },
      { id: 11, nome: 'Encerrado', status: 'encerrado' },
    ],
    pesagens: [
      { id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 },
      { id: 2, lote_id: 10, data: '2026-07-10', peso_medio: 320 },
    ],
    animais: [],
  };
}

test('edita a pesagem mais recente do lote e recalcula o peso atual', () => {
  const r = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405 });
  assert.equal(r.ok, true);
  const pesagemUpdate = r.writes.find((w) => w.tabela === 'pesagens');
  assert.equal(pesagemUpdate.match.id, 2);
  assert.equal(pesagemUpdate.patch.peso_medio, 405);
  const loteUpdate = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(loteUpdate.patch.p_at, 405);
  assert.equal(loteUpdate.patch.ultima_pesagem, '2026-07-10');
});

test('edição preserva a data quando não informada e aceita nova data', () => {
  const semData = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405 });
  assert.equal(semData.writes[0].patch.data, '2026-07-10');
  const comData = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405, data: '2026-07-12' });
  assert.equal(comData.writes[0].patch.data, '2026-07-12');
});

test('edição rejeita peso inválido, lote inexistente/bloqueado e lote sem pesagem', () => {
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 0 }).erro, 'PESO_INVALIDO');
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Inexistente', peso: 400 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Encerrado', peso: 400 }).erro, 'LOTE_NAO_ENCONTRADO');
  const dbSemPesagem = { ...db(), pesagens: [] };
  assert.equal(prepararEdicaoPesagem(dbSemPesagem, { lote: 'Recria', peso: 400 }).erro, 'PESAGEM_NAO_ENCONTRADA');
});

test('exclui a pesagem mais recente e recalcula para a pesagem restante', () => {
  const r = prepararExclusaoPesagem(db(), { lote: 'Recria' });
  assert.equal(r.ok, true);
  const del = r.writes.find((w) => w.tabela === 'pesagens');
  assert.equal(del.tipo, 'delete');
  assert.equal(del.match.id, 2);
  const loteUpdate = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(loteUpdate.patch.p_at, 300);
  assert.equal(loteUpdate.patch.ultima_pesagem, '2026-07-01');
});

test('exclusão da única pesagem deixa o lote sem última pesagem (fallback de animais)', () => {
  const dbUmaPesagem = { ...db(), pesagens: [{ id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 }] };
  const r = prepararExclusaoPesagem(dbUmaPesagem, { lote: 'Recria' });
  assert.equal(r.ok, true);
  const loteUpdate = r.writes.find((w) => w.tabela === 'lotes');
  assert.equal(loteUpdate.patch.p_at, 0);
  assert.equal(loteUpdate.patch.ultima_pesagem, null);
});

test('exclusão rejeita lote inexistente/bloqueado e lote sem pesagem', () => {
  assert.equal(prepararExclusaoPesagem(db(), { lote: 'Inexistente' }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararExclusaoPesagem(db(), { lote: 'Encerrado' }).erro, 'LOTE_NAO_ENCONTRADO');
  const dbSemPesagem = { ...db(), pesagens: [] };
  assert.equal(prepararExclusaoPesagem(dbSemPesagem, { lote: 'Recria' }).erro, 'PESAGEM_NAO_ENCONTRADA');
});
