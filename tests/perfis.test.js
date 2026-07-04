import test from 'node:test';
import assert from 'node:assert/strict';
import {
  perfilPodeGerenciarAcessos,
  perfilTemPermissao,
  permissoesPorPagina,
  permissoesPorPerfil,
  PERFIS,
} from '../src/auth/perfis.js';

test('permissão de rota de perfil é explícita', () => {
  assert.equal(permissoesPorPagina.perfil, 'perfil:ver');
});

test('gerenciar acessos segue a matriz de permissões (admin sim, gerente conforme a lista)', () => {
  const expectedAdmin = (permissoesPorPerfil[PERFIS.ADMIN] || []).includes('*')
    || (permissoesPorPerfil[PERFIS.ADMIN] || []).includes('acessos:gerenciar');
  const expectedGerente = (permissoesPorPerfil[PERFIS.GERENTE] || []).includes('*')
    || (permissoesPorPerfil[PERFIS.GERENTE] || []).includes('acessos:gerenciar');

  assert.equal(perfilTemPermissao(PERFIS.ADMIN, 'acessos:gerenciar'), expectedAdmin);
  assert.equal(perfilTemPermissao(PERFIS.GERENTE, 'acessos:gerenciar'), expectedGerente);
  assert.equal(perfilPodeGerenciarAcessos(PERFIS.ADMIN), expectedAdmin);
  assert.equal(perfilPodeGerenciarAcessos(PERFIS.GERENTE), expectedGerente);
});

test('admin, proprietario e maiúsculas normalizam para proprietário', () => {
  assert.equal(perfilTemPermissao('admin', 'acessos:gerenciar'), true);
  assert.equal(perfilTemPermissao('proprietario', 'acessos:gerenciar'), true);
  assert.equal(perfilTemPermissao('PROPRIETARIO', 'acessos:gerenciar'), true);
  assert.equal(perfilPodeGerenciarAcessos('ADMIN'), true);
});

test('operador/visualizador não recebem permissões sensíveis de exclusão/gestão', () => {
  assert.equal(perfilTemPermissao(PERFIS.OPERADOR, 'acessos:gerenciar'), false);
  assert.equal(perfilTemPermissao(PERFIS.VISUALIZADOR, 'acessos:gerenciar'), false);
  assert.equal(perfilTemPermissao(PERFIS.VISUALIZADOR, 'animais:excluir'), false);
  assert.equal(perfilTemPermissao(PERFIS.VISUALIZADOR, 'custos:excluir'), false);
});

test('perfilPodeGerenciarAcessos segue matriz e não nomes hardcoded', () => {
  const acessoGerenteNaMatriz = (permissoesPorPerfil[PERFIS.GERENTE] || []).includes('acessos:gerenciar');
  assert.equal(perfilPodeGerenciarAcessos(PERFIS.GERENTE), acessoGerenteNaMatriz);
});
