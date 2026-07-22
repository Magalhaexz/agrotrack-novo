import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProfileRowToUser } from '../src/services/userAccess.js';
import { perfilPodeGerenciarAcessos } from '../src/auth/perfis.js';

test('bootstrap owner email resolves proprietario', () => {
  const user = {
    id: 'owner-1',
    email: 'magalhaesh617@gmail.com',
    user_metadata: {},
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'proprietario');
  assert.equal(mapped.roleSource, 'bootstrap_owner_email');
});

test('new account without invite or explicit limited role resolves proprietario', () => {
  const user = {
    id: 'u4',
    email: 'unknown@herdon.app',
    user_metadata: {},
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'proprietario');
  assert.equal(mapped.owner_user_id, 'u4');
  assert.equal(mapped.roleSource, 'fallback_owner_default');
});

test('invited visualizador profile remains visualizador', () => {
  const user = {
    id: 'u5',
    email: 'invitee@herdon.app',
    user_metadata: {},
  };
  const profile = { perfil: 'visualizador', owner_user_id: 'owner-2', nome: 'Convidado' };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.perfil, 'visualizador');
  assert.equal(mapped.owner_user_id, 'owner-2');
});

test('P1-11: profile.fazenda_id propaga para o objeto user mapeado', () => {
  const user = { id: 'u6', email: 'membro-fazenda@herdon.app', user_metadata: {} };
  const profile = { perfil: 'gerente', owner_user_id: 'owner-3', fazenda_id: 42 };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.fazenda_id, 42);
});

test('P1-11: fazenda_id ausente no profile mapeia para null (membro irrestrito)', () => {
  const user = { id: 'u7', email: 'proprietario@herdon.app', user_metadata: {} };
  const profile = { perfil: 'proprietario', owner_user_id: 'u7' };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.fazenda_id, null);
});

test('metadata admin still resolves proprietario', () => {
  const user = {
    id: 'u2',
    email: 'admin-role@herdon.app',
    user_metadata: { role: 'ADMIN' },
  };
  const profile = { perfil: 'visualizador', nome: 'Cache Antigo' };

  const mapped = mapProfileRowToUser(user, profile);
  assert.equal(mapped.perfil, 'proprietario');
  assert.equal(mapped.roleSource, 'auth_metadata');
});

test('visualizador cannot manage access', () => {
  assert.equal(perfilPodeGerenciarAcessos('visualizador'), false);
});

test('admin can manage access', () => {
  assert.equal(perfilPodeGerenciarAcessos('admin'), true);
  assert.equal(perfilPodeGerenciarAcessos('PROPRIETARIO'), true);
});

test('self-service signup resolves proprietario and owner_user_id', () => {
  const user = {
    id: 'owner-signup-1',
    email: 'owner@herdon.app',
    user_metadata: { perfil: 'proprietario', owner_account: 'true' },
  };

  const mapped = mapProfileRowToUser(user, null);
  assert.equal(mapped.perfil, 'proprietario');
  assert.equal(mapped.owner_user_id, 'owner-signup-1');
  assert.equal(mapped.roleSource, 'auth_metadata');
});
