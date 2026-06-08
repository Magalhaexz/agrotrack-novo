import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDb } from '../src/data/mockData.js';
import { createEmptyOperationalDb } from '../src/data/operationalTemplate.js';

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
  };
}

installLocalStorageMock();

const {
  createOperationalFallbackDb,
  resolveOperationalBootstrapDb,
} = await import('../src/hooks/useOperationalData.js');

test('production seed export is empty', () => {
  assert.deepEqual(initialDb, createEmptyOperationalDb());
  assert.equal(Array.isArray(initialDb.fazendas), true);
  assert.equal(initialDb.fazendas.length, 0);
  assert.equal(initialDb.animais.length, 0);
  assert.equal(initialDb.estoque.length, 0);
});

test('logged user with no data sees an empty operational baseline', () => {
  const baseline = resolveOperationalBootstrapDb({ sessionUserId: 'user-1' });
  assert.equal(baseline.fazendas.length, 0);
  assert.equal(baseline.lotes.length, 0);
  assert.equal(baseline.animais.length, 0);
});

test('auth loading or logout does not expose prior user data', () => {
  const baseline = resolveOperationalBootstrapDb({
    sessionUserId: null,
    persistedSnapshot: {
      fazendas: [{ id: 1, nome: 'Fazenda antiga' }],
      lotes: [{ id: 2, nome: 'Lote antigo' }],
      animais: [{ id: 3, nome: 'Animal antigo' }],
    },
  });

  assert.equal(baseline.fazendas.length, 0);
  assert.equal(baseline.lotes.length, 0);
  assert.equal(baseline.animais.length, 0);
});

test('createOperationalFallbackDb never seeds demo records', () => {
  const db = createOperationalFallbackDb();
  assert.equal(db.fazendas.some((item) => String(item.nome || '').includes('Santa Rita')), false);
  assert.equal(db.animais.length, 0);
  assert.equal(db.estoque.length, 0);
});
