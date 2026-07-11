import test from 'node:test';
import assert from 'node:assert/strict';
import { LOTE_ACOES } from './loteAcoesConfig.js';

// Fonte única do menu de ações do lote (Seção 2 do sprint de fechamento) —
// garante que LoteCard e LoteDetailsPanel nunca voltem a divergir (bug 1.1/1.4).
test('LOTE_ACOES tem exatamente as 7 ações do menu padronizado, na ordem', () => {
  assert.deepEqual(
    LOTE_ACOES.map((a) => a.id),
    ['editar', 'ajusteLotacao', 'venda', 'mortePerda', 'transferenciaSaida', 'trocarPasto', 'finalizar']
  );
});

test('cada ação tem identificador, label, ícone, permissão, condição e handler', () => {
  for (const acao of LOTE_ACOES) {
    assert.ok(acao.id, `ação sem id: ${JSON.stringify(acao)}`);
    assert.ok(acao.label, `ação ${acao.id} sem label`);
    assert.ok(acao.icon, `ação ${acao.id} sem ícone`);
    assert.ok(acao.permissao, `ação ${acao.id} sem permissão`);
    assert.equal(typeof acao.bloqueadoPor, 'function', `ação ${acao.id} sem condição de disponibilidade`);
    assert.ok(acao.handlerKey, `ação ${acao.id} sem handlerKey`);
  }
});

test('bloqueadoPor desabilita quando o lote está bloqueado (encerrado/vendido)', () => {
  for (const acao of LOTE_ACOES) {
    assert.equal(acao.bloqueadoPor({ bloqueado: true }), true, acao.id);
    assert.equal(acao.bloqueadoPor({ bloqueado: false }), false, acao.id);
  }
});

test('rótulo de finalizar não repete o bug 1.4 ("Trocar lote")', () => {
  const finalizar = LOTE_ACOES.find((a) => a.id === 'finalizar');
  assert.equal(finalizar.label, 'Finalizar lote');
  assert.notEqual(finalizar.label, 'Trocar lote');
});

test('ações de movimentação usam permissao animais:movimentar; edição/estruturais usam lotes:editar', () => {
  const movimentacao = ['venda', 'mortePerda', 'transferenciaSaida'];
  const estrutural = ['editar', 'ajusteLotacao', 'trocarPasto', 'finalizar'];
  LOTE_ACOES.filter((a) => movimentacao.includes(a.id)).forEach((a) => assert.equal(a.permissao, 'animais:movimentar', a.id));
  LOTE_ACOES.filter((a) => estrutural.includes(a.id)).forEach((a) => assert.equal(a.permissao, 'lotes:editar', a.id));
});
