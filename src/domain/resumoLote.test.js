import test from 'node:test';
import assert from 'node:assert/strict';
import { getResumoLote } from './resumoLote.js';

function makeDb({ animais = [], movimentacoes = [], custos = [], lotes = [] } = {}) {
  return {
    animais,
    movimentacoes_financeiras: movimentacoes,
    custos,
    lotes,
  };
}

function makeLote(overrides = {}) {
  return {
    id: 1,
    nome: 'Lote Teste',
    entrada: '2025-01-01',
    rendimento_carcaca: '52',
    preco_arroba: '270',
    ...overrides,
  };
}

function makeAnimal(overrides = {}) {
  return {
    id: '1',
    lote_id: 1,
    qtd: 10,
    p_ini: 300,
    p_at: 450,
    status: 'ativo',
    sexo: 'macho',
    ...overrides,
  };
}

function makeMov(overrides = {}) {
  return {
    id: '1',
    lote_id: 1,
    tipo: 'despesa',
    categoria: 'outros',
    valor: 1000,
    data: '2025-01-01',
    ...overrides,
  };
}

// ----------------------------------------------------------------
// Sprint 14 — getResumoLote: custoPorArroba e lucroPorArroba usam a MESMA
// base (arroba de carcaça), não bases diferentes (ganho vs. carcaça) como
// antes da consolidação. Ver docs/DECISAO_CALCULO_ARROBA_HERDON.md.
// ----------------------------------------------------------------

test('getResumoLote: custoPorArroba e lucroPorArroba usam a mesma base de arroba (carcaça)', () => {
  const db = makeDb({
    animais: [makeAnimal({ qtd: 10, p_ini: 300, p_at: 450 })],
    movimentacoes: [
      makeMov({ tipo: 'receita', valor: 100000 }),
      makeMov({ tipo: 'despesa', valor: 60000 }),
    ],
    lotes: [makeLote({ rendimento_carcaca: '52' })],
  });

  const resumo = getResumoLote(db, 1);

  // arrobasCarcaca = 10 * 450 * 0.52 / 15 = 156
  assert.equal(resumo.arrobasCarcaca, 156);
  assert.equal(resumo.custoPorArroba, 60000 / 156);
  assert.equal(resumo.lucroPorArroba, 40000 / 156);

  // A proporção custo/lucro deve bater com a proporção original de valores —
  // se os denominadores fossem diferentes (bug pré-Sprint 14), essa relação
  // não se sustentaria.
  assert.ok(Math.abs(resumo.custoPorArroba / resumo.lucroPorArroba - 60000 / 40000) < 0.0001);
});

test('getResumoLote: custoPorArroba não é mais calculado com base em arrobasProduzidas (arroba de ganho)', () => {
  const db = makeDb({
    // Ganho de peso (300->450) é menor que o peso total atual (450) usado na base carcaça,
    // então se o bug antigo (custoPorArroba = custoTotal/arrobasProduzidas) reaparecer,
    // este teste detecta a divergência.
    animais: [makeAnimal({ qtd: 10, p_ini: 300, p_at: 450 })],
    movimentacoes: [makeMov({ tipo: 'despesa', valor: 60000 })],
    lotes: [makeLote({ rendimento_carcaca: '52' })],
  });

  const resumo = getResumoLote(db, 1);
  const custoPorArrobaBasedOnGanho = 60000 / resumo.arrobasProduzidas;

  assert.notEqual(resumo.custoPorArroba, custoPorArrobaBasedOnGanho);
  assert.equal(resumo.custoPorArroba, 60000 / resumo.arrobasCarcaca);
});

test('getResumoLote não quebra (NaN/Infinity) quando não há animais', () => {
  const db = makeDb({ animais: [], movimentacoes: [] });
  const resumo = getResumoLote(db, 1);
  assert.equal(resumo.custoPorArroba, 0);
  assert.equal(resumo.lucroPorArroba, 0);
  assert.ok(Number.isFinite(resumo.custoPorArroba));
  assert.ok(Number.isFinite(resumo.lucroPorArroba));
});

// Seção 8 (auditoria lote.qtd) — lucroPorCabeca e custoPorCabeca devem usar a
// MESMA base (lote.qtd, fonte canônica), mesmo quando animais.qtd diverge
// (ex.: após venda que ainda não sincronizou o grupo de animais).
test('getResumoLote: lucroPorCabeca e custoPorCabeca usam lote.qtd quando diverge de animais.qtd', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 40 })], // após venda de 10 de um total de 50
    animais: [makeAnimal({ lote_id: 1, qtd: 50, p_ini: 300, p_at: 400 })],
    custos: [{ lote_id: 1, val: 4000 }],
    movimentacoes: [{ tipo: 'receita', lote_id: 1, valor: 12000, status: 'realizado' }],
  });
  const resumo = getResumoLote(db, 1);
  assert.equal(resumo.totalAnimais, 40);
  assert.equal(resumo.custoPorCabeca, resumo.custoTotal / 40);
  assert.equal(resumo.lucroPorCabeca, resumo.lucroTotal / 40);
  // As duas divisões usam o MESMO denominador (nenhuma delas usa os 50 de animais.qtd):
  assert.equal(resumo.custoTotal / resumo.custoPorCabeca, resumo.lucroTotal / resumo.lucroPorCabeca);
});
