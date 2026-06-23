import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlanoConfig,
  getLimitesPlano,
  getModulosPlano,
  verificarLimiteUso,
  verificarAcessoModulo,
  obterResumoUso,
} from '../src/domain/planos.js';
import { getSubscriptionLimitMessage, getModuleBlockedMessage } from '../src/services/subscriptions.js';

test('getPlanoConfig retorna limites e módulos do plano Essencial', () => {
  const config = getPlanoConfig('essencial');
  assert.equal(config.planCode, 'essencial');
  assert.equal(config.limits.farms, 1);
  assert.equal(config.limits.animals, 300);
  assert.equal(config.limits.users, 2);
});

test('getPlanoConfig retorna limites do plano "pro" (Campo Plus, sugestão interna)', () => {
  const config = getPlanoConfig('pro');
  assert.equal(config.limits.farms, 3);
  assert.equal(config.limits.animals, 1000);
  assert.equal(config.limits.users, 5);
});

test('getPlanoConfig retorna limites do plano "premium" (Gestão Pro, sugestão interna)', () => {
  const config = getPlanoConfig('premium');
  assert.equal(config.limits.farms, 10);
  assert.equal(config.limits.animals, 3000);
  assert.equal(config.limits.users, 10);
});

test('getPlanoConfig do Enterprise não tem limites fixos (sob consulta)', () => {
  const config = getPlanoConfig('enterprise');
  assert.equal(config.limits.farms, null);
  assert.equal(config.customLimits, true);
  assert.deepEqual(config.modules, ['*']);
});

test('getPlanoConfig do Fundador/legado mantém acesso total e não é removido', () => {
  const config = getPlanoConfig('fundador');
  assert.ok(config);
  assert.deepEqual(config.modules, ['*']);
  assert.equal(config.limits.farms, 50);
});

test('getPlanoConfig retorna null para plano desconhecido (não inventa limite)', () => {
  assert.equal(getPlanoConfig('inexistente'), null);
  assert.equal(getLimitesPlano('inexistente'), null);
  assert.equal(getModulosPlano('inexistente'), null);
});

test('getModulosPlano retorna a lista de módulos do plano essencial', () => {
  const modulos = getModulosPlano('essencial');
  assert.ok(modulos.includes('dashboard'));
  assert.ok(modulos.includes('fazendas'));
  assert.ok(!modulos.includes('financeiro'));
});

test('verificarLimiteUso: limite de fazendas bloqueia ao atingir o teto do plano', () => {
  const resultado = verificarLimiteUso('essencial', { farms: 1, animals: 0, users: 0 });
  assert.equal(resultado.farms.allowed, false);
  assert.equal(resultado.farms.limit, 1);
  assert.equal(resultado.farms.remaining, 0);
});

test('verificarLimiteUso: limite de cabeças permite enquanto não atingir o teto', () => {
  const dentro = verificarLimiteUso('essencial', { farms: 0, animals: 299, users: 0 });
  const noTeto = verificarLimiteUso('essencial', { farms: 0, animals: 300, users: 0 });
  assert.equal(dentro.animals.allowed, true);
  assert.equal(dentro.animals.remaining, 1);
  assert.equal(noTeto.animals.allowed, false);
});

test('verificarLimiteUso: plano com limite nulo (Enterprise) é sempre permitido', () => {
  const resultado = verificarLimiteUso('enterprise', { farms: 999, animals: 999999, users: 999 });
  assert.equal(resultado.farms.allowed, true);
  assert.equal(resultado.farms.limit, null);
  assert.equal(resultado.animals.allowed, true);
});

test('verificarLimiteUso: plano desconhecido não bloqueia (sem limite configurado)', () => {
  const resultado = verificarLimiteUso(null, { farms: 50, animals: 5000, users: 50 });
  assert.equal(resultado.farms.allowed, true);
  assert.equal(resultado.animals.allowed, true);
  assert.equal(resultado.users.allowed, true);
});

test('verificarAcessoModulo: módulo liberado no plano premium', () => {
  assert.equal(verificarAcessoModulo('premium', 'pastagens'), true);
});

test('verificarAcessoModulo: módulo bloqueado no plano essencial', () => {
  assert.equal(verificarAcessoModulo('essencial', 'financeiro'), false);
  assert.equal(verificarAcessoModulo('essencial', 'pastagens'), false);
});

