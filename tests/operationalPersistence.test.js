import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuditEvent,
  createOperationalRecord,
  deleteOwnerScopedCollection,
} from '../src/services/operationalPersistence.js';
import { supabase } from '../src/lib/supabase.js';
import { makeSession } from './fixtures.js';

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

test('createOperationalRecord injeta owner_user_id da sessão e ignora owner vindo da UI', async () => {
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

test('createOperationalRecord sem sessão retorna fallback seguro', async () => {
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

  const result = await createOperationalRecord('tarefas', { titulo: 'x' }, makeSession());
  assert.equal(result.persisted, false);
  assert.match(String(result.error), /erro remoto/i);
});

test('deleteOwnerScopedCollection aplica filtro owner_user_id da sessão', async () => {
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

test('createAuditEvent remove campos sensíveis de detalhes e não propaga secrets', async () => {
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
