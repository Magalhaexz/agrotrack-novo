import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarDbPorFazenda } from './escopoFazenda.js';

function montarDb() {
  return {
    fazendas: [{ id: 1, nome: 'Boa Vista' }, { id: 2, nome: 'Santa Clara' }],
    lotes: [{ id: 10, faz_id: 1, nome: 'Bezerros 2026' }, { id: 20, faz_id: 2, nome: 'Nelore 01' }],
    animais: [{ id: 100, lote_id: 10 }, { id: 200, lote_id: 20 }],
    custos: [{ id: 100, lote_id: 10 }, { id: 200, lote_id: 20 }],
    pesagens: [{ id: 100, lote_id: 10 }, { id: 200, lote_id: 20 }],
    sanitario: [{ id: 100, lote_id: 10 }, { id: 200, lote_id: 20 }],
    tarefas: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }, { id: 3, fazenda_id: null }],
    movimentacoes_animais: [{ id: 100, lote_id: 10 }, { id: 200, lote_id: 20 }],
    estoque: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }, { id: 3, fazenda_id: null }],
    movimentacoes_estoque: [{ id: 1, item_estoque_id: 1 }, { id: 2, item_estoque_id: 2 }, { id: 3, item_estoque_id: 3 }],
    movimentacoes_financeiras: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    pastagens: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    rotinas: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    cenarios: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    alertas_tratativas: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    eventos_operacionais: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    consumo_suplementacao: [{ id: 1, fazenda_id: 1 }, { id: 2, fazenda_id: 2 }],
    funcionarios: [{ id: 1 }, { id: 2 }],
  };
}

test('sem fazenda ativa devolve o db sem alterações', () => {
  const db = montarDb();
  assert.strictEqual(filtrarDbPorFazenda(db, null), db);
});

test('recorta lotes, animais, custos, pesagens e sanidade pela fazenda ativa', () => {
  const resultado = filtrarDbPorFazenda(montarDb(), 1);
  assert.deepEqual(resultado.lotes.map((l) => l.id), [10]);
  assert.deepEqual(resultado.animais.map((a) => a.id), [100]);
  assert.deepEqual(resultado.custos.map((c) => c.id), [100]);
  assert.deepEqual(resultado.pesagens.map((p) => p.id), [100]);
  assert.deepEqual(resultado.sanitario.map((s) => s.id), [100]);
});

test('estoque e movimentações de estoque seguem a fazenda do item', () => {
  const resultado = filtrarDbPorFazenda(montarDb(), 2);
  assert.deepEqual(resultado.estoque.map((i) => i.id).sort(), [2, 3]); // item sem fazenda_id fica visível
  assert.deepEqual(resultado.movimentacoes_estoque.map((m) => m.id).sort(), [2, 3]);
});

test('registros sem fazenda_id (legado) continuam visíveis em qualquer fazenda', () => {
  const resultado = filtrarDbPorFazenda(montarDb(), 1);
  assert.ok(resultado.tarefas.some((t) => t.id === 1));
  assert.ok(resultado.tarefas.some((t) => t.id === 3));
  assert.ok(!resultado.tarefas.some((t) => t.id === 2));
});

test('tabelas com fazenda_id direto (pastagens, rotinas, cenarios, alertas_tratativas, eventos) são recortadas', () => {
  const resultado = filtrarDbPorFazenda(montarDb(), 2);
  assert.deepEqual(resultado.pastagens.map((p) => p.id), [2]);
  assert.deepEqual(resultado.rotinas.map((r) => r.id), [2]);
  assert.deepEqual(resultado.cenarios.map((c) => c.id), [2]);
  assert.deepEqual(resultado.alertas_tratativas.map((a) => a.id), [2]);
  assert.deepEqual(resultado.eventos_operacionais.map((e) => e.id), [2]);
});

test('fazendas e funcionarios (conta) nunca são filtrados', () => {
  const resultado = filtrarDbPorFazenda(montarDb(), 1);
  assert.equal(resultado.fazendas.length, 2);
  assert.equal(resultado.funcionarios.length, 2);
});
