import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCustoLote, calcularReceitaLote, calcularResultadoLote } from './calculos.js';

// Helpers para montar banco de dados mínimo de teste
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
    p_at: 400,
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
// calcularCustoLote
// ----------------------------------------------------------------

test('calcularCustoLote soma despesas do lote por categoria', () => {
  const db = makeDb({
    movimentacoes: [
      makeMov({ categoria: 'compra_animal', valor: 50000 }),
      makeMov({ categoria: 'compra_estoque', valor: 5000 }),
      makeMov({ categoria: 'outros', valor: 3000 }),
    ],
  });
  const result = calcularCustoLote(db, 1);
  assert.equal(result.custoAnimais, 50000);
  assert.equal(result.custoEstoque, 5000);
  assert.equal(result.custoOutros, 3000);
  assert.equal(result.custoTotal, 58000);
});

test('calcularCustoLote ignora despesas de outro lote', () => {
  const db = makeDb({
    movimentacoes: [
      makeMov({ lote_id: 2, valor: 99999 }),
      makeMov({ lote_id: 1, valor: 1000 }),
    ],
  });
  const result = calcularCustoLote(db, 1);
  assert.equal(result.custoTotal, 1000);
});

test('calcularCustoLote ignora receitas', () => {
  const db = makeDb({
    movimentacoes: [
      makeMov({ tipo: 'receita', valor: 50000 }),
      makeMov({ tipo: 'despesa', valor: 2000 }),
    ],
  });
  const result = calcularCustoLote(db, 1);
  assert.equal(result.custoTotal, 2000);
});

// ----------------------------------------------------------------
// calcularReceitaLote
// ----------------------------------------------------------------

test('calcularReceitaLote soma receitas do lote', () => {
  const db = makeDb({
    movimentacoes: [
      makeMov({ tipo: 'receita', categoria: 'venda_animal', valor: 80000 }),
      makeMov({ tipo: 'receita', categoria: 'outros', valor: 500 }),
      makeMov({ tipo: 'despesa', valor: 9000 }),
    ],
  });
  const result = calcularReceitaLote(db, 1);
  assert.equal(result.receitaVendas, 80000);
  assert.equal(result.receitaOutros, 500);
  assert.equal(result.receitaTotal, 80500);
});

// ----------------------------------------------------------------
// calcularResultadoLote — F-02: animais inativos não devem ser contados
// ----------------------------------------------------------------

test('calcularResultadoLote exclui animais inativos do qtdCabecas e pesoMedio (F-02)', () => {
  const db = makeDb({
    animais: [
      makeAnimal({ id: '1', qtd: 80, p_at: 500, status: 'ativo' }),
      makeAnimal({ id: '2', qtd: 20, p_at: 480, status: 'vendido' }), // deve ser ignorado
    ],
    movimentacoes: [
      makeMov({ tipo: 'receita', categoria: 'venda_animal', valor: 150000 }),
      makeMov({ tipo: 'despesa', categoria: 'compra_animal', valor: 100000 }),
    ],
  });

  const result = calcularResultadoLote(db, 1);

  // Apenas 80 animais ativos devem ser contados
  assert.equal(result.qtdCabecas, 80);

  // Peso médio deve considerar apenas os 80 ativos (p_at = 500)
  assert.equal(result.pesoMedioAtual, 500);

  // Lucro correto
  assert.equal(result.lucroTotal, 50000);
});

test('calcularResultadoLote com todos ativos conta normalmente', () => {
  const db = makeDb({
    animais: [
      makeAnimal({ id: '1', qtd: 100, p_at: 450, status: 'ativo' }),
    ],
    movimentacoes: [
      makeMov({ tipo: 'receita', valor: 200000 }),
      makeMov({ tipo: 'despesa', valor: 160000 }),
    ],
  });

  const result = calcularResultadoLote(db, 1);
  assert.equal(result.qtdCabecas, 100);
  assert.equal(result.lucroTotal, 40000);
});

test('calcularResultadoLote com lote sem animais retorna zeros sem erro', () => {
  const db = makeDb({
    animais: [],
    movimentacoes: [],
  });

  const result = calcularResultadoLote(db, 1);
  assert.equal(result.qtdCabecas, 0);
  assert.equal(result.custoTotal, 0);
  assert.equal(result.receitaTotal, 0);
  assert.equal(result.lucroTotal, 0);
});

