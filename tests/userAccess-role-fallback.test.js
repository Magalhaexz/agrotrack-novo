import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProfileRowToUser } from '../src/services/userAccess.js';
import { perfilPodeGerenciarAcessos } from '../src/auth/perfis.js';

test('bootstrap owner email resolves admin', () => {
  const user = {
    id: 'owner-1',
    email: 'magalhaesh617@gmail.com',
    user_metadata: {},
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'admin');
  assert.equal(mapped.roleSource, 'bootstrap_owner_email');
});

test('non-owner email without metadata resolves visualizador', () => {
  const user = {
    id: 'u4',
    email: 'unknown@herdon.app',
    user_metadata: {},
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'visualizador');
});

test('metadata admin still resolves admin', () => {
  const user = {
    id: 'u2',
    email: 'admin-role@herdon.app',
    user_metadata: { role: 'admin' },
  };
  const profile = { perfil: 'visualizador', nome: 'Cache Antigo' };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.perfil, 'admin');
  assert.equal(mapped.roleSource, 'auth_metadata');
});

test('visualizador cannot manage access', () => {
  assert.equal(perfilPodeGerenciarAcessos('visualizador'), false);
});

test('admin can manage access', () => {
  assert.equal(perfilPodeGerenciarAcessos('admin'), true);
});