test('verificarAcessoModulo: Fundador e Enterprise liberam todos os módulos (wildcard)', () => {
  assert.equal(verificarAcessoModulo('fundador', 'qualquer-modulo-novo'), true);
  assert.equal(verificarAcessoModulo('enterprise', 'qualquer-modulo-novo'), true);
});

test('verificarAcessoModulo: plano não reconhecido não bloqueia (protege contas legado/beta)', () => {
  assert.equal(verificarAcessoModulo(null, 'financeiro'), true);
  assert.equal(verificarAcessoModulo('inexistente', 'financeiro'), true);
});

test('obterResumoUso: conta sem assinatura retorna status "none" e não bloqueia', () => {
  const db = { fazendas: [{ id: 1 }], animais: [{ id: 1, qtd: 5 }] };
  const resumo = obterResumoUso(db, null);
  assert.equal(resumo.status, 'none');
  assert.equal(resumo.planoCode, null);
  assert.equal(resumo.uso.farms, 1);
  assert.equal(resumo.uso.animals, 5);
});

test('obterResumoUso: conta com assinatura ativa calcula uso e limites do plano', () => {
  const db = {
    fazendas: [{ id: 1 }],
    animais: [{ id: 1, qtd: 100 }, { id: 2, qtd: 150 }],
    usuarios: [{ id: 1, status: 'ativo' }, { id: 2, status: 'inativo' }],
  };
  const assinatura = { plan_code: 'essencial', status: 'active' };
  const resumo = obterResumoUso(db, assinatura);

  assert.equal(resumo.status, 'active');
  assert.equal(resumo.planoCode, 'essencial');
  assert.equal(resumo.uso.animals, 250);
  assert.equal(resumo.uso.users, 1);
  assert.equal(resumo.limites.farms.allowed, false);
  assert.equal(resumo.limites.animals.allowed, true);
});

test('obterResumoUso: assinatura vencida (past_due) ainda calcula o resumo normalmente', () => {
  const db = { fazendas: [], animais: [] };
  const resumo = obterResumoUso(db, { plan_code: 'pro', status: 'past_due' });
  assert.equal(resumo.status, 'past_due');
  assert.equal(resumo.planoCode, 'pro');
});

test('obterResumoUso: internal_test usa o plano vinculado sem bloquear', () => {
  const db = { fazendas: Array.from({ length: 20 }, (_, i) => ({ id: i })) };
  const resumo = obterResumoUso(db, { plan_code: 'essencial', status: 'internal_test' });
  assert.equal(resumo.status, 'internal_test');
  assert.equal(resumo.uso.farms, 20);
});

test('obterResumoUso não quebra com db nulo/undefined', () => {
  assert.doesNotThrow(() => obterResumoUso());
  assert.doesNotThrow(() => obterResumoUso(undefined, undefined));
  const resumo = obterResumoUso(null, null);
  assert.equal(resumo.uso.farms, 0);
  assert.equal(resumo.status, 'none');
});

test('getSubscriptionLimitMessage: mensagem amigável de limite de fazendas', () => {
  const evaluation = { allowed: false, limit: 1, reason: 'limit_exceeded' };
  const mensagem = getSubscriptionLimitMessage('farms', evaluation);
  assert.match(mensagem, /1 fazenda/);
  assert.match(mensagem, /plano superior/);
});

test('getSubscriptionLimitMessage: mensagem amigável de limite de cabeças', () => {
  const evaluation = { allowed: false, limit: 300, reason: 'limit_exceeded' };
  const mensagem = getSubscriptionLimitMessage('animals', evaluation);
  assert.match(mensagem, /limite de cabeças/);
});

test('getSubscriptionLimitMessage: retorna null quando o uso está dentro do limite', () => {
  const evaluation = { allowed: true, limit: 1 };
  assert.equal(getSubscriptionLimitMessage('farms', evaluation), null);
});

test('getModuleBlockedMessage: mensagem amigável sem termo técnico', () => {
  const mensagem = getModuleBlockedMessage();
  assert.match(mensagem, /outro plano/);
  assert.doesNotMatch(mensagem, /erro|exception|undefined|null/i);
});
