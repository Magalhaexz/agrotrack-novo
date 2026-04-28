import test from 'node:test';
import assert from 'node:assert/strict';
import { getResumoLote } from '../src/domain/resumoLote.js';
import { makeBaseDb } from './fixtures.js';

test('getResumoLote retorna métricas financeiras finitas', () => {
  const db = makeBaseDb();
  const resumo = getResumoLote(db, 10);

  assert.equal(Number.isFinite(resumo.custoTotal), true);
  assert.equal(Number.isFinite(resumo.receitaTotal), true);
  assert.equal(Number.isFinite(resumo.lucroTotal), true);
  assert.equal(Number.isFinite(resumo.margemPct), true);
});

test('custos legados não são contabilizados em dobro quando já têm movimento financeiro origem=custo', () => {
  const db = makeBaseDb();
  const resumo = getResumoLote(db, 10);
  assert.equal(resumo.custoTotal, 1500);
});

test('custo legado sem movimento financeiro correspondente entra por fallback de compatibilidade', () => {
  const db = makeBaseDb();
  db.custos.push({ id: 301, lote_id: 10, val: 200, owner_user_id: 'user-1' });
  const resumo = getResumoLote(db, 10);
  assert.equal(resumo.custoTotal, 1700);
});

test('lucro por cabeça/arroba não vira NaN ou Infinity quando não há animais', () => {
  const db = makeBaseDb();
  db.animais = [];
  const resumo = getResumoLote(db, 10);
  assert.equal(Number.isFinite(resumo.lucroPorCabeca), true);
  assert.equal(Number.isFinite(resumo.lucroPorArroba), true);
});
