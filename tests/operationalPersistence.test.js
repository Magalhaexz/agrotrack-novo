import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuditEvent,
  createOperationalRecord,
  deleteOwnerScopedCollection,
  getPendingSyncQueueSnapshot,
  canUseLocalRecoveryForWrite,
  getFriendlySaveFailureMessage,
} from '../src/services/operationalPersistence.js';
import { supabase } from '../src/lib/supabase.js';
import { makeSession } from './fixtures.js';

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

function mockInsertSuccess(capture) {
  supabase.from = () => ({
    insert: (payload) => {
      capture.payload = payload;
      return {
        select: () => ({
          single: async () => ({ data: { id: 1, ...payload }, error: null }),
        }),
      };
    },
  });
}

test('createOperationalRecord injeta owner_user_id da sessao e ignora owner vindo da UI', async () => {
  const capture = {};
  mockInsertSuccess(capture);
  const result = await createOperationalRecord('tarefas', {
    titulo: 'Tarefa',
    owner_user_id: 'malicioso',
  }, makeSession());

  assert.equal(result.persisted, true);
  assert.equal(capture.payload.owner_user_id, 'user-1');
  assert.equal(capture.payload.titulo, 'Tarefa');
});

test('createOperationalRecord sem sessao retorna fallback seguro', async () => {
  const result = await createOperationalRecord('tarefas', { titulo: 'Local only' }, null);
  assert.equal(result.persisted, false);
  assert.equal(result.data.titulo, 'Local only');
});

test('createOperationalRecord com erro do supabase retorna falha estruturada', async () => {
  supabase.from = () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: 'erro remoto' } }),
      }),
    }),
  });

  const result = await createOperationalRecord('tarefas', { titulo: 'x' }, makeSession(), { forceStrictWrite: true });
  assert.equal(result.persisted, false);
  assert.match(String(result.error), /Não foi possível confirmar o salvamento agora/i);
  assert.equal(getPendingSyncQueueSnapshot(makeSession()).pendingCount, 0);
});

test('authenticated strict write does not fall back to local recovery', async () => {
  supabase.from = () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: 'network fail' } }),
      }),
    }),
  });

  const result = await createOperationalRecord('tarefas', { titulo: 'x' }, makeSession(), { forceStrictWrite: true });
  assert.equal(result.persisted, false);
  assert.equal(result.syncStatus, 'error');
  assert.equal(getPendingSyncQueueSnapshot(makeSession()).pendingCount, 0);
});

test('deleteOwnerScopedCollection aplica filtro owner_user_id da sessao', async () => {
  const calls = [];
  supabase.from = (table) => ({
    delete: () => ({
      eq: (col, value) => {
        calls.push({ table, col, value });
        if (calls.length === 1) {
          return {
            eq: (col2, value2) => {
              calls.push({ table, col: col2, value: value2 });
              return Promise.resolve({ error: null });
            },
          };
        }
        return Promise.resolve({ error: null });
      },
    }),
  });

  const result = await deleteOwnerScopedCollection('tarefas', makeSession(), [{ column: 'status', value: 'pendente' }]);
  assert.equal(result.persisted, true);
  assert.equal(calls[0].col, 'owner_user_id');
  assert.equal(calls[0].value, 'user-1');
});

test('createAuditEvent remove campos sensiveis de detalhes e nao propaga secrets', async () => {
  const capture = {};
  mockInsertSuccess(capture);
  const result = await createAuditEvent({
    acao: 'teste',
    entidade: 'auditoria',
    detalhes: {
      ok: true,
      password: '123',
      token: 'abc',
      nested: { secret: 'x', visivel: 'sim' },
    },
  }, makeSession());

  assert.equal(result.persisted, true);
  assert.equal(capture.payload.detalhes.password, undefined);
  assert.equal(capture.payload.detalhes.token, undefined);
  assert.equal(capture.payload.detalhes.nested.secret, undefined);
  assert.equal(capture.payload.detalhes.nested.visivel, 'sim');
});

test('pending sync snapshot is user-scoped', () => {
  localStorage.setItem('herdon-pending-sync-queue', JSON.stringify([
    { id: '1', ownerUserId: 'user-1', table: 'animais', action: 'create', code: 'network_error' },
    { id: '2', ownerUserId: 'user-2', table: 'lotes', action: 'update', code: 'schema_error' },
  ]));

  const userOne = getPendingSyncQueueSnapshot({ user: { id: 'user-1' } });
  const userTwo = getPendingSyncQueueSnapshot({ user: { id: 'user-2' } });

  assert.equal(userOne.pendingCount, 1);
  assert.equal(userOne.queue[0].ownerUserId, 'user-1');
  assert.equal(userTwo.pendingCount, 1);
  assert.equal(userTwo.queue[0].ownerUserId, 'user-2');
});

test('friendly persistence error messages stay neutral in Portuguese', () => {
  const message = getFriendlySaveFailureMessage({ readinessCode: 'SESSION_MISSING' });
  assert.match(message, /Não foi possível confirmar o salvamento agora/i);
  assert.doesNotMatch(message.toLowerCase(), /sync|sync|cloud|fallback|schema|supabase|postgrest|fila|pendente|modo local/);
});

test('friendly persistence error message remains neutral for network failures', () => {
  const message = getFriendlySaveFailureMessage({ readinessCode: 'NETWORK_ERROR' });
  assert.match(message, /Não foi possível confirmar o salvamento agora/i);
  assert.doesNotMatch(message.toLowerCase(), /sync|cloud|fallback|schema|supabase|postgrest|fila|pendente|modo local/);
});

test('strict write policy can be forced for production-like checks', () => {
  assert.equal(canUseLocalRecoveryForWrite(makeSession(), { forceStrictWrite: true }), false);
  assert.equal(canUseLocalRecoveryForWrite(null, { forceStrictWrite: true }), false);
});

test('repeated failed create does not duplicate pending queue for same user', async () => {
  localStorage.clear();
  supabase.from = () => ({
    insert: () => ({
      select: () => ({
        single: async () => ({ data: null, error: { message: 'network fail' } }),
      }),
    }),
  });

  await createOperationalRecord('tarefas', { id: 'local-1', titulo: 'A' }, makeSession());
  await createOperationalRecord('tarefas', { id: 'local-1', titulo: 'A' }, makeSession());

  const snapshot = getPendingSyncQueueSnapshot(makeSession());
  assert.equal(snapshot.pendingCount, 1);
  assert.equal(snapshot.queue[0].localId, 'local-1');
});
