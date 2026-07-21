import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOTIVOS_BLOQUEIO,
  TOLERANCIA_ATRASO_DIAS,
  SubscriptionRequiredError,
  WRITE_BLOCKED_MESSAGE,
  canViewApp,
  canWriteData,
  requiresSubscriptionForWrite,
  getWriteBlockedReason,
  canUseFeature,
} from '../src/services/accessControl.js';
import {
  configureWriteAccess,
  resetWriteAccess,
  isWriteAllowed,
  guardWrite,
} from '../src/services/writeGuard.js';
import {
  createOperationalRecord,
  updateOperationalRecord,
  deleteOperationalRecord,
} from '../src/services/operationalPersistence.js';

const DIA = 24 * 60 * 60 * 1000;
const AGORA = new Date('2026-07-02T12:00:00Z').getTime();
const iso = (ms) => new Date(ms).toISOString();
const PERFIL_LOGADO = { id: 'user-1', perfil: 'admin' };

// ---------------------------------------------------------------------------
// Matriz oficial: VER sempre liberado; ESCREVER exige plano (Parte 11)
// ---------------------------------------------------------------------------
const MATRIZ = [
  ['sem assinatura', null, { view: true, write: false, reason: MOTIVOS_BLOQUEIO.SEM_PLANO }],
  ['trial ativo', { status: 'trialing', plan_code: 'pro', trial_ends_at: iso(AGORA + 5 * DIA) }, { view: true, write: true }],
  ['trial vencido', { status: 'trialing', plan_code: 'pro', trial_ends_at: iso(AGORA - DIA) }, { view: true, write: false, reason: MOTIVOS_BLOQUEIO.TRIAL_VENCIDO }],
  ['active', { status: 'active', plan_code: 'essencial' }, { view: true, write: true }],
  ['past_due na tolerância', { status: 'past_due', plan_code: 'pro', current_period_end: iso(AGORA - (TOLERANCIA_ATRASO_DIAS - 1) * DIA) }, { view: true, write: true }],
  ['past_due fora da tolerância', { status: 'past_due', plan_code: 'pro', current_period_end: iso(AGORA - (TOLERANCIA_ATRASO_DIAS + 1) * DIA) }, { view: true, write: false, reason: MOTIVOS_BLOQUEIO.PAGAMENTO_VENCIDO }],
  ['canceled', { status: 'canceled', plan_code: 'pro' }, { view: true, write: false, reason: MOTIVOS_BLOQUEIO.CANCELADA }],
  ['blocked', { status: 'blocked', plan_code: 'pro' }, { view: true, write: false, reason: MOTIVOS_BLOQUEIO.BLOQUEADA }],
];

for (const [nome, sub, esperado] of MATRIZ) {
  test(`matriz view/write — ${nome}`, () => {
    assert.equal(canViewApp(PERFIL_LOGADO, sub, { now: AGORA }), esperado.view, `${nome}: view`);
    assert.equal(canWriteData(PERFIL_LOGADO, sub, { now: AGORA }), esperado.write, `${nome}: write`);
    assert.equal(requiresSubscriptionForWrite(PERFIL_LOGADO, sub, { now: AGORA }), !esperado.write, `${nome}: requires`);
    if (esperado.reason) {
      assert.equal(getWriteBlockedReason(PERFIL_LOGADO, sub, { now: AGORA }), esperado.reason, `${nome}: reason`);
    } else {
      assert.equal(getWriteBlockedReason(PERFIL_LOGADO, sub, { now: AGORA }), null, `${nome}: sem motivo`);
    }
  });
}

// ---------------------------------------------------------------------------
// P1-06: falha ao consultar a assinatura bloqueia escrita (fail-closed) — leitura
// continua disponível. Antes deste ticket, `canWriteData` liberava a escrita
// quando a consulta falhava (fail-open), tratando erro como "plano ativo".
// ---------------------------------------------------------------------------

test('erro na consulta de assinatura bloqueia escrita, mas leitura continua disponível', () => {
  const opcoes = { now: AGORA, subscriptionLoadError: new Error('falha de rede') };
  assert.equal(canViewApp(PERFIL_LOGADO, null, opcoes), true, 'leitura disponível mesmo com erro');
  assert.equal(canWriteData(PERFIL_LOGADO, null, opcoes), false, 'escrita bloqueada com erro');
  assert.equal(requiresSubscriptionForWrite(PERFIL_LOGADO, null, opcoes), true);
  assert.equal(getWriteBlockedReason(PERFIL_LOGADO, null, opcoes), MOTIVOS_BLOQUEIO.ERRO_CONSULTA);
});

test('erro na consulta bloqueia escrita mesmo com assinatura anterior (cache antigo) ativa', () => {
  // Um `subscription` "active" não deve mascarar um erro de consulta atual —
  // a autoridade é a consulta de agora, não o que sobrou de um cache local.
  const cacheAntigo = { status: 'active', plan_code: 'pro' };
  const opcoes = { now: AGORA, subscriptionLoadError: new Error('timeout') };
  assert.equal(canWriteData(PERFIL_LOGADO, cacheAntigo, opcoes), false);
});

test('estado de assinatura desconhecido (status fora do catálogo) bloqueia escrita', () => {
  const subDesconhecida = { status: 'algo_nunca_visto', plan_code: 'pro' };
  assert.equal(canWriteData(PERFIL_LOGADO, subDesconhecida, { now: AGORA }), false);
  assert.equal(canViewApp(PERFIL_LOGADO, subDesconhecida, { now: AGORA }), true, 'leitura não depende do status');
});

