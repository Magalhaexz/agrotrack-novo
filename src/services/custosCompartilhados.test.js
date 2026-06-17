import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarRateioCustoCompartilhado } from './custosCompartilhados.js';

// db mínimo reutilizável entre testes
function makeDb(lotes = [], movimentacoes = []) {
  return {
    lotes,
    movimentacoes_financeiras: movimentacoes,
    auditoria: [],
  };
}

const LOTE_A = { id: 1, nome: 'Lote A', qtd: 100, p_at: 400 }; // pesoTotal = 40000
const LOTE_B = { id: 2, nome: 'Lote B', qtd: 200, p_at: 500 }; // pesoTotal = 100000

const DADOS_BASE = {
  descricao: 'Energia elétrica',
  valor: 3000,
  data: '2026-06-16',
  categoria: 'custo_indireto',
};

// ─── 1. Rateio por cabeças ────────────────────────────────────────────────

test('rateio por cabeças distribui proporcional ao nº de cabeças', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, criterio: 'cabecas', loteIds: [1, 2] }
  );

  const lotA = rateio.find((r) => r.lote_id === 1);
  const lotB = rateio.find((r) => r.lote_id === 2);

  // A:100, B:200 → A = 1000, B = 2000
  assert.ok(Math.abs(lotA.custoRateado - 1000) < 0.01, `Esperado 1000, recebido ${lotA.custoRateado}`);
  assert.ok(Math.abs(lotB.custoRateado - 2000) < 0.01, `Esperado 2000, recebido ${lotB.custoRateado}`);
});

// ─── 2. Rateio por peso ───────────────────────────────────────────────────

test('rateio por peso distribui proporcional ao peso total do lote', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, criterio: 'peso', loteIds: [1, 2] }
  );

  // A: 100×400=40000, B: 200×500=100000, total=140000
  // A = 3000 × 40000/140000 ≈ 857.14, B = 3000 × 100000/140000 ≈ 2142.86
  const totalPeso = 140000;
  const esperadoA = 3000 * 40000 / totalPeso;
  const esperadoB = 3000 * 100000 / totalPeso;

  const lotA = rateio.find((r) => r.lote_id === 1);
  const lotB = rateio.find((r) => r.lote_id === 2);

  assert.ok(Math.abs(lotA.custoRateado - esperadoA) < 0.01, `Esperado ${esperadoA}, recebido ${lotA.custoRateado}`);
  assert.ok(Math.abs(lotB.custoRateado - esperadoB) < 0.01, `Esperado ${esperadoB}, recebido ${lotB.custoRateado}`);
});

// ─── 3. Rateio igualitário ────────────────────────────────────────────────

test('rateio igualitário divide em partes iguais', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, criterio: 'igualitario', loteIds: [1, 2] }
  );

  assert.equal(rateio.length, 2);
  rateio.forEach((r) => {
    assert.ok(Math.abs(r.custoRateado - 1500) < 0.01, `Esperado 1500, recebido ${r.custoRateado}`);
  });
});

// ─── 4. Valor total zero ──────────────────────────────────────────────────

test('valor total zero gera rateio zerado sem erro', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio, db: dbAtualizado } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 0, criterio: 'cabecas', loteIds: [1, 2] }
  );

  rateio.forEach((r) => assert.equal(r.custoRateado, 0));
  // Nenhuma movimentação com valor > 0 deve ser gerada
  const novas = dbAtualizado.movimentacoes_financeiras;
  assert.equal(novas.length, 0, 'Com valor zero não deve gerar movimentações');
});

// ─── 5. Lote sem cabeças com critério cabeças ─────────────────────────────

test('lote sem cabeças recebe zero no rateio por cabeças', () => {
  const loteSemCabecas = { id: 3, nome: 'Lote C', qtd: 0, p_at: 400 };
  const db = makeDb([LOTE_A, loteSemCabecas]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 1000, criterio: 'cabecas', loteIds: [1, 3] }
  );

  const lotC = rateio.find((r) => r.lote_id === 3);
  assert.equal(lotC.custoRateado, 0);
});

// ─── 6. Lote sem peso com critério peso ───────────────────────────────────

test('lote sem peso recebe zero no rateio por peso', () => {
  const loteSemPeso = { id: 4, nome: 'Lote D', qtd: 50, p_at: 0 };
  const db = makeDb([LOTE_A, loteSemPeso]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 1000, criterio: 'peso', loteIds: [1, 4] }
  );

  const lotD = rateio.find((r) => r.lote_id === 4);
  assert.equal(lotD.custoRateado, 0);
});

