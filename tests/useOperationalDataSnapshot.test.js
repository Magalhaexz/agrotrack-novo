import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOperationalSnapshotsLocal,
  loadOperationalSnapshotLocal,
  saveOperationalSnapshotLocal,
} from '../src/hooks/useOperationalData.js';

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
}

installLocalStorageMock();

test('save/load local operational snapshot keeps data available after reload', () => {
  localStorage.clear();
  const ok = saveOperationalSnapshotLocal({
    userId: 'user-1',
    db: { animais: [{ id: 'a1', nome: 'Boi 1' }], lotes: [] },
  });
  assert.equal(ok, true);

  const hydrated = loadOperationalSnapshotLocal({ userId: 'user-1' });
  assert.equal(Array.isArray(hydrated.animais), true);
  assert.equal(hydrated.animais.length, 1);
  assert.equal(hydrated.animais[0].nome, 'Boi 1');
});

test('local operational snapshot is isolated by user', () => {
  localStorage.clear();
  saveOperationalSnapshotLocal({
    userId: 'user-1',
    db: { animais: [{ id: 'a1', nome: 'User 1' }] },
  });
  saveOperationalSnapshotLocal({
    userId: 'user-2',
    db: { animais: [{ id: 'a2', nome: 'User 2' }] },
  });

  const userOne = loadOperationalSnapshotLocal({ userId: 'user-1' });
  const userTwo = loadOperationalSnapshotLocal({ userId: 'user-2' });

  assert.equal(userOne.animais[0].nome, 'User 1');
  assert.equal(userTwo.animais[0].nome, 'User 2');
});

test('logout cleanup clears the visible snapshot for the user', () => {
  localStorage.clear();
  saveOperationalSnapshotLocal({
    userId: 'user-1',
    db: { animais: [{ id: 'a1', nome: 'User 1' }] },
  });
  const cleared = clearOperationalSnapshotsLocal({ userId: 'user-1' });
  const hydrated = loadOperationalSnapshotLocal({ userId: 'user-1' });

  assert.equal(cleared, true);
  assert.equal(hydrated, null);
});
