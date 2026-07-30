import test from 'node:test';
import assert from 'node:assert/strict';
import { calcLote } from './calculations.js';
import { gmdDoLote } from '../domain/gmd.js';

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
//
// P1-05: `gmdMedio` passou a vir EXCLUSIVAMENTE da fonte única (domain/gmd.js,
// baseada em PESAGENS) — nenhum destes fixtures tem `pesagens`, então
// `gmdMedio` agora é sempre 0 (sem dado, nunca um número inventado; ver bloco
// "GMD canônico" mais abaixo). A cadeia de fallback de data (item.data_entrada
// → lote.entrada → item.dias) que estes testes exercitavam CONTINUA existindo
// em `calcGmd`, só que agora só alimenta gmdMacho/gmdFemea (não há fonte
// canônica alternativa para GMD por sexo — pesagem de lote não é segregada).
// Os testes abaixo passam a checar `gmdMacho` (população 100% macho por
// padrão de `makeAnimal`), preservando a mesma cobertura da lógica de datas.

test('calcLote calcula GMD (por sexo) usando entrada do lote como fallback de data (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    // item.dias = 9999 (valor errado propositalmente para validar que não é usado)
    animais: [makeAnimal({ p_ini: 300, p_at: 400, qtd: 10, dias: 9999 })],
  });
  // 2025-01-01 → 2025-04-11 = 100 dias
  const result = calcLote(db, 1, '2025-04-11');
  // GMD = (400 - 300) / 100 = 1.0 kg/dia
  assert.ok(Math.abs(result.gmdMacho - 1.0) < 0.001, `GMD macho esperado 1.0, recebido ${result.gmdMacho}`);
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
  assert.ok(Math.abs(result.gmdMacho - 1.0) < 0.001, `GMD macho esperado 1.0, recebido ${result.gmdMacho}`);
});

test('calcLote cai para item.dias quando lote não tem data de entrada (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: undefined })],
    animais: [makeAnimal({ p_ini: 300, p_at: 400, qtd: 10, dias: 50 })],
  });
  const result = calcLote(db, 1, '2025-04-11');
  // GMD = (400 - 300) / 50 = 2.0 kg/dia (usando item.dias como fallback)
  assert.ok(Math.abs(result.gmdMacho - 2.0) < 0.001, `GMD macho esperado 2.0 (fallback), recebido ${result.gmdMacho}`);
});

test('calcLote GMD por sexo, ponderado por qtd entre machos e fêmeas (F-03)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [
      makeAnimal({ id: '1', p_ini: 300, p_at: 400, qtd: 10, sexo: 'macho' }),   // ganho 100 kg
      // Bug 5.1/5.2: valor real gravado pela UI é 'femea' sem acento (ver
      // AnimalForm.jsx) — este fixture usava 'fêmea' com acento, mascarando
      // o bug de comparação que existia em calcLote.
      makeAnimal({ id: '2', p_ini: 250, p_at: 300, qtd: 10, sexo: 'femea' }), // ganho 50 kg
    ],
  });
  const result = calcLote(db, 1, '2025-04-11');
  assert.ok(Math.abs(result.gmdMacho - 1.0) < 0.001, `GMD macho esperado 1.0, recebido ${result.gmdMacho}`);
  assert.ok(Math.abs(result.gmdFemea - 0.5) < 0.001, `GMD fêmea esperado 0.5, recebido ${result.gmdFemea}`);
  // Sem pesagens no fixture: gmdMedio (fonte canônica) não tem dado suficiente.
  assert.equal(result.gmdMedio, 0);
  assert.equal(result.gmdDisponivel, false);
});

test('calcLote com ganho de peso zero (por sexo) — gmdMedio segue 0 por falta de pesagem', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [makeAnimal({ p_ini: 350, p_at: 350, qtd: 10 })],
  });
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0);
  assert.equal(result.gmdDisponivel, false);
  assert.equal(result.gmdMacho, 0);
});

// ── P1-05: GMD canônico (fonte única domain/gmd.js) ──────────────────────────

test('GMD canônico: entrada do lote + pesagem final válidas calcula gmdMedio', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: 300 })],
    animais: [makeAnimal()],
  });
  db.pesagens = [{ id: 1, lote_id: 1, tipo: 'lote', data: '2025-04-11', peso_medio: 400 }];
  const result = calcLote(db, 1, '2025-04-11');
  // (400 - 300) / 100 dias = 1.0 kg/dia
  assert.ok(Math.abs(result.gmdMedio - 1.0) < 0.001, `GMD esperado 1.0, recebido ${result.gmdMedio}`);
  assert.equal(result.gmdDisponivel, true);
});

