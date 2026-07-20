import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectarLotesOrfaos,
  detectarRegistrosSemFazenda,
  resumirProblemasIntegridade,
  detectarDivergenciaQuantidadeLote,
  detectarAnimalEmLoteEncerrado,
  detectarAnimalSemLote,
  detectarVendaSemReceita,
  detectarMorteComReceita,
  resumirDivergenciasOperacionais,
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

// ── Onda A: reconciliação lote.qtd × animais ativos ─────────────────────────

test('detectarDivergenciaQuantidadeLote: db saudável (grupo + individual ativo) não diverge', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', qtd: 51 }],
    animais: [
      { id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 50 },
      { id: 2, lote_id: 1, tipo_registro: 'individual', qtd: 1, status: 'ativo' },
    ],
  };
  assert.equal(detectarDivergenciaQuantidadeLote(db).length, 0);
});

test('detectarDivergenciaQuantidadeLote: acha lote cujo qtd não bate com a soma de animais ativos', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', qtd: 50 }],
    animais: [{ id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 40 }],
  };
  const divergencias = detectarDivergenciaQuantidadeLote(db);
  assert.equal(divergencias.length, 1);
  assert.equal(divergencias[0].qtdLote, 50);
  assert.equal(divergencias[0].qtdAnimaisAtivos, 40);
});

test('detectarDivergenciaQuantidadeLote: animal individual já vendido não conta mais na soma', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', qtd: 49 }],
    animais: [
      { id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 49 },
      { id: 2, lote_id: 1, tipo_registro: 'individual', qtd: 1, status: 'vendido' },
    ],
  };
  assert.equal(detectarDivergenciaQuantidadeLote(db).length, 0);
});

test('detectarDivergenciaQuantidadeLote: ignora lote sem qtd definido (legado)', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A' }],
    animais: [{ id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 999 }],
  };
  assert.equal(detectarDivergenciaQuantidadeLote(db).length, 0);
});

test('detectarAnimalEmLoteEncerrado: acha grupo e individual ativos num lote vendido/encerrado', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', status: 'vendido' }, { id: 2, nome: 'Lote B', status: 'ativo' }],
    animais: [
      { id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 10 },
      { id: 2, lote_id: 1, tipo_registro: 'individual', status: 'ativo' },
      { id: 3, lote_id: 2, tipo_registro: 'grupo', qtd: 5 },
    ],
  };
  const res = detectarAnimalEmLoteEncerrado(db);
  assert.equal(res.length, 2);
  assert.deepEqual(res.map((a) => a.id).sort(), [1, 2]);
});

test('detectarAnimalEmLoteEncerrado: não conta grupo com qtd 0 nem individual já inativo', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', status: 'finalizado' }],
    animais: [
      { id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 0 },
      { id: 2, lote_id: 1, tipo_registro: 'individual', status: 'vendido' },
    ],
  };
  assert.equal(detectarAnimalEmLoteEncerrado(db).length, 0);
});

test('detectarAnimalSemLote: acha individual ativo sem lote_id', () => {
  const db = {
    animais: [
      { id: 1, tipo_registro: 'individual', status: 'ativo', lote_id: null },
      { id: 2, tipo_registro: 'individual', status: 'ativo', lote_id: 1 },
      { id: 3, tipo_registro: 'individual', status: 'vendido', lote_id: null },
    ],
  };
  const res = detectarAnimalSemLote(db);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 1);
});

test('detectarVendaSemReceita: acha venda com valor sem lançamento financeiro vinculado', () => {
  const db = {
    movimentacoes_animais: [{ id: 10, tipo: 'venda', valor_total: 3000 }],
    movimentacoes_financeiras: [],
  };
  const res = detectarVendaSemReceita(db);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 10);
});

test('detectarVendaSemReceita: não marca venda com valor 0 (doação/sem receita esperada) nem venda com receita presente', () => {
  const db = {
    movimentacoes_animais: [
      { id: 10, tipo: 'venda', valor_total: 0 },
      { id: 11, tipo: 'venda', valor_total: 3000 },
    ],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'receita', origem_tipo: 'movimentacao_animal', origem_id: 11 },
    ],
  };
  assert.equal(detectarVendaSemReceita(db).length, 0);
});

test('detectarMorteComReceita: acha morte com receita indevidamente vinculada', () => {
  const db = {
    movimentacoes_animais: [{ id: 20, tipo: 'morte' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'receita', origem_tipo: 'movimentacao_animal', origem_id: 20 },
    ],
  };
  const res = detectarMorteComReceita(db);
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 20);
});

test('resumirDivergenciasOperacionais: db saudável não tem problemas', () => {
  const resumo = resumirDivergenciasOperacionais({});
  assert.equal(resumo.temProblemas, false);
  assert.equal(resumo.total, 0);
  assert.equal(resumo.mensagem, null);
});

test('resumirDivergenciasOperacionais: soma todos os tipos de divergência', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote A', qtd: 50 }],
    animais: [{ id: 1, lote_id: 1, tipo_registro: 'grupo', qtd: 40 }],
    movimentacoes_animais: [{ id: 10, tipo: 'venda', valor_total: 3000 }],
    movimentacoes_financeiras: [],
  };
  const resumo = resumirDivergenciasOperacionais(db);
  assert.equal(resumo.temProblemas, true);
  assert.equal(resumo.porTipo.lotes_qtd_divergente, 1);
  assert.equal(resumo.porTipo.vendas_sem_receita, 1);
  assert.ok(resumo.total >= 2);
});