test('calcularResultadoLote: morte não infla qtd nem peso médio (F-02)', () => {
  const db = makeDb({
    animais: [
      makeAnimal({ id: '1', qtd: 95, p_at: 460, status: 'ativo' }),
      makeAnimal({ id: '2', qtd: 5, p_at: 380, status: 'morte' }),
    ],
    movimentacoes: [
      makeMov({ tipo: 'despesa', valor: 50000 }),
    ],
  });

  const result = calcularResultadoLote(db, 1);
  // Apenas 95 animais ativos
  assert.equal(result.qtdCabecas, 95);
  // Peso médio só dos 95
  assert.equal(result.pesoMedioAtual, 460);
});

// ----------------------------------------------------------------
// calcularResultadoLote — F-04: lucroPorArroba deve usar @carcaça
// ----------------------------------------------------------------

test('calcularResultadoLote retorna arrobasCarcaca com rendimento 52% (F-04)', () => {
  const db = makeDb({
    animais: [makeAnimal({ qtd: 10, p_at: 450, status: 'ativo' })],
    movimentacoes: [
      makeMov({ tipo: 'receita', valor: 100000 }),
      makeMov({ tipo: 'despesa', valor: 60000 }),
    ],
    lotes: [makeLote({ rendimento_carcaca: '52' })],
  });
  const result = calcularResultadoLote(db, 1);
  // arrobasCarcaca = 10 * 450 * 0.52 / 15 = 156
  assert.equal(result.arrobasCarcaca, 156);
  // lucroPorArroba = 40000 / 156 ≈ 256.41
  assert.ok(Math.abs(result.lucroPorArroba - 40000 / 156) < 0.01, `esperado ≈256.41, recebido ${result.lucroPorArroba}`);
});

test('calcularResultadoLote usa rendimento 50% quando configurado (F-04)', () => {
  const db = makeDb({
    animais: [makeAnimal({ qtd: 10, p_at: 450, status: 'ativo' })],
    movimentacoes: [
      makeMov({ tipo: 'receita', valor: 100000 }),
      makeMov({ tipo: 'despesa', valor: 60000 }),
    ],
    lotes: [makeLote({ rendimento_carcaca: '50' })],
  });
  const result = calcularResultadoLote(db, 1);
  // arrobasCarcaca = 10 * 450 * 0.50 / 15 = 150
  assert.equal(result.arrobasCarcaca, 150);
  assert.ok(Math.abs(result.lucroPorArroba - 40000 / 150) < 0.01);
});

test('calcularResultadoLote cai para 52% quando lote não tem rendimento_carcaca (F-04)', () => {
  const db = makeDb({
    animais: [makeAnimal({ qtd: 10, p_at: 450, status: 'ativo' })],
    movimentacoes: [makeMov({ tipo: 'receita', valor: 100000 }), makeMov({ tipo: 'despesa', valor: 60000 })],
    lotes: [makeLote({ rendimento_carcaca: undefined })],
  });
  const result = calcularResultadoLote(db, 1);
  // Fallback 52%: arrobasCarcaca = 10 * 450 * 0.52 / 15 = 156
  assert.equal(result.arrobasCarcaca, 156);
});

test('calcularResultadoLote lucroPorArroba é maior com rendimento menor (F-04)', () => {
  const mkDb = (rendimento) =>
    makeDb({
      animais: [makeAnimal({ qtd: 10, p_at: 500, status: 'ativo' })],
      movimentacoes: [makeMov({ tipo: 'receita', valor: 50000 }), makeMov({ tipo: 'despesa', valor: 30000 })],
      lotes: [makeLote({ rendimento_carcaca: String(rendimento) })],
    });
  const r52 = calcularResultadoLote(mkDb(52), 1);
  const r50 = calcularResultadoLote(mkDb(50), 1);
  // Menos arrobas com rendimento menor → lucro/arroba maior
  assert.ok(r50.lucroPorArroba > r52.lucroPorArroba, 'rendimento 50% deve dar lucroPorArroba maior que 52%');
});

test('calcularResultadoLote mantém arrobaViva no retorno (F-04 — backward compat)', () => {
  const db = makeDb({
    animais: [makeAnimal({ qtd: 10, p_at: 450, status: 'ativo' })],
    movimentacoes: [],
    lotes: [makeLote()],
  });
  const result = calcularResultadoLote(db, 1);
  // arrobaViva = 450 / 15 = 30
  assert.equal(result.arrobaViva, 30);
});
