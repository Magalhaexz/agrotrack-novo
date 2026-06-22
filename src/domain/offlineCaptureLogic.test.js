import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterLotesAtivosPorFazenda,
  validarDespesaOfflineForm,
  validarOcorrenciaOfflineForm,
  validarPesagemOfflineForm,
} from './offlineCaptureLogic.js';

const LOTES = [
  { id: 1, faz_id: 10, status: 'ativo' },
  { id: 2, faz_id: 10, status: 'encerrado' },
  { id: 3, faz_id: 20, status: 'ativo' },
];

test('filterLotesAtivosPorFazenda retorna só lotes ativos da fazenda informada', () => {
  assert.deepEqual(filterLotesAtivosPorFazenda(LOTES, 10).map((l) => l.id), [1]);
});

test('filterLotesAtivosPorFazenda retorna vazio sem fazenda', () => {
  assert.deepEqual(filterLotesAtivosPorFazenda(LOTES, null), []);
});

test('validarPesagemOfflineForm exige lote, data e peso médio', () => {
  assert.match(validarPesagemOfflineForm({ data: '2026-06-20', pesoMedio: 300 }), /lote/i);
  assert.match(validarPesagemOfflineForm({ loteId: 1, pesoMedio: 300 }), /data/i);
  assert.match(validarPesagemOfflineForm({ loteId: 1, data: '2026-06-20', pesoMedio: 0 }), /peso/i);
  assert.equal(validarPesagemOfflineForm({ loteId: 1, data: '2026-06-20', pesoMedio: 300 }), null);
});

test('validarPesagemOfflineForm rejeita quantidade de cabeças inválida quando informada', () => {
  assert.match(validarPesagemOfflineForm({ loteId: 1, data: '2026-06-20', pesoMedio: 300, quantidadeCabecas: -1 }), /maior que zero/i);
  assert.equal(validarPesagemOfflineForm({ loteId: 1, data: '2026-06-20', pesoMedio: 300, quantidadeCabecas: '' }), null);
});

test('validarDespesaOfflineForm exige fazenda, data, descrição e valor', () => {
  assert.match(validarDespesaOfflineForm({}), /fazenda/i);
  assert.match(validarDespesaOfflineForm({ fazendaId: 1 }), /data/i);
  assert.match(validarDespesaOfflineForm({ fazendaId: 1, data: '2026-06-20' }), /descrição/i);
  assert.match(validarDespesaOfflineForm({ fazendaId: 1, data: '2026-06-20', descricao: 'Frete', valor: 0 }), /valor/i);
  assert.equal(validarDespesaOfflineForm({ fazendaId: 1, data: '2026-06-20', descricao: 'Frete', valor: 50 }), null);
});

test('validarOcorrenciaOfflineForm exige fazenda, data, tipo e descrição', () => {
  assert.match(validarOcorrenciaOfflineForm({}), /fazenda/i);
  assert.match(validarOcorrenciaOfflineForm({ fazendaId: 1, data: '2026-06-20' }), /tipo/i);
  assert.match(validarOcorrenciaOfflineForm({ fazendaId: 1, data: '2026-06-20', tipo: 'manejo' }), /descrição/i);
  assert.equal(validarOcorrenciaOfflineForm({ fazendaId: 1, data: '2026-06-20', tipo: 'manejo', descricao: 'Vacinação' }), null);
});
