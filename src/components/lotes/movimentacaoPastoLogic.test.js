import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterPastagensPorFazenda,
  isMesmoPastoAtual,
  validarMovimentacaoPastoForm,
} from './movimentacaoPastoLogic.js';

const PASTO_1 = { id: 'p1', faz_id: 10, nome: 'Pasto 1' };
const PASTO_2 = { id: 'p2', faz_id: 10, nome: 'Pasto 2' };
const PASTO_OUTRA_FAZENDA = { id: 'p3', faz_id: 99, nome: 'Pasto de outra fazenda' };

const LOTE_SEM_PASTO = { id: 1, faz_id: 10, pastagem_id: null };
const LOTE_COM_PASTO = { id: 2, faz_id: 10, pastagem_id: 'p1' };

// ─── filterPastagensPorFazenda ─────────────────────────────────────────────

test('filterPastagensPorFazenda retorna apenas pastos da fazenda informada', () => {
  const resultado = filterPastagensPorFazenda([PASTO_1, PASTO_2, PASTO_OUTRA_FAZENDA], 10);
  assert.deepEqual(resultado.map((p) => p.id), ['p1', 'p2']);
});

test('filterPastagensPorFazenda retorna lista vazia sem fazenda informada', () => {
  assert.deepEqual(filterPastagensPorFazenda([PASTO_1, PASTO_2], null), []);
});

test('filterPastagensPorFazenda lida com lista de pastos vazia ou inválida', () => {
  assert.deepEqual(filterPastagensPorFazenda(undefined, 10), []);
});

// ─── isMesmoPastoAtual ──────────────────────────────────────────────────────

test('isMesmoPastoAtual identifica destino igual ao pasto atual', () => {
  assert.equal(isMesmoPastoAtual(LOTE_COM_PASTO, 'p1'), true);
});

test('isMesmoPastoAtual retorna falso para destino diferente', () => {
  assert.equal(isMesmoPastoAtual(LOTE_COM_PASTO, 'p2'), false);
});

test('isMesmoPastoAtual retorna falso quando o lote ainda não tem pasto atual', () => {
  assert.equal(isMesmoPastoAtual(LOTE_SEM_PASTO, 'p1'), false);
});

// ─── validarMovimentacaoPastoForm ──────────────────────────────────────────

test('validarMovimentacaoPastoForm aceita lote sem pasto atual movido para pasto válido', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p1', dataMovimentacao: '2026-06-20', quantidadeCabecas: 62 },
    LOTE_SEM_PASTO
  );
  assert.equal(erro, null);
});

test('validarMovimentacaoPastoForm aceita lote com pasto atual movido para outro pasto', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '2026-06-20', quantidadeCabecas: 62 },
    LOTE_COM_PASTO
  );
  assert.equal(erro, null);
});

test('validarMovimentacaoPastoForm exige pasto de destino', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: '', dataMovimentacao: '2026-06-20' },
    LOTE_COM_PASTO
  );
  assert.match(erro, /pasto de destino/i);
});

test('validarMovimentacaoPastoForm exige data da movimentação', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '' },
    LOTE_COM_PASTO
  );
  assert.match(erro, /data/i);
});

test('validarMovimentacaoPastoForm exige lote vinculado a uma fazenda', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '2026-06-20' },
    { id: 3, faz_id: null, pastagem_id: null }
  );
  assert.match(erro, /fazenda/i);
});

test('validarMovimentacaoPastoForm rejeita quantidade de cabeças zero ou negativa', () => {
  const erroZero = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '2026-06-20', quantidadeCabecas: 0 },
    LOTE_COM_PASTO
  );
  const erroNegativo = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '2026-06-20', quantidadeCabecas: -5 },
    LOTE_COM_PASTO
  );
  assert.match(erroZero, /maior que zero/i);
  assert.match(erroNegativo, /maior que zero/i);
});

test('validarMovimentacaoPastoForm aceita quantidade de cabeças vazia (campo opcional)', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p2', dataMovimentacao: '2026-06-20', quantidadeCabecas: '' },
    LOTE_COM_PASTO
  );
  assert.equal(erro, null);
});

test('validarMovimentacaoPastoForm impede destino igual ao atual sem motivo', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p1', dataMovimentacao: '2026-06-20', motivo: '' },
    LOTE_COM_PASTO
  );
  assert.match(erro, /igual ao pasto atual/i);
});

test('validarMovimentacaoPastoForm permite destino igual ao atual quando há motivo', () => {
  const erro = validarMovimentacaoPastoForm(
    { pastagemDestinoId: 'p1', dataMovimentacao: '2026-06-20', motivo: 'Retorno após descanso' },
    LOTE_COM_PASTO
  );
  assert.equal(erro, null);
});
