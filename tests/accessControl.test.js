import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVOS_BLOQUEIO,
  TOLERANCIA_ATRASO_DIAS,
  buildAccountAccessGate,
  canAccessApp,
  canUseFeature,
  getAccountStatus,
  getBlockedReason,
  isAccountBlocked,
} from '../src/services/accessControl.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-07-02T12:00:00Z').getTime();

function diasAtras(dias) {
  return new Date(AGORA - dias * DIA_MS).toISOString();
}

function diasAFrente(dias) {
  return new Date(AGORA + dias * DIA_MS).toISOString();
}

// Cenário 1 — usuário novo sem assinatura: cai no bloqueio, não acessa o app.
test('conta sem assinatura é bloqueada com motivo sem_plano', () => {
  const gate = buildAccountAccessGate(null, { now: AGORA });
  assert.equal(gate.allowed, false);
  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, MOTIVOS_BLOQUEIO.SEM_PLANO);
  assert.equal(isAccountBlocked(null, null, { now: AGORA }), true);
  assert.equal(getBlockedReason(null, null, { now: AGORA }), MOTIVOS_BLOQUEIO.SEM_PLANO);
});

// Cenário 2 — trial ativo dentro do prazo: acessa.
test('trial ativo dentro do prazo acessa o app', () => {
  const sub = { status: 'trialing', plan_code: 'pro', trial_ends_at: diasAFrente(5) };
  const gate = buildAccountAccessGate(sub, { now: AGORA });
  assert.equal(gate.allowed, true);
  assert.equal(gate.blocked, false);
});

// Cenário 3 — trial vencido: bloqueia.
test('trial vencido bloqueia com motivo trial_vencido', () => {
  const sub = { status: 'trialing', plan_code: 'pro', trial_ends_at: diasAtras(1) };
  const gate = buildAccountAccessGate(sub, { now: AGORA });
  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, MOTIVOS_BLOQUEIO.TRIAL_VENCIDO);
});

test('trial sem trial_ends_at usa fim do período corrente', () => {
  const vencido = { status: 'trialing', plan_code: 'pro', current_period_end: diasAtras(2) };
  assert.equal(buildAccountAccessGate(vencido, { now: AGORA }).blocked, true);
  const vigente = { status: 'trialing', plan_code: 'pro', current_period_end: diasAFrente(2) };
  assert.equal(buildAccountAccessGate(vigente, { now: AGORA }).allowed, true);
});

// Cenário 4 — pagamento ativo: acessa.
test('assinatura active acessa o app sem aviso', () => {
  const gate = buildAccountAccessGate({ status: 'active', plan_code: 'essencial' }, { now: AGORA });
  assert.equal(gate.allowed, true);
  assert.equal(gate.warning, false);
});

// Cenário 5 — atraso dentro da tolerância: acessa com aviso.
test('past_due dentro da tolerância acessa com aviso', () => {
  const sub = { status: 'past_due', plan_code: 'pro', current_period_end: diasAtras(TOLERANCIA_ATRASO_DIAS - 1) };
  const gate = buildAccountAccessGate(sub, { now: AGORA });
  assert.equal(gate.allowed, true);
  assert.equal(gate.warning, true);
});

test('past_due fora da tolerância bloqueia com motivo pagamento_vencido', () => {
  const sub = { status: 'past_due', plan_code: 'pro', current_period_end: diasAtras(TOLERANCIA_ATRASO_DIAS + 1) };
  const gate = buildAccountAccessGate(sub, { now: AGORA });
  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, MOTIVOS_BLOQUEIO.PAGAMENTO_VENCIDO);
});

// Cenário 6 — conta bloqueada/cancelada: não acessa.
test('canceled e blocked bloqueiam o app', () => {
  assert.equal(buildAccountAccessGate({ status: 'canceled', plan_code: 'pro' }, { now: AGORA }).reason, MOTIVOS_BLOQUEIO.CANCELADA);
  assert.equal(buildAccountAccessGate({ status: 'blocked', plan_code: 'pro' }, { now: AGORA }).reason, MOTIVOS_BLOQUEIO.BLOQUEADA);
});

// Exceções controladas: piloto interno e override nunca bloqueiam.
test('internal_test e override interno nunca bloqueiam', () => {
  assert.equal(buildAccountAccessGate({ status: 'internal_test', plan_code: 'fundador' }, { now: AGORA }).allowed, true);
  assert.equal(buildAccountAccessGate({ status: 'blocked', internal_override: true }, { now: AGORA }).allowed, true);
  assert.equal(getAccountStatus(null, { status: 'canceled', override: true }, { now: AGORA }), 'admin_override');
});

