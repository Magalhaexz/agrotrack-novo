import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverFazendaIdLancamento } from './financeiroLancamentoLogic.js';

test('usa a fazenda do lote quando um lote é escolhido, mesmo em modo consolidado', () => {
  const loteEscolhido = { id: 5, faz_id: 42 };
  const fazendaSelecionada = { id: null, todas: true };
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido, fazendaSelecionada }), 42);
});

test('cai para a fazenda ativa quando não há lote escolhido', () => {
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido: null, fazendaSelecionada: { id: 7 } }), 7);
});

test('devolve null (bloqueia) sem lote e em modo consolidado', () => {
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido: null, fazendaSelecionada: { id: null, todas: true } }), null);
});

test('devolve null sem lote e sem fazenda selecionada', () => {
  assert.equal(resolverFazendaIdLancamento({}), null);
});
