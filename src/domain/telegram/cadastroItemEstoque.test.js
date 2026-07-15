import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararCadastroItemEstoque } from './cadastroItemEstoque.js';

test('cadastra item novo com defaults', () => {
  const r = prepararCadastroItemEstoque({}, { nome: 'Sal Mineral 90' });
  assert.equal(r.ok, true);
  const reg = r.writes[0].registro;
  assert.equal(reg.produto, 'Sal Mineral 90');
  assert.equal(reg.nome, 'Sal Mineral 90');
  assert.equal(reg.categoria, 'Outro');
  assert.equal(reg.unidade, 'un');
  assert.equal(reg.unidade_medida, 'un');
  assert.equal(reg.quantidade_atual, 0);
  assert.equal(reg.quantidade, 0);
});

test('nome vazio é rejeitado', () => {
  const r = prepararCadastroItemEstoque({}, { nome: '  ' });
  assert.equal(r.erro, 'NOME_VAZIO');
});

test('quantidade e custo negativos são rejeitados', () => {
  assert.equal(prepararCadastroItemEstoque({}, { nome: 'X', quantidade_inicial: -1 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararCadastroItemEstoque({}, { nome: 'X', custo_unitario: -1 }).erro, 'CUSTO_INVALIDO');
});

test('duplica os pares de coluna produto/nome, unidade/unidade_medida, valor/custo/preco unitário', () => {
  const r = prepararCadastroItemEstoque({}, { nome: 'Ração', unidade: 'sacos', quantidade_inicial: 20, custo_unitario: 90 });
  const reg = r.writes[0].registro;
  assert.equal(reg.valor_unitario, 90);
  assert.equal(reg.preco_unitario, 90);
  assert.equal(reg.custo_unitario, 90);
  assert.equal(reg.valor_total, 1800);
  assert.equal(reg.unidade, 'sacos');
  assert.equal(reg.unidade_medida, 'sacos');
});

test('categoria fora do enum de estoque geral cai em Outro', () => {
  const r = prepararCadastroItemEstoque({}, { nome: 'X', categoria: 'algo-nao-listado' });
  assert.equal(r.writes[0].registro.categoria, 'Outro');
});

test('categoria válida é preservada', () => {
  const r = prepararCadastroItemEstoque({}, { nome: 'Vacina Febre Aftosa', categoria: 'Vacina' });
  assert.equal(r.writes[0].registro.categoria, 'Vacina');
});
