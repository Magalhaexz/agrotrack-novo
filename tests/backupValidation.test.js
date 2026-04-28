import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBackupPayload } from '../src/utils/backupValidation.js';

test('shape inválido de backup é rejeitado', () => {
  assert.equal(normalizeBackupPayload(null).ok, false);
  assert.equal(normalizeBackupPayload('abc').ok, false);
});

test('chaves top-level desconhecidas não corrompem saída normalizada', () => {
  const payload = {
    data: {
      lotes: [{ id: 1, nome: 'L1' }],
      chave_desconhecida: [{ qualquer: true }],
    },
  };
  const out = normalizeBackupPayload(payload, { currentUserId: 'user-1' });
  assert.equal(out.ok, true);
  assert.equal(out.summary.unknownTopLevelKeys > 0, true);
  assert.equal(Object.prototype.hasOwnProperty.call(out.data, 'chave_desconhecida'), false);
});

test('coleções não-array são normalizadas com segurança e contabilizadas', () => {
  const payload = { data: { lotes: { id: 1 } } };
  const out = normalizeBackupPayload(payload, { currentUserId: 'user-1' });
  assert.equal(out.ok, true);
  assert.deepEqual(out.data.lotes, []);
  assert.equal(out.summary.nonArrayCollections > 0, true);
});

test('registros com owner_user_id diferente são ignorados quando há currentUserId', () => {
  const payload = {
    data: {
      tarefas: [
        { id: 1, owner_user_id: 'user-2', titulo: 'fora' },
        { id: 2, owner_user_id: 'user-1', titulo: 'dentro' },
      ],
    },
  };
  const out = normalizeBackupPayload(payload, { currentUserId: 'user-1' });
  assert.equal(out.ok, true);
  assert.equal(out.data.tarefas.length, 1);
  assert.equal(out.data.tarefas[0].titulo, 'dentro');
});
