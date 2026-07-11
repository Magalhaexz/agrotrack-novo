import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNavStateFromSearch, buildSearchFromNavState } from './urlState.js';

const SCHEMA = { loteId: 'number', tab: 'string' };
const DEFAULTS = { loteId: null, tab: 'visao_geral' };

test('parseNavStateFromSearch lê campos tipados da query string', () => {
  const estado = parseNavStateFromSearch('?loteId=21&tab=pesagens', SCHEMA, DEFAULTS);
  assert.equal(estado.loteId, 21);
  assert.equal(estado.tab, 'pesagens');
});

test('parseNavStateFromSearch cai para defaults quando o campo está ausente', () => {
  const estado = parseNavStateFromSearch('', SCHEMA, DEFAULTS);
  assert.equal(estado.loteId, null);
  assert.equal(estado.tab, 'visao_geral');
});

test('parseNavStateFromSearch ignora valor numérico inválido (URL editada à mão)', () => {
  const estado = parseNavStateFromSearch('?loteId=abc', SCHEMA, DEFAULTS);
  assert.equal(estado.loteId, null);
});

test('parseNavStateFromSearch nunca lança com query string corrompida', () => {
  assert.doesNotThrow(() => parseNavStateFromSearch('???not a query&&', SCHEMA, DEFAULTS));
});

test('buildSearchFromNavState serializa só os campos que divergem do default', () => {
  const search = buildSearchFromNavState({ loteId: 21, tab: 'pesagens' }, DEFAULTS);
  assert.equal(search, '?loteId=21&tab=pesagens');
});

test('buildSearchFromNavState devolve string vazia quando tudo é default (URL limpa)', () => {
  assert.equal(buildSearchFromNavState({ loteId: null, tab: 'visao_geral' }, DEFAULTS), '');
});

test('buildSearchFromNavState omite null/undefined/vazio', () => {
  const search = buildSearchFromNavState({ loteId: 21, tab: '', filtro: undefined }, DEFAULTS);
  assert.equal(search, '?loteId=21');
});

test('round-trip: parse(build(estado)) devolve o mesmo estado', () => {
  const estado = { loteId: 55, tab: 'financeiro' };
  const search = buildSearchFromNavState(estado, DEFAULTS);
  const restaurado = parseNavStateFromSearch(search, SCHEMA, DEFAULTS);
  assert.deepEqual(restaurado, estado);
});
