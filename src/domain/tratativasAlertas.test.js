import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS_TRATATIVA,
  validarStatusTratativa,
  deveExibirAlerta,
  aplicarTratativasAosAlertas,
  criarTratativaAlerta,
  resumirTratativas,
} from './tratativasAlertas.js';

const HOJE = '2026-07-08';

function makeAlerta(overrides = {}) {
  return { id: 'sanidade-carencia-10', origem: 'sanidade', tipo: 'carencia', titulo: 'Carência ativa', prioridade: 'critico', ...overrides };
}

function makeTratativa(overrides = {}) {
  return { alerta_id: 'sanidade-carencia-10', status: STATUS_TRATATIVA.EM_ANALISE, ...overrides };
}

// ── validarStatusTratativa ───────────────────────────────────────────────────

test('validarStatusTratativa aceita os 4 status oficiais', () => {
  assert.equal(validarStatusTratativa('em_analise'), true);
  assert.equal(validarStatusTratativa('resolvido'), true);
  assert.equal(validarStatusTratativa('adiado'), true);
  assert.equal(validarStatusTratativa('ignorado'), true);
});

test('validarStatusTratativa rejeita status desconhecido/nulo', () => {
  assert.equal(validarStatusTratativa('vencido'), false);
  assert.equal(validarStatusTratativa(''), false);
  assert.equal(validarStatusTratativa(null), false);
  assert.equal(validarStatusTratativa(undefined), false);
});

// ── deveExibirAlerta ─────────────────────────────────────────────────────────

test('deveExibirAlerta: alerta sem tratativa aparece', () => {
  assert.equal(deveExibirAlerta(makeAlerta(), null, HOJE), true);
});

test('deveExibirAlerta: em análise aparece', () => {
  assert.equal(deveExibirAlerta(makeAlerta(), makeTratativa({ status: STATUS_TRATATIVA.EM_ANALISE }), HOJE), true);
});

test('deveExibirAlerta: resolvido não aparece', () => {
  assert.equal(deveExibirAlerta(makeAlerta(), makeTratativa({ status: STATUS_TRATATIVA.RESOLVIDO }), HOJE), false);
});

test('deveExibirAlerta: ignorado não aparece', () => {
  assert.equal(deveExibirAlerta(makeAlerta(), makeTratativa({ status: STATUS_TRATATIVA.IGNORADO }), HOJE), false);
});

test('deveExibirAlerta: adiado para o futuro não aparece', () => {
  const tratativa = makeTratativa({ status: STATUS_TRATATIVA.ADIADO, adiado_ate: '2026-07-20' });
  assert.equal(deveExibirAlerta(makeAlerta(), tratativa, HOJE), false);
});

test('deveExibirAlerta: adiado vencido volta a aparecer', () => {
  const tratativa = makeTratativa({ status: STATUS_TRATATIVA.ADIADO, adiado_ate: '2026-07-01' });
  assert.equal(deveExibirAlerta(makeAlerta(), tratativa, HOJE), true);
});

test('deveExibirAlerta: adiado para hoje ainda fica oculto (só vence depois de hoje)', () => {
  const tratativa = makeTratativa({ status: STATUS_TRATATIVA.ADIADO, adiado_ate: HOJE });
  assert.equal(deveExibirAlerta(makeAlerta(), tratativa, HOJE), false);
});

test('deveExibirAlerta: adiado sem data válida não bloqueia (evita esconder por engano)', () => {
  const tratativa = makeTratativa({ status: STATUS_TRATATIVA.ADIADO, adiado_ate: null });
  assert.equal(deveExibirAlerta(makeAlerta(), tratativa, HOJE), true);
});

// ── aplicarTratativasAosAlertas ──────────────────────────────────────────────

test('aplicarTratativasAosAlertas anota statusTratativa e visivel para cada alerta', () => {
  const alertas = [makeAlerta({ id: 'a1' }), makeAlerta({ id: 'a2' })];
  const tratativas = [{ alerta_id: 'a1', status: STATUS_TRATATIVA.RESOLVIDO }];
  const resultado = aplicarTratativasAosAlertas(alertas, tratativas, HOJE);

  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].statusTratativa, STATUS_TRATATIVA.RESOLVIDO);
  assert.equal(resultado[0].visivel, false);
  assert.equal(resultado[1].statusTratativa, null);
  assert.equal(resultado[1].visivel, true);
});

