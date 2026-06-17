import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLote } from './calculations.js';

function makeDb({ lotes = [], animais = [], movimentacoes = [], custos = [] } = {}) {
  return { lotes, animais, movimentacoes_financeiras: movimentacoes, custos };
}

function makeLote(overrides = {}) {
  return {
    id: 1,
    nome: 'Lote A',
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
    dias: 90,
    status: 'ativo',
    sexo: 'macho',
    ...overrides,
  };
}

// --- F-03: GMD dinâmico ---

test('calcLote calcula GMD usando entrada do lote como fallback de data (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    // item.dias = 9999 (valor errado propositalmente para validar que não é usado)
    animais: [makeAnimal({ p_ini: 300, p_at: 400, qtd: 10, dias: 9999 })],
  });
  // 2025-01-01 → 2025-04-11 = 100 dias
  const result = calcLote(db, 1, '2025-04-11');
  // GMD = (400 - 300) / 100 = 1.0 kg/dia
  assert.ok(Math.abs(result.gmdMedio - 1.0) < 0.001, `GMD esperado 1.0, recebido ${result.gmdMedio}`);
});

test('calcLote calcula dias médio a partir da data de entrada do lote (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [makeAnimal({ qtd: 50, dias: 0 })],
  });
  const result = calcLote(db, 1, '2025-04-11'); // 100 dias
  assert.equal(result.dias, 100);
});

test('calcLote usa item.data_entrada quando disponível, ignorando lote.entrada (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })], // entrada do lote = 100 dias antes
    // animal entrou 50 dias antes da referência
    animais: [makeAnimal({ p_ini: 300, p_at: 350, qtd: 10, data_entrada: '2025-02-19' })],
  });
  // 2025-02-19 → 2025-04-10 = 50 dias
  const result = calcLote(db, 1, '2025-04-10');
  // GMD = (350 - 300) / 50 = 1.0 kg/dia
  assert.ok(Math.abs(result.gmdMedio - 1.0) < 0.001, `GMD esperado 1.0, recebido ${result.gmdMedio}`);
});

test('calcLote cai para item.dias quando lote não tem data de entrada (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: undefined })],
    animais: [makeAnimal({ p_ini: 300, p_at: 400, qtd: 10, dias: 50 })],
  });
  const result = calcLote(db, 1, '2025-04-11');
  // GMD = (400 - 300) / 50 = 2.0 kg/dia (usando item.dias como fallback)
  assert.ok(Math.abs(result.gmdMedio - 2.0) < 0.001, `GMD esperado 2.0 (fallback), recebido ${result.gmdMedio}`);
});

test('calcLote GMD ponderado por qtd entre machos e fêmeas (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [
      makeAnimal({ id: '1', p_ini: 300, p_at: 400, qtd: 10, sexo: 'macho' }),   // ganho 100 kg
      makeAnimal({ id: '2', p_ini: 250, p_at: 300, qtd: 10, sexo: 'fêmea' }), // ganho 50 kg
    ],
  });
  // 100 dias; GMD ponderado = ((100/100)*10 + (50/100)*10) / 20 = (10 + 5) / 20 = 0.75 kg/dia
  const result = calcLote(db, 1, '2025-04-11');
  assert.ok(Math.abs(result.gmdMedio - 0.75) < 0.001, `GMD esperado 0.75, recebido ${result.gmdMedio}`);
  assert.ok(Math.abs(result.gmdMacho - 1.0) < 0.001, `GMD macho esperado 1.0, recebido ${result.gmdMacho}`);
  assert.ok(Math.abs(result.gmdFemea - 0.5) < 0.001, `GMD fêmea esperado 0.5, recebido ${result.gmdFemea}`);
});

test('calcLote com ganho de peso zero retorna GMD zero (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [makeAnimal({ p_ini: 350, p_at: 350, qtd: 10 })],
  });
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0);
});

// --- F-07: arrobasProduzidas usa calcularArrobasProduzidas ---

test('calcLote calcula arrobasProduzidas corretamente (F-07)', () => {
  const db = makeDb({
    lotes: [makeLote()],
    animais: [makeAnimal({ p_ini: 300, p_at: 450, qtd: 10 })],
  });
  const result = calcLote(db, 1, '2025-04-11');
  // arrobasProduzidas = (450 - 300) * 10 / 15 = 1500 / 15 = 100
  assert.equal(result.arrobasProduzidas, 100);
});

test('calcLote arrobasProduzidas com múltiplos grupos de animais (F-07)', () => {
  const db = makeDb({
    lotes: [makeLote()],
    animais: [
      makeAnimal({ id: '1', p_ini: 300, p_at: 450, qtd: 10 }), // ganho 1500 kg → 100 arrobas
      makeAnimal({ id: '2', p_ini: 250, p_at: 370, qtd: 5 }),  // ganho 600 kg → 40 arrobas
    ],
  });
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.arrobasProduzidas, 140);
});
