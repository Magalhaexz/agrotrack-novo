import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectarLotesOrfaos,
  detectarRegistrosSemFazenda,
  resumirProblemasIntegridade,
} from './integridadeDados.js';

const dbOk = {
  fazendas: [{ id: 1, nome: 'F1' }, { id: 2, nome: 'F2' }],
  lotes: [
    { id: 10, nome: 'A', faz_id: 1 },
    { id: 11, nome: 'B', faz_id: 2 },
  ],
  custos: [{ id: 1, lote_id: 10, val: 100 }],
  pesagens: [{ id: 1, lote_id: 11 }],
  estoque: [{ id: 1, fazenda_id: 1 }],
  pastagens: [{ id: 1, fazenda_id: 2 }],
  tarefas: [{ id: 1, fazenda_id: 1 }],
  sanitario: [{ id: 1, lote_id: 10 }],
};

test('detectarLotesOrfaos: db saudável não tem lotes órfãos', () => {
  assert.equal(detectarLotesOrfaos(dbOk).length, 0);
});

test('detectarLotesOrfaos: acha lote sem faz_id', () => {
  const db = { ...dbOk, lotes: [...dbOk.lotes, { id: 99, nome: 'Órfão' }] };
  const orfaos = detectarLotesOrfaos(db);
  assert.equal(orfaos.length, 1);
  assert.equal(orfaos[0].id, 99);
});

test('detectarRegistrosSemFazenda: custo ancorado em lote órfão é marcado', () => {
  const db = {
    ...dbOk,
    lotes: [...dbOk.lotes, { id: 99, nome: 'Órfão' }],
    custos: [{ id: 1, lote_id: 10 }, { id: 2, lote_id: 99 }],
  };
  const res = detectarRegistrosSemFazenda(db);
  assert.equal(res.custos.length, 1);
  assert.equal(res.custos[0].id, 2);
});

test('detectarRegistrosSemFazenda: estoque sem fazenda_id é marcado', () => {
  const db = { ...dbOk, estoque: [{ id: 1, fazenda_id: 1 }, { id: 2 }] };
  const res = detectarRegistrosSemFazenda(db);
  assert.equal(res.estoque.length, 1);
  assert.equal(res.estoque[0].id, 2);
});

test('detectarRegistrosSemFazenda: custo sem lote_id é marcado', () => {
  const db = { ...dbOk, custos: [{ id: 1, lote_id: 10 }, { id: 2 }] };
  const res = detectarRegistrosSemFazenda(db);
  assert.equal(res.custos.some((c) => c.id === 2), true);
});

test('resumirProblemasIntegridade: db saudável não tem problemas', () => {
  const resumo = resumirProblemasIntegridade(dbOk);
  assert.equal(resumo.temProblemas, false);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.mensagem, null);
});

test('resumirProblemasIntegridade: soma e mensagem com órfãos', () => {
  const db = {
    ...dbOk,
    lotes: [...dbOk.lotes, { id: 99, nome: 'Órfão' }],
    custos: [{ id: 2, lote_id: 99 }],
    estoque: [{ id: 2 }],
  };
  const resumo = resumirProblemasIntegridade(db);
  assert.equal(resumo.temProblemas, true);
  assert.equal(resumo.porTabela.lotes, 1);
  assert.equal(resumo.porTabela.custos, 1);
  assert.equal(resumo.porTabela.estoque, 1);
  assert.ok(resumo.total >= 3);
  assert.match(resumo.mensagem, /sem fazenda vinculada/i);
});

test('funções são tolerantes a db vazio/nulo', () => {
  assert.equal(detectarLotesOrfaos(null).length, 0);
  assert.equal(resumirProblemasIntegridade({}).temProblemas, false);
  const res = detectarRegistrosSemFazenda(undefined);
  assert.equal(res.custos.length, 0);
});
