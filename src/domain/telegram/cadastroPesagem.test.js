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

test('edita a pesagem mais recente do lote (via RPC transacional)', () => {
  const r = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405 });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.nome, 'editar_ultima_pesagem_lote');
  assert.equal(r.rpc.params.p_pesagem_id, 2);
  assert.equal(r.rpc.params.p_novo_peso, 405);
  assert.equal(r.rpc.params.p_nova_data, '2026-07-10');
});

test('edição preserva a data quando não informada e aceita nova data', () => {
  const semData = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405 });
  assert.equal(semData.rpc.params.p_nova_data, '2026-07-10');
  const comData = prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 405, data: '2026-07-12' });
  assert.equal(comData.rpc.params.p_nova_data, '2026-07-12');
});

test('edição rejeita peso inválido, lote inexistente/bloqueado e lote sem pesagem', () => {
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Recria', peso: 0 }).erro, 'PESO_INVALIDO');
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Inexistente', peso: 400 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararEdicaoPesagem(db(), { lote: 'Encerrado', peso: 400 }).erro, 'LOTE_NAO_ENCONTRADO');
  const dbSemPesagem = { ...db(), pesagens: [] };
  assert.equal(prepararEdicaoPesagem(dbSemPesagem, { lote: 'Recria', peso: 400 }).erro, 'PESAGEM_NAO_ENCONTRADA');
});

test('exclui a pesagem mais recente e mostra a próxima como nova última no resumo (via RPC transacional)', () => {
  const r = prepararExclusaoPesagem(db(), { lote: 'Recria' });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.nome, 'excluir_ultima_pesagem_lote');
  assert.equal(r.rpc.params.p_pesagem_id, 2);
  assert.ok(r.resumo.some((l) => /Nova última pesagem: 2026-07-01/.test(l)));
});

test('exclusão da única pesagem avisa que o lote fica sem pesagem (recálculo real é feito pela RPC)', () => {
  const dbUmaPesagem = { ...db(), pesagens: [{ id: 1, lote_id: 10, data: '2026-07-01', peso_medio: 300 }] };
  const r = prepararExclusaoPesagem(dbUmaPesagem, { lote: 'Recria' });
  assert.equal(r.ok, true);
  assert.equal(r.rpc.params.p_pesagem_id, 1);
  assert.ok(r.resumo.some((l) => /sem nenhuma pesagem registrada/.test(l)));
});

test('exclusão rejeita lote inexistente/bloqueado e lote sem pesagem', () => {
  assert.equal(prepararExclusaoPesagem(db(), { lote: 'Inexistente' }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararExclusaoPesagem(db(), { lote: 'Encerrado' }).erro, 'LOTE_NAO_ENCONTRADO');
  const dbSemPesagem = { ...db(), pesagens: [] };
  assert.equal(prepararExclusaoPesagem(dbSemPesagem, { lote: 'Recria' }).erro, 'PESAGEM_NAO_ENCONTRADA');
});
