import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularGmdLote, gmdDoLote, gmdMedioDosLotes } from './gmd.js';

const lote = (over = {}) => ({ id: 1, entrada: '2026-01-01', p_ini: 200, ...over });
const pesagem = (data, peso, over = {}) => ({ lote_id: 1, tipo: 'lote', data, peso_medio: peso, ...over });

// ── Fórmula base ────────────────────────────────────────────────────────────
test('GMD de vida usa entrada do lote como base, não a primeira pesagem', () => {
  // Entrada 01/01 com 200kg; primeira pesagem só em 01/02.
  // Da entrada até 31/03 (89 dias) o ganho é 290-200 = 90kg.
  const r = calcularGmdLote(lote(), [pesagem('2026-02-01', 250), pesagem('2026-03-31', 290)]);
  assert.equal(r.base.origem, 'entrada_lote');
  assert.equal(r.base.peso, 200);
  assert.equal(r.dias, 89);
  assert.equal(r.ganho, 90);
  assert.ok(Math.abs(r.gmd - 90 / 89) < 1e-9);
});

test('sem data de entrada, cai para a primeira pesagem como base', () => {
  const r = calcularGmdLote(lote({ entrada: null, p_ini: null }), [
    pesagem('2026-01-01', 200),
    pesagem('2026-03-01', 260),
  ]);
  assert.equal(r.base.origem, 'primeira_pesagem');
  assert.equal(r.dias, 59);
  assert.ok(Math.abs(r.gmd - 60 / 59) < 1e-9);
});

test('usa a ÚLTIMA pesagem como fim, não a mais recentemente inserida', () => {
  // Pesagem retroativa inserida depois não pode virar o "fim".
  const r = calcularGmdLote(lote(), [pesagem('2026-03-31', 290), pesagem('2026-02-01', 250)]);
  assert.equal(r.fim.data, '2026-03-31');
  assert.equal(r.fim.peso, 290);
});

// ── Divisão por zero / intervalo ────────────────────────────────────────────
test('duas pesagens na MESMA data devolvem null, nunca um GMD inventado', () => {
  // Regressão do bug real: LotesPage fazia Math.max(1, dias) e exibia
  // 10 kg/dia dividindo o ganho por um dia que não existiu.
  const r = calcularGmdLote(lote({ entrada: null, p_ini: null }), [
    pesagem('2026-01-01', 200),
    pesagem('2026-01-01', 210),
  ]);
  assert.equal(r.gmd, null);
  assert.equal(r.motivo, 'intervalo_zero');
});

test('pesagem no MESMO dia da entrada do lote devolve null (intervalo zero)', () => {
  const r = calcularGmdLote(lote(), [pesagem('2026-01-01', 210)]);
  assert.equal(r.gmd, null);
  assert.equal(r.motivo, 'intervalo_zero');
});

// ── Dados ausentes ──────────────────────────────────────────────────────────
test('sem nenhuma pesagem devolve null, não 0', () => {
  const r = calcularGmdLote(lote(), []);
  assert.equal(r.gmd, null);
  assert.equal(r.motivo, 'sem_pesagem');
});

test('uma pesagem só, com data de entrada, É calculável', () => {
  const r = calcularGmdLote(lote(), [pesagem('2026-01-31', 230)]);
  assert.equal(r.dias, 30);
  assert.equal(r.ganho, 30);
  assert.equal(r.gmd, 1);
});

test('uma pesagem só, sem data de entrada, devolve null', () => {
  const r = calcularGmdLote(lote({ entrada: null, p_ini: null }), [pesagem('2026-01-31', 230)]);
  assert.equal(r.gmd, null);
  assert.equal(r.motivo, 'pesagem_unica_sem_entrada');
});

test('lote inexistente/nulo não quebra', () => {
  assert.equal(calcularGmdLote(null, [pesagem('2026-01-01', 200)]).gmd, null);
  assert.equal(gmdDoLote(undefined, []), null);
});

test('peso_medio nulo, vazio ou não-numérico é descartado', () => {
  const r = calcularGmdLote(lote(), [
    pesagem('2026-02-01', null),
    pesagem('2026-02-15', 'abc'),
    pesagem('2026-03-31', 290),
  ]);
  assert.equal(r.fim.peso, 290);
  assert.equal(r.ganho, 90);
});

test('pesagem sem data é descartada', () => {
  const r = calcularGmdLote(lote(), [pesagem(null, 999), pesagem('2026-01-31', 230)]);
  assert.equal(r.fim.data, '2026-01-31');
  assert.equal(r.gmd, 1);
});