// ─── 7. Soma dos rateios igual ao custo total ─────────────────────────────

test('soma dos rateios é igual ao custo total (cabeças)', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 3000, criterio: 'cabecas', loteIds: [1, 2] }
  );

  const soma = rateio.reduce((acc, r) => acc + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 3000) < 0.01, `Soma esperada 3000, recebida ${soma}`);
});

test('soma dos rateios é igual ao custo total (peso)', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 3000, criterio: 'peso', loteIds: [1, 2] }
  );

  const soma = rateio.reduce((acc, r) => acc + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 3000) < 0.01, `Soma esperada 3000, recebida ${soma}`);
});

test('soma dos rateios é igual ao custo total (igualitário)', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { rateio } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 3000, criterio: 'igualitario', loteIds: [1, 2] }
  );

  const soma = rateio.reduce((acc, r) => acc + r.custoRateado, 0);
  assert.ok(Math.abs(soma - 3000) < 0.01, `Soma esperada 3000, recebida ${soma}`);
});

// ─── 8. Movimentações financeiras geradas corretamente ────────────────────

test('gera movimentação de despesa por lote com campos obrigatórios', () => {
  const db = makeDb([LOTE_A, LOTE_B]);
  const { db: dbAtualizado } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 3000, criterio: 'cabecas', loteIds: [1, 2] }
  );

  const movs = dbAtualizado.movimentacoes_financeiras;
  assert.equal(movs.length, 2, 'Deve gerar uma movimentação por lote');

  movs.forEach((mov) => {
    assert.equal(mov.tipo, 'despesa');
    assert.equal(mov.categoria, 'custo_indireto');
    assert.equal(mov.data, '2026-06-16');
    assert.equal(mov.origem_tipo, 'rateio');
    assert.ok(mov.descricao.includes('Energia elétrica'), `Descrição deve conter o nome do custo: ${mov.descricao}`);
    assert.ok(mov.descricao.includes('cabeças'), `Descrição deve conter o critério: ${mov.descricao}`);
    assert.ok(typeof mov.lote_id === 'number');
    assert.ok(mov.valor >= 0);
  });
});

test('movimentações preservam IDs únicos', () => {
  const db = makeDb([LOTE_A, LOTE_B], [{ id: 10, valor: 100 }]);
  const { db: dbAtualizado } = aplicarRateioCustoCompartilhado(
    db,
    { ...DADOS_BASE, valor: 600, criterio: 'igualitario', loteIds: [1, 2] }
  );

  const movs = dbAtualizado.movimentacoes_financeiras;
  // IDs devem ser maiores que o max existente (10) e únicos
  const novas = movs.slice(1); // primeira é a pré-existente
  const ids = novas.map((m) => m.id);
  assert.ok(ids.every((id) => id > 10), 'IDs novos devem ser > max existente');
  assert.equal(new Set(ids).size, ids.length, 'IDs devem ser únicos');
});

// ─── Validações de entrada ────────────────────────────────────────────────

test('lança erro se descrição estiver vazia', () => {
  const db = makeDb([LOTE_A]);
  assert.throws(
    () => aplicarRateioCustoCompartilhado(db, { ...DADOS_BASE, descricao: '', criterio: 'cabecas', loteIds: [1] }),
    /Descrição é obrigatória/
  );
});

test('lança erro se loteIds estiver vazio', () => {
  const db = makeDb([LOTE_A]);
  assert.throws(
    () => aplicarRateioCustoCompartilhado(db, { ...DADOS_BASE, criterio: 'cabecas', loteIds: [] }),
    /Selecione ao menos um lote/
  );
});

test('lança erro se critério for inválido', () => {
  const db = makeDb([LOTE_A]);
  assert.throws(
    () => aplicarRateioCustoCompartilhado(db, { ...DADOS_BASE, criterio: 'desconhecido', loteIds: [1] }),
    /Critério inválido/
  );
});

test('lança erro se valor for negativo', () => {
  const db = makeDb([LOTE_A]);
  assert.throws(
    () => aplicarRateioCustoCompartilhado(db, { ...DADOS_BASE, valor: -100, criterio: 'cabecas', loteIds: [1] }),
    /Valor total inválido/
  );
});
