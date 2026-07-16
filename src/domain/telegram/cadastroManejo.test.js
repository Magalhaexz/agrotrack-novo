import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroManejo } from './cadastroManejo.js';

function db() {
  return {
    lotes: [{ id: 1, nome: 'Recria', status: 'ativo' }, { id: 2, nome: 'Encerrado', status: 'encerrado' }],
    estoque: [
      { id: 100, produto: 'Ivermectina', quantidade_atual: 50 },
      { id: 101, produto: 'Vermífugo B', quantidade_atual: 2 },
    ],
  };
}

test('registra manejo mínimo sem produto vinculado', () => {
  const r = prepararCadastroManejo(db(), { lote: 'Recria', tipo: 'vacina', quantidade_animais: 30, data: '2026-07-15' });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'sanitario');
  assert.equal(r.writes[0].registro.lote_id, 1);
  assert.equal(r.writes[0].registro.tipo, 'vacina');
  assert.equal(r.writes[0].registro.qtd, 30);
  assert.equal(r.writes[0].registro.metadata.item_estoque_id, null);
});

test('baixa estoque quando produto e saldo suficientes', () => {
  const r = prepararCadastroManejo(db(), {
    lote: 'Recria', tipo: 'vermifugo', quantidade_animais: 20, produto: 'Ivermectina', quantidade_produto: 10,
  });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 3);
  const sanitario = r.writes.find((w) => w.tabela === 'sanitario');
  assert.equal(sanitario.registro.metadata.item_estoque_id, 100);
  assert.equal(sanitario.registro.metadata.quantidade_utilizada, 10);
  const estoqueUpdate = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(estoqueUpdate.patch.quantidade_atual, 40);
  const movEstoque = r.writes.find((w) => w.tabela === 'movimentacoes_estoque');
  assert.equal(movEstoque.registro.quantidade, 10);
});

test('saldo insuficiente não bloqueia o manejo, só pula a baixa e avisa', () => {
  const r = prepararCadastroManejo(db(), {
    lote: 'Recria', tipo: 'vermifugo', quantidade_animais: 5, produto: 'Vermífugo B', quantidade_produto: 100,
  });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'sanitario');
  assert.ok(r.resumo.some((l) => /Estoque insuficiente/.test(l)));
});

test('rejeita quantidade inválida, lote inexistente/bloqueado e produto inexistente', () => {
  assert.equal(prepararCadastroManejo(db(), { lote: 'Recria', tipo: 'vacina', quantidade_animais: 0 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararCadastroManejo(db(), { lote: 'Inexistente', tipo: 'vacina', quantidade_animais: 10 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararCadastroManejo(db(), { lote: 'Encerrado', tipo: 'vacina', quantidade_animais: 10 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararCadastroManejo(db(), { lote: 'Recria', tipo: 'vacina', quantidade_animais: 10, produto: 'Inexistente' }).erro, 'ITEM_NAO_ENCONTRADO');
});
