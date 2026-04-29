import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProfileRowToUser } from '../src/services/userAccess.js';

test('metadata perfil=admin prevalece sobre cache visualizador', () => {
  const user = {
    id: 'u1',
    email: 'admin@herdon.app',
    user_metadata: { perfil: 'admin' },
  };
  const profile = { perfil: 'visualizador', nome: 'Cache Antigo' };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.perfil, 'admin');
});

test('metadata role=admin é aceito como admin', () => {
  const user = {
    id: 'u2',
    email: 'admin-role@herdon.app',
    user_metadata: { role: 'admin' },
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'admin');
});

test('metadata perfil=gerente é aceito', () => {
  const user = {
    id: 'u3',
    email: 'gerente@herdon.app',
    user_metadata: { perfil: 'gerente' },
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'gerente');
});

test('metadata desconhecido cai para visualizador', () => {
  const user = {
    id: 'u4',
    email: 'unknown@herdon.app',
    user_metadata: { role: 'qualquer_coisa' },
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'visualizador');
});

