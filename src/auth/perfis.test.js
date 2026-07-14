import test from 'node:test';
import assert from 'node:assert/strict';
import { usuarioTemPermissao, permissoesPorPerfil, PERFIS } from './perfis.js';

// Regressão BB-18: gerente ("gerencia a operação", segundo a própria tela
// Equipe) não tinha nenhuma permissão de suplementação, enquanto operador e
// visualizador — os dois papéis de privilégio menor — tinham ambos. Um
// gerente convidado via Equipe não conseguia nem ver o módulo no menu.
test('gerente tem acesso de suplementação, igual ou maior que operador', () => {
  const gerente = { perfil: PERFIS.GERENTE };
  assert.equal(usuarioTemPermissao(gerente, 'suplementacao:ver'), true);
  assert.equal(usuarioTemPermissao(gerente, 'suplementacao:editar'), true);
});

test('operador e visualizador continuam com o acesso de suplementação que já tinham (sem regressão)', () => {
  const operador = { perfil: PERFIS.OPERADOR };
  const visualizador = { perfil: PERFIS.VISUALIZADOR };
  assert.equal(usuarioTemPermissao(operador, 'suplementacao:ver'), true);
  assert.equal(usuarioTemPermissao(operador, 'suplementacao:editar'), true);
  assert.equal(usuarioTemPermissao(visualizador, 'suplementacao:ver'), true);
  assert.equal(usuarioTemPermissao(visualizador, 'suplementacao:editar'), false);
});

// Cobertura confirmada nesta rodada (Rodada 8): assinatura:gerenciar deve
// continuar exclusiva do proprietário — nenhum papel convidado altera plano.
test('só proprietário tem assinatura:gerenciar — gerente/operador/visualizador nunca alteram plano', () => {
  const proprietario = { perfil: PERFIS.PROPRIETARIO };
  const gerente = { perfil: PERFIS.GERENTE };
  const operador = { perfil: PERFIS.OPERADOR };
  const visualizador = { perfil: PERFIS.VISUALIZADOR };

  assert.equal(usuarioTemPermissao(proprietario, 'assinatura:gerenciar'), true);
  assert.equal(usuarioTemPermissao(gerente, 'assinatura:gerenciar'), false);
  assert.equal(usuarioTemPermissao(operador, 'assinatura:gerenciar'), false);
  assert.equal(usuarioTemPermissao(visualizador, 'assinatura:gerenciar'), false);
});

test('permissoesPorPerfil de gerente não contém assinatura:gerenciar nem acessos:gerenciar', () => {
  assert.ok(!permissoesPorPerfil[PERFIS.GERENTE].includes('assinatura:gerenciar'));
  assert.ok(!permissoesPorPerfil[PERFIS.GERENTE].includes('acessos:gerenciar'));
});