test('GMD canônico: múltiplas pesagens usa a ÚLTIMA como ponto final', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: 300 })],
    animais: [makeAnimal()],
  });
  db.pesagens = [
    { id: 1, lote_id: 1, tipo: 'lote', data: '2025-02-01', peso_medio: 340 },
    { id: 2, lote_id: 1, tipo: 'lote', data: '2025-03-01', peso_medio: 370 },
    { id: 3, lote_id: 1, tipo: 'lote', data: '2025-04-11', peso_medio: 400 },
  ];
  const result = calcLote(db, 1, '2025-04-11');
  assert.ok(Math.abs(result.gmdMedio - 1.0) < 0.001, `GMD esperado 1.0 (última pesagem), recebido ${result.gmdMedio}`);
});

test('GMD canônico: sem pesagem suficiente devolve 0 (não inventa valor)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: 300 })],
    animais: [makeAnimal({ p_ini: 300, p_at: 500 })], // ganho enorme na tabela `animais`
  });
  db.pesagens = []; // nenhuma pesagem de lote
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0, 'não deve recalcular pela fórmula legada de animais');
  assert.equal(result.gmdDisponivel, false);
});

test('GMD canônico: data de pesagem inválida é ignorada (mesmo efeito de "sem pesagem")', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: 300 })],
    animais: [makeAnimal()],
  });
  db.pesagens = [{ id: 1, lote_id: 1, tipo: 'lote', data: 'data-invalida', peso_medio: 400 }];
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0);
  assert.equal(result.gmdDisponivel, false);
});

test('GMD canônico: peso inicial do lote ausente cai para a primeira pesagem como base', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: undefined })],
    animais: [makeAnimal()],
  });
  db.pesagens = [
    { id: 1, lote_id: 1, tipo: 'lote', data: '2025-01-01', peso_medio: 320 },
    { id: 2, lote_id: 1, tipo: 'lote', data: '2025-02-20', peso_medio: 370 },
  ];
  const result = calcLote(db, 1, '2025-02-20');
  // Sem p_ini do lote: base = primeira pesagem (320 em 2025-01-01); 50 dias.
  assert.ok(Math.abs(result.gmdMedio - 1.0) < 0.001, `GMD esperado 1.0, recebido ${result.gmdMedio}`);
  assert.equal(result.gmdDisponivel, true);
});

test('GMD canônico: intervalo de dias zero (mesma data) devolve 0, nunca divide por zero', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-04-11', p_ini: 300 })],
    animais: [makeAnimal()],
  });
  db.pesagens = [{ id: 1, lote_id: 1, tipo: 'lote', data: '2025-04-11', peso_medio: 400 }];
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0);
  assert.equal(result.gmdDisponivel, false);
  assert.equal(Number.isNaN(result.gmdMedio), false);
  assert.notEqual(result.gmdMedio, Infinity);
});

test('calcLote e gmdDoLote retornam o MESMO valor (mesma fonte, mesma unidade)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01', p_ini: 300 })],
    animais: [makeAnimal()],
  });
  db.pesagens = [{ id: 1, lote_id: 1, tipo: 'lote', data: '2025-04-11', peso_medio: 430 }];
  const result = calcLote(db, 1, '2025-04-11');
  const gmdCanonico = gmdDoLote(db.lotes[0], db.pesagens);
  assert.equal(result.gmdMedio, gmdCanonico, 'mesmo número — mesma fonte, mesma unidade (kg/dia)');
});

test('registro antigo sem `pesagens` no db mantém compatibilidade (gmdMedio=0, sem NaN)', () => {
  const db = makeDb({
    lotes: [makeLote({ entrada: '2025-01-01' })],
    animais: [makeAnimal()],
  });
  // db.pesagens nunca foi definido — simula registro/db legado.
  const result = calcLote(db, 1, '2025-04-11');
  assert.equal(result.gmdMedio, 0);
  assert.equal(result.gmdDisponivel, false);
  assert.equal(Number.isNaN(result.gmdMedio), false);
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

// Bug 3.3/3.4/3.5 — peso atual médio segue a pesagem de lote mais recente.
test('calcLote: peso atual segue a pesagem válida mais recente (não trava no de entrada)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, entrada: '2025-01-01' })],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 300 }],
    // sem atualizar animais.p_at; a verdade vem das pesagens:
  });
  db.pesagens = [
    { id: 1, lote_id: 1, data: '2025-02-01', peso_medio: 340 },
    { id: 2, lote_id: 1, data: '2025-03-01', peso_medio: 380 },
  ];
  assert.equal(calcLote(db, 1).pesoAtualMedio, 380);
});