test('mensagem de erro de consulta nunca expõe detalhes técnicos (rede/RLS/provedor)', () => {
  const opcoes = { now: AGORA, subscriptionLoadError: new Error('PGRST301: JWT expired') };
  const reason = getWriteBlockedReason(PERFIL_LOGADO, null, opcoes);
  assert.equal(reason, MOTIVOS_BLOQUEIO.ERRO_CONSULTA);
  // A mensagem pública do paywall (usada em toda a UI) é sempre a mesma frase
  // genérica — nunca deriva do texto do erro real.
  assert.doesNotMatch(WRITE_BLOCKED_MESSAGE, /PGRST|JWT|expired/i);
});

test('erro de consulta não gera NaN, exceção nem estado permissivo, mesmo com entradas malformadas', () => {
  const entradasEstranhas = [undefined, null, {}, { status: null }, { status: 123 }, []];
  for (const sub of entradasEstranhas) {
    const opcoes = { now: AGORA, subscriptionLoadError: new Error('rede') };
    assert.doesNotThrow(() => canWriteData(PERFIL_LOGADO, sub, opcoes));
    assert.equal(canWriteData(PERFIL_LOGADO, sub, opcoes), false, `sub=${JSON.stringify(sub)}`);
  }
});

// Subusuário herda o status do proprietário (a assinatura avaliada é a da conta).
test('subusuário de conta ativa escreve conforme papel; de conta bloqueada não escreve', () => {
  const contaAtiva = { status: 'active', plan_code: 'premium', owner_user_id: 'dono-1' };
  const contaBloqueada = { status: 'blocked', plan_code: 'premium', owner_user_id: 'dono-1' };

  // dono ativo: papel decide
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'operador' }, contaAtiva, { now: AGORA }), true);
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'visualizador' }, contaAtiva, { now: AGORA }), false);

  // dono bloqueado: ninguém escreve, mas todos veem
  assert.equal(canViewApp({ id: 'sub-1', perfil: 'gerente' }, contaBloqueada, { now: AGORA }), true);
  assert.equal(canWriteData({ id: 'sub-1', perfil: 'gerente' }, contaBloqueada, { now: AGORA }), false);
  assert.equal(canUseFeature('pesagens:editar', { perfil: 'gerente' }, contaBloqueada, { now: AGORA }), false);
});

// Visualizador não escreve mesmo com plano ativo (papel bloqueia).
test('visualizador com plano ativo pode ver mas não escrever', () => {
  const contaAtiva = { status: 'active', plan_code: 'premium' };
  assert.equal(canViewApp({ id: 'v-1', perfil: 'visualizador' }, contaAtiva, { now: AGORA }), true);
  assert.equal(canUseFeature('lotes:editar', { perfil: 'visualizador' }, contaAtiva, { now: AGORA }), false);
  assert.equal(canUseFeature('lotes:ver', { perfil: 'visualizador' }, contaAtiva, { now: AGORA }), true);
});

test('SubscriptionRequiredError tem código e mensagem comerciais', () => {
  const err = new SubscriptionRequiredError();
  assert.equal(err.code, 'SUBSCRIPTION_REQUIRED');
  assert.equal(err.name, 'SubscriptionRequiredError');
  assert.equal(err.message, WRITE_BLOCKED_MESSAGE);
  assert.ok(err instanceof Error);
});

// ---------------------------------------------------------------------------
// Runtime: o serviço central de persistência barra a escrita sem tocar a rede
// ---------------------------------------------------------------------------
test('writeGuard default é permissivo (contas pagantes/testes não afetadas)', () => {
  resetWriteAccess();
  assert.equal(isWriteAllowed(), true);
  assert.equal(guardWrite('lotes.create'), true);
});

test('createOperationalRecord bloqueia gravação em modo visualização e redireciona', async () => {
  const redirecionamentos = [];
  configureWriteAccess({ canWrite: false, reason: 'sem_plano', onBlockedWrite: (info) => redirecionamentos.push(info) });
  try {
    const session = { user: { id: 'user-1' } };
    const create = await createOperationalRecord('lotes', { nome: 'Lote Teste' }, session);
    assert.equal(create.persisted, false);
    assert.equal(create.blocked, true);
    assert.equal(create.code, 'SUBSCRIPTION_REQUIRED');
    assert.equal(create.error, WRITE_BLOCKED_MESSAGE);

    const update = await updateOperationalRecord('lotes', 10, { nome: 'x' }, session);
    assert.equal(update.code, 'SUBSCRIPTION_REQUIRED');

    const del = await deleteOperationalRecord('lotes', 10, session);
    assert.equal(del.code, 'SUBSCRIPTION_REQUIRED');

    // Cada tentativa dispara o redirecionamento central para assinatura.
    assert.equal(redirecionamentos.length, 3);
    assert.equal(redirecionamentos[0].reason, 'sem_plano');
    assert.ok(String(redirecionamentos[0].feature).startsWith('lotes.'));
  } finally {
    resetWriteAccess();
  }
});

test('tabelas de notificação pessoal são isentas do paywall de escrita', async () => {
  configureWriteAccess({ canWrite: false, reason: 'sem_plano' });
  try {
    const session = { user: { id: 'user-1' } };
    // alertas_resolvidos é isenta: NÃO retorna SUBSCRIPTION_REQUIRED (segue o fluxo normal).
    const res = await createOperationalRecord('alertas_resolvidos', { chave: 'x', resolvedAt: iso(AGORA) }, session);
    assert.notEqual(res.code, 'SUBSCRIPTION_REQUIRED');
    assert.notEqual(res.blocked, true);
  } finally {
    resetWriteAccess();
  }
});