// P1-06: falha ao consultar a assinatura (rede/RLS) bloqueia escrita — antes
// (bug corrigido por este ticket) o gate falhava ABERTO aqui, permitindo
// gravação como se a conta estivesse liberada.
test('erro ao consultar assinatura bloqueia (fail-closed), com motivo e mensagem neutros', () => {
  const gate = buildAccountAccessGate(null, { now: AGORA, subscriptionLoadError: new Error('rede') });
  assert.equal(gate.allowed, false);
  assert.equal(gate.blocked, true);
  assert.equal(gate.reason, MOTIVOS_BLOQUEIO.ERRO_CONSULTA);
  assert.equal(gate.reason, 'subscription_check_unavailable');
  // Mensagem nunca expõe o erro real (rede/RLS/provedor) — só orienta a repetir.
  assert.doesNotMatch(gate.message, /rede|error|Error|RLS|network/i);
  assert.match(gate.message, /tente novamente/i);
});

test('erro de consulta bloqueia mesmo quando um valor de assinatura (cache antigo) é passado', () => {
  // Simula App.jsx caindo de volta para um valor local stale quando a
  // consulta atual falhou — a assinatura "active" não deve mascarar o erro.
  const cacheAntigo = { status: 'active', plan_code: 'pro' };
  const gate = buildAccountAccessGate(cacheAntigo, { now: AGORA, subscriptionLoadError: new Error('rede') });
  assert.equal(gate.allowed, false);
  assert.equal(gate.reason, MOTIVOS_BLOQUEIO.ERRO_CONSULTA);
});

test('erro de consulta nunca é tratado como "sem plano"', () => {
  const gate = buildAccountAccessGate(null, { now: AGORA, subscriptionLoadError: new Error('timeout') });
  assert.notEqual(gate.reason, MOTIVOS_BLOQUEIO.SEM_PLANO);
  assert.notEqual(gate.status, 'none');
});

test('admin bootstrap continua acessando mesmo com erro de consulta (exceção interna já existente)', () => {
  const admin = { email: 'magalhaesh617@gmail.com' };
  const gate = buildAccountAccessGate(null, { now: AGORA, user: admin, subscriptionLoadError: new Error('rede') });
  assert.equal(gate.allowed, true);
  assert.equal(gate.status, 'admin_override');
});

// Cenários 7 e 8 — subusuário herda o status da assinatura do proprietário
// (a assinatura avaliada é sempre a da conta, carregada via owner_user_id).
test('subusuário de conta ativa acessa; de conta bloqueada, não', () => {
  const contaAtiva = { status: 'active', plan_code: 'pro', owner_user_id: 'dono-1' };
  const contaBloqueada = { status: 'blocked', plan_code: 'pro', owner_user_id: 'dono-1' };
  const subusuario = { id: 'sub-1', email: 'operador@fazenda.com' };
  assert.equal(canAccessApp(subusuario, { perfil: 'operador' }, contaAtiva, { now: AGORA }), true);
  assert.equal(canAccessApp(subusuario, { perfil: 'operador' }, contaBloqueada, { now: AGORA }), false);
});

// Cenário 9 — visualizador não cria/edita.
test('visualizador não pode editar, mesmo com conta ativa', () => {
  const conta = { status: 'active', plan_code: 'premium' };
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'visualizador' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('financeiro:editar', { perfil: 'visualizador' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('pesagens', { perfil: 'visualizador' }, conta, { now: AGORA }), true);
});

// Cenário 10 — operador lança dados operacionais mas não acessa cobrança/plano.
test('operador lança dados mas não gerencia assinatura', () => {
  const conta = { status: 'active', plan_code: 'premium' };
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'operador' }, conta, { now: AGORA }), true);
  assert.equal(canUseFeature('sanitario:editar', { perfil: 'operador' }, conta, { now: AGORA }), true);
  assert.equal(canUseFeature('assinatura:gerenciar', { perfil: 'operador' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('minhaAssinatura', { perfil: 'operador' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('assinatura:gerenciar', { perfil: 'gerente' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('assinatura:gerenciar', { perfil: 'admin' }, conta, { now: AGORA }), true);
});

// Módulo fora do plano é negado mesmo para o proprietário.
test('módulo fora do plano é negado (cenarios não faz parte do essencial)', () => {
  const contaEssencial = { status: 'active', plan_code: 'essencial' };
  assert.equal(canUseFeature('cenarios', { perfil: 'admin' }, contaEssencial, { now: AGORA }), false);
  const contaPremium = { status: 'active', plan_code: 'premium' };
  assert.equal(canUseFeature('cenarios', { perfil: 'admin' }, contaPremium, { now: AGORA }), true);
});

// Conta bloqueada não usa nenhuma feature, independente do papel.
test('conta bloqueada nega qualquer feature', () => {
  const conta = { status: 'canceled', plan_code: 'premium' };
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'admin' }, conta, { now: AGORA }), false);
  assert.equal(canUseFeature('dashboard', { perfil: 'admin' }, conta, { now: AGORA }), false);
});