test('aplicarTratativasAosAlertas nunca remove alertas da lista (histórico consultável)', () => {
  const alertas = [makeAlerta({ id: 'a1' })];
  const tratativas = [{ alerta_id: 'a1', status: STATUS_TRATATIVA.IGNORADO }];
  const resultado = aplicarTratativasAosAlertas(alertas, tratativas, HOJE);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].visivel, false);
});

test('aplicarTratativasAosAlertas é compatível com alertas legados sem id (nunca quebra)', () => {
  const alertas = [{ titulo: 'Alerta legado sem id' }];
  const resultado = aplicarTratativasAosAlertas(alertas, [{ alerta_id: 'x', status: STATUS_TRATATIVA.RESOLVIDO }], HOJE);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].statusTratativa, null);
  assert.equal(resultado[0].visivel, true);
});

test('aplicarTratativasAosAlertas não quebra com listas vazias/nulas', () => {
  assert.deepEqual(aplicarTratativasAosAlertas([], [], HOJE), []);
  assert.deepEqual(aplicarTratativasAosAlertas(null, null, HOJE), []);
});

// ── criarTratativaAlerta ─────────────────────────────────────────────────────

test('criarTratativaAlerta monta objeto válido para em_analise', () => {
  const tratativa = criarTratativaAlerta({
    alertaId: 'sanidade-carencia-10',
    alertaTipo: 'carencia',
    origem: 'sanidade',
    status: STATUS_TRATATIVA.EM_ANALISE,
    observacao: 'Verificando com o veterinário',
    ownerUserId: 'user-1',
    fazendaId: 3,
  });
  assert.equal(tratativa.alerta_id, 'sanidade-carencia-10');
  assert.equal(tratativa.status, STATUS_TRATATIVA.EM_ANALISE);
  assert.equal(tratativa.observacao, 'Verificando com o veterinário');
  assert.equal(tratativa.adiado_ate, null);
  assert.equal(tratativa.resolvido_em, null);
});

test('criarTratativaAlerta monta resolvido_em automaticamente quando status é resolvido', () => {
  const tratativa = criarTratativaAlerta({ alertaId: 'a1', status: STATUS_TRATATIVA.RESOLVIDO });
  assert.ok(tratativa.resolvido_em);
});

test('criarTratativaAlerta monta adiado_ate quando status é adiado', () => {
  const tratativa = criarTratativaAlerta({ alertaId: 'a1', status: STATUS_TRATATIVA.ADIADO, adiadoAte: '2026-07-20' });
  assert.equal(tratativa.adiado_ate, '2026-07-20');
});

test('criarTratativaAlerta rejeita status inválido', () => {
  assert.equal(criarTratativaAlerta({ alertaId: 'a1', status: 'vencido' }), null);
});

test('criarTratativaAlerta rejeita alertaId vazio', () => {
  assert.equal(criarTratativaAlerta({ alertaId: '', status: STATUS_TRATATIVA.EM_ANALISE }), null);
  assert.equal(criarTratativaAlerta({ status: STATUS_TRATATIVA.EM_ANALISE }), null);
});

// ── resumirTratativas ────────────────────────────────────────────────────────

test('resumirTratativas conta ativos/em análise/adiados/resolvidos/ignorados', () => {
  const alertas = aplicarTratativasAosAlertas(
    [makeAlerta({ id: 'a1' }), makeAlerta({ id: 'a2' }), makeAlerta({ id: 'a3' }), makeAlerta({ id: 'a4' }), makeAlerta({ id: 'a5' })],
    [
      { alerta_id: 'a1', status: STATUS_TRATATIVA.EM_ANALISE },
      { alerta_id: 'a2', status: STATUS_TRATATIVA.RESOLVIDO },
      { alerta_id: 'a3', status: STATUS_TRATATIVA.IGNORADO },
      { alerta_id: 'a4', status: STATUS_TRATATIVA.ADIADO, adiado_ate: '2026-07-20' },
      // a5 sem tratativa
    ],
    HOJE
  );
  const resumo = resumirTratativas(alertas);
  assert.equal(resumo.emAnalise, 1);
  assert.equal(resumo.resolvidos, 1);
  assert.equal(resumo.ignorados, 1);
  assert.equal(resumo.adiados, 1);
  // ativos = sem tratativa (a5) + em análise (a1) = 2
  assert.equal(resumo.ativos, 2);
});

test('resumirTratativas não quebra com lista vazia', () => {
  const resumo = resumirTratativas([]);
  assert.deepEqual(resumo, { ativos: 0, emAnalise: 0, adiados: 0, resolvidos: 0, ignorados: 0 });
});