test('calcLote: sem pesagem posterior, peso atual cai para o peso dos animais (entrada)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1 })],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 300 }],
  });
  db.pesagens = [];
  assert.equal(calcLote(db, 1).pesoAtualMedio, 300);
});

test('calcLote: pesagem por animal não define o peso atual do lote', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1 })],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 300 }],
  });
  db.pesagens = [{ id: 1, lote_id: 1, data: '2025-03-01', peso_medio: 500, tipo: 'animal' }];
  assert.equal(calcLote(db, 1).pesoAtualMedio, 300);
});

// Bug 1.3 — cabeças ativas seguem lote.qtd (fonte canônica), não animais.qtd.
test('calcLote: totalAnimais usa lote.qtd quando definido, mesmo divergindo de animais.qtd', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 67 })], // após venda de 15 de um total de 82
    animais: [makeAnimal({ lote_id: 1, qtd: 82, p_ini: 300, p_at: 320, dias: 40 })],
  });
  const r = calcLote(db, 1);
  assert.equal(r.totalAnimais, 67, 'cabeças ativas devem refletir lote.qtd, não a soma desatualizada de animais.qtd');
});

test('calcLote: sem lote.qtd definido, cai para a soma de animais.qtd (lote legado)', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1 })], // sem campo qtd
    animais: [makeAnimal({ lote_id: 1, qtd: 82 })],
  });
  assert.equal(calcLote(db, 1).totalAnimais, 82);
});

test('calcLote: lote.qtd = 0 é um total válido (lote esvaziado), não cai no fallback', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 0 })],
    animais: [makeAnimal({ lote_id: 1, qtd: 82 })],
  });
  assert.equal(calcLote(db, 1).totalAnimais, 0);
});

test('calcLote: médias ponderadas (peso de entrada, dias) continuam corretas mesmo com lote.qtd divergente', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 67, entrada: '2025-01-01' })],
    animais: [makeAnimal({ lote_id: 1, qtd: 82, p_ini: 300, p_at: 320, data_entrada: '2025-01-01' })],
  });
  const r = calcLote(db, 1, '2025-02-10');
  // peso de entrada é o mesmo de TODOS os 82 registros originais (300kg) —
  // não deve inflar/deflacionar por causa do denominador ter mudado para 67.
  assert.equal(r.pesoInicialMedio, 300);
});

test('calcLote: arrobasCarcaca usa o total canônico (lote.qtd) para a contagem atual real', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1, qtd: 67, rendimento_carcaca: '52' })],
    animais: [makeAnimal({ lote_id: 1, qtd: 82, p_ini: 300, p_at: 320 })],
  });
  db.pesagens = [{ id: 1, lote_id: 1, data: '2025-02-01', peso_medio: 320 }];
  const r = calcLote(db, 1);
  const esperado = (67 * 320 * 0.52) / 15;
  assert.ok(Math.abs(r.arrobasCarcaca - esperado) < 1e-6);
});

// Bug 5.1/5.2 — o valor gravado pela UI é 'femea' (sem acento); calcLote
// comparava com 'fêmea' (com acento) e nunca contava fêmeas cadastradas.
test('calcLote: animais com sexo "femea" (sem acento, valor real gravado pela UI) são contados como fêmeas', () => {
  const db = makeDb({
    lotes: [makeLote({ id: 1 })],
    animais: [
      makeAnimal({ id: '1', lote_id: 1, qtd: 5, sexo: 'macho', p_ini: 300, p_at: 400 }),
      makeAnimal({ id: '2', lote_id: 1, qtd: 5, sexo: 'femea', p_ini: 280, p_at: 360 }),
    ],
  });
  const r = calcLote(db, 1);
  assert.equal(r.qtdFemeas, 5);
  assert.equal(r.qtdMachos, 5);
  assert.ok(r.gmdFemea > 0, 'gmdFemea deve ser calculado a partir dos animais cadastrados como fêmea');
});
