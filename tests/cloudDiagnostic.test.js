import test from 'node:test';
import assert from 'node:assert/strict';
import { runTableCheck } from '../api/cloud-diagnostic.js';

function makeMockClient({ data = [{ id: 1 }], error = null, count = 42 } = {}) {
  return {
    from() {
      return {
        select() {
          return {
            limit() {
              return {
                eq() {
                  return Promise.resolve({ data, error, count });
                },
                then(resolve) {
                  return Promise.resolve({ data, error, count }).then(resolve);
                },
              };
            },
          };
        },
      };
    },
  };
}

test('runTableCheck sem userId (checagem global) nunca expõe a contagem entre contas', async () => {
  const client = makeMockClient({ count: 12345 });
  const result = await runTableCheck(client, 'lotes', null);

  assert.equal(result.status, 'success');
  assert.equal(result.count, null);
});

test('runTableCheck sem userId e com erro também não expõe contagem', async () => {
  const client = makeMockClient({ error: { status: 404, code: 'PGRST205' } });
  const result = await runTableCheck(client, 'lotes', null);

  assert.equal(result.status, 'error');
  assert.equal(result.count, null);
});

test('runTableCheck com userId retorna a contagem real (escopo da própria conta)', async () => {
  const client = makeMockClient({ count: 7 });
  const result = await runTableCheck(client, 'lotes', 'user-123');

  assert.equal(result.status, 'success');
  assert.equal(result.count, 7);
});

test('runTableCheck com userId e erro retorna contagem 0 (não null)', async () => {
  const client = makeMockClient({ error: { status: 500, code: 'XX000' } });
  const result = await runTableCheck(client, 'lotes', 'user-123');

  assert.equal(result.status, 'error');
  assert.equal(result.count, 0);
});
