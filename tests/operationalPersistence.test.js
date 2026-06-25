import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuditEvent,
  createOperationalRecord,
  updateOperationalRecord,
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

function mockUpdateSuccess(capture) {
  supabase.from = () => ({
    update: (payload) => {
      capture.payload = payload;
      const chain = {
        eq: () => chain,
        select: () => ({
          single: async () => ({ data: { id: 1, ...payload }, error: null }),
        }),
      };
      return chain;
    },
  });
}

// Wrap all tests in a sequential suite so shared state (supabase.from, localStorage)
// is not corrupted by concurrent test execution (node:test runs top-level tests concurrently).
test('operationalPersistence', { concurrency: 1 }, async (t) => {

  await t.test('createOperationalRecord injeta owner_user_id da sessao e ignora owner vindo da UI', async () => {
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

  await t.test('createOperationalRecord sem sessao retorna fallback seguro', async () => {
    const result = await createOperationalRecord('tarefas', { titulo: 'Local only' }, null);
    assert.equal(result.persisted, false);
    assert.equal(result.data.titulo, 'Local only');
  });

  await t.test('createOperationalRecord com erro do supabase retorna falha estruturada', async () => {
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

  await t.test('authenticated strict write does not fall back to local recovery', async () => {
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

  await t.test('deleteOwnerScopedCollection aplica filtro owner_user_id da sessao', async () => {
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

  await t.test('createAuditEvent remove campos sensiveis de detalhes e nao propaga secrets', async () => {
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

  await t.test('pending sync snapshot is user-scoped', () => {
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

  await t.test('friendly persistence error messages stay neutral in Portuguese', () => {
    const message = getFriendlySaveFailureMessage({ readinessCode: 'SESSION_MISSING' });
    assert.match(message, /Não foi possível confirmar o salvamento agora/i);
    assert.doesNotMatch(message.toLowerCase(), /sync|sync|cloud|fallback|schema|supabase|postgrest|fila|pendente|modo local/);
  });

  await t.test('friendly persistence error message remains neutral for network failures', () => {
    const message = getFriendlySaveFailureMessage({ readinessCode: 'NETWORK_ERROR' });
    assert.match(message, /Não foi possível confirmar o salvamento agora/i);
    assert.doesNotMatch(message.toLowerCase(), /sync|cloud|fallback|schema|supabase|postgrest|fila|pendente|modo local/);
  });

  await t.test('strict write policy can be forced for production-like checks', () => {
    assert.equal(canUseLocalRecoveryForWrite(makeSession(), { forceStrictWrite: true }), false);
    assert.equal(canUseLocalRecoveryForWrite(null, { forceStrictWrite: true }), false);
  });

  await t.test('repeated failed create does not duplicate pending queue for same user', async () => {
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

  // ─── regressão: update parcial de lotes não zera campos ausentes (Sprint 35) ───

  await t.test('updateOperationalRecord em lotes só envia os campos do patch, sem zerar o resto (regressão Sprint 35)', async () => {
    const capture = {};
    mockUpdateSuccess(capture);

    const result = await updateOperationalRecord('lotes', 20, {
      p_at: 360,
      ultima_pesagem: '2026-06-25',
    }, makeSession());

    assert.equal(result.persisted, true);
    assert.deepEqual(Object.keys(capture.payload).sort(), ['p_at', 'ultima_pesagem']);
    assert.equal(capture.payload.nome, undefined);
    assert.equal(capture.payload.faz_id, undefined);
    assert.equal(capture.payload.status, undefined);
  });

  await t.test('updateOperationalRecord em lotes com patch completo continua enviando todos os campos informados', async () => {
    const capture = {};
    mockUpdateSuccess(capture);

    await updateOperationalRecord('lotes', 20, {
      nome: 'Lote QA 01',
      faz_id: 641,
      pastagem_id: 'abc-123',
      qtd: 20,
      p_ini: 300,
      p_at: 360,
    }, makeSession());

    assert.equal(capture.payload.nome, 'Lote QA 01');
    assert.equal(capture.payload.faz_id, 641);
    assert.equal(capture.payload.pastagem_id, 'abc-123');
    assert.equal(capture.payload.qtd, 20);
  });

  // ─── regressão: builder de payload de animais inclui os campos reais da tabela (Sprint 35) ───

  await t.test('createOperationalRecord em animais envia fazenda_id, categoria, raca e demais campos do formulário (regressão Sprint 35)', async () => {
    const capture = {};
    mockInsertSuccess(capture);

    const result = await createOperationalRecord('animais', {
      tipo_registro: 'grupo',
      fazenda_id: 641,
      lote_id: 20,
      identificacao: 'Grupo Lote QA 01',
      categoria: 'Bois',
      raca: 'Nelore',
      qtd: 20,
      p_ini: 300,
      p_at: 360,
      data_referencia: '2026-06-25',
      status: 'ativo',
    }, makeSession());

    assert.equal(result.persisted, true);
    assert.equal(capture.payload.fazenda_id, 641);
    assert.equal(capture.payload.categoria, 'Bois');
    assert.equal(capture.payload.raca, 'Nelore');
    assert.equal(capture.payload.data_referencia, '2026-06-25');
    assert.equal(capture.payload.qtd, 20);
  });

});
