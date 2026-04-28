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

test('admin e gerente gerenciam acessos conforme matriz de permissões', () => {
  const expectedAdmin = (permissoesPorPerfil[PERFIS.ADMIN] || []).includes('*')
    || (permissoesPorPerfil[PERFIS.ADMIN] || []).includes('acessos:gerenciar');
  const expectedGerente = (permissoesPorPerfil[PERFIS.GERENTE] || []).includes('*')
    || (permissoesPorPerfil[PERFIS.GERENTE] || []).includes('acessos:gerenciar');

  assert.equal(perfilTemPermissao(PERFIS.ADMIN, 'acessos:gerenciar'), expectedAdmin);
  assert.equal(perfilTemPermissao(PERFIS.GERENTE, 'acessos:gerenciar'), expectedGerente);
  assert.equal(perfilPodeGerenciarAcessos(PERFIS.ADMIN), expectedAdmin);
  assert.equal(perfilPodeGerenciarAcessos(PERFIS.GERENTE), expectedGerente);
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