// ── Valores negativos ───────────────────────────────────────────────────────
test('perda de peso produz GMD NEGATIVO (não é truncado em 0)', () => {
  // Seca/doença: o lote realmente perdeu peso e o indicador precisa mostrar.
  const r = calcularGmdLote(lote({ p_ini: 300 }), [pesagem('2026-01-31', 280)]);
  assert.equal(r.ganho, -20);
  assert.ok(r.gmd < 0);
  assert.ok(Math.abs(r.gmd - (-20 / 30)) < 1e-9);
});

// ── Lançamentos retroativos / dados inconsistentes ──────────────────────────
test('pesagem ANTERIOR à entrada do lote é ignorada', () => {
  const r = calcularGmdLote(lote(), [
    pesagem('2025-12-01', 150), // antes da entrada — pertence a outro período
    pesagem('2026-01-31', 230),
  ]);
  assert.equal(r.base.origem, 'entrada_lote');
  assert.equal(r.base.peso, 200);
  assert.equal(r.ganho, 30);
});

test('se TODAS as pesagens são anteriores à entrada, devolve null com motivo', () => {
  const r = calcularGmdLote(lote(), [pesagem('2025-11-01', 150), pesagem('2025-12-01', 160)]);
  assert.equal(r.gmd, null);
  assert.equal(r.motivo, 'pesagens_anteriores_a_entrada');
});

// ── Datas e viradas de mês/ano ──────────────────────────────────────────────
test('vira o mês corretamente (fevereiro, ano bissexto)', () => {
  // 2028 é bissexto: 01/02 → 01/03 são 29 dias.
  const r = calcularGmdLote(lote({ entrada: '2028-02-01', p_ini: 200 }), [pesagem('2028-03-01', 229)]);
  assert.equal(r.dias, 29);
  assert.equal(r.gmd, 1);
});

test('vira o ano corretamente', () => {
  const r = calcularGmdLote(lote({ entrada: '2025-12-01', p_ini: 200 }), [pesagem('2026-01-31', 261)]);
  assert.equal(r.dias, 61);
  assert.ok(Math.abs(r.gmd - 1) < 1e-9);
});

test('timestamp completo é normalizado para data civil (sem erro de fuso)', () => {
  const r = calcularGmdLote(lote(), [pesagem('2026-01-31T23:45:00-03:00', 230)]);
  assert.equal(r.dias, 30);
  assert.equal(r.gmd, 1);
});

// ── Isolamento entre lotes / dados órfãos ───────────────────────────────────
test('não mistura pesagem de OUTRO lote', () => {
  const r = calcularGmdLote(lote(), [
    pesagem('2026-01-31', 230),
    { lote_id: 99, tipo: 'lote', data: '2026-03-31', peso_medio: 900 },
  ]);
  assert.equal(r.fim.peso, 230);
});

test('ignora pesagem INDIVIDUAL de animal (só pesagem de lote entra no GMD do lote)', () => {
  const r = calcularGmdLote(lote(), [
    pesagem('2026-01-31', 230),
    { lote_id: 1, tipo: 'animal', data: '2026-03-31', peso_medio: 800 },
  ]);
  assert.equal(r.fim.peso, 230);
  assert.equal(r.gmd, 1);
});

// ── Agregado do rebanho ─────────────────────────────────────────────────────
test('GMD médio ignora lotes sem dado em vez de contá-los como 0', () => {
  const lotes = [
    { id: 1, entrada: '2026-01-01', p_ini: 200 },
    { id: 2, entrada: '2026-01-01', p_ini: 200 }, // sem pesagem
  ];
  const pesagens = [pesagem('2026-01-31', 230)]; // só do lote 1 → GMD 1.0
  // Se o lote 2 entrasse como 0, a média cairia para 0.5 e mentiria.
  assert.equal(gmdMedioDosLotes(lotes, pesagens), 1);
});

test('GMD médio devolve null quando nenhum lote tem dado suficiente', () => {
  assert.equal(gmdMedioDosLotes([{ id: 1, entrada: '2026-01-01', p_ini: 200 }], []), null);
  assert.equal(gmdMedioDosLotes([], []), null);
});

test('GMD médio é a média dos GMD por lote (não do rebanho agregado)', () => {
  const lotes = [
    { id: 1, entrada: '2026-01-01', p_ini: 200 },
    { id: 2, entrada: '2026-01-01', p_ini: 200 },
  ];
  const pesagens = [
    pesagem('2026-01-31', 230), // lote 1: +30/30d = 1.0
    { lote_id: 2, tipo: 'lote', data: '2026-01-31', peso_medio: 260 }, // lote 2: +60/30d = 2.0
  ];
  assert.equal(gmdMedioDosLotes(lotes, pesagens), 1.5);
});
