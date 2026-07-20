import test from 'node:test';
import assert from 'node:assert/strict';
import { construirAgendaSanitaria, verificarCarenciaAtivaLote } from './agendaSanitaria.js';

const AGORA = new Date('2026-07-10T12:00:00Z');
const db = {
  lotes: [{ id: 1, nome: 'Lote A' }, { id: 2, nome: 'Lote B' }],
  sanitario: [
    { id: 1, tipo: 'vacina', desc: 'Aftosa', lote_id: 1, data_aplic: '2026-06-01', proxima: '2026-07-01' }, // vencido
    { id: 2, tipo: 'vermifugo', desc: 'Vermífugo', lote_id: 1, data_aplic: '2026-07-01', proxima: '2026-07-10' }, // vence hoje
    { id: 3, tipo: 'vacina', desc: 'Brucelose', lote_id: 2, data_aplic: '2026-07-01', proxima: '2026-07-14' }, // próximo 7 dias
    { id: 4, tipo: 'exame', desc: 'Exame de rotina', lote_id: 2, data_aplic: '2026-07-01', proxima: '2026-08-01' }, // próximo 30 dias
    { id: 5, tipo: 'medicamento', desc: 'Antibiótico', lote_id: 1, data_aplic: '2026-06-15' }, // sem próxima — só realizado
    { id: 6, tipo: 'medicamento', desc: 'Antibiótico com carência', lote_id: 2, data_aplic: '2026-07-08', data_fim_carencia: '2026-07-15' }, // em carência
    { id: 7, tipo: 'medicamento', desc: 'Carência já terminada', lote_id: 1, data_aplic: '2026-06-01', data_fim_carencia: '2026-06-10' }, // carência vencida, não deve entrar
  ],
};

test('construirAgendaSanitaria separa vencidos, vencendo hoje, próximos 7/30 dias', () => {
  const agenda = construirAgendaSanitaria(db, { agora: AGORA });

  assert.equal(agenda.vencidos.length, 1);
  assert.equal(agenda.vencidos[0].produto, 'Aftosa');
  assert.equal(agenda.vencidos[0].status, 'vencido');

  assert.equal(agenda.vencendoHoje.length, 1);
  assert.equal(agenda.vencendoHoje[0].produto, 'Vermífugo');

  assert.equal(agenda.proximos7Dias.length, 1);
  assert.equal(agenda.proximos7Dias[0].produto, 'Brucelose');

  assert.equal(agenda.proximos30Dias.length, 1);
  assert.equal(agenda.proximos30Dias[0].produto, 'Exame de rotina');
});

test('construirAgendaSanitaria lista realizados por data de aplicação mais recente', () => {
  const agenda = construirAgendaSanitaria(db, { agora: AGORA });
  assert.ok(agenda.realizados.length >= 6);
  assert.equal(agenda.realizados[0].produto, 'Antibiótico com carência');
});

test('construirAgendaSanitaria só lista carência ainda não terminada', () => {
  const agenda = construirAgendaSanitaria(db, { agora: AGORA });
  assert.equal(agenda.emCarencia.length, 1);
  assert.equal(agenda.emCarencia[0].produto, 'Antibiótico com carência');
  assert.equal(agenda.emCarencia[0].loteNome, 'Lote B');
});

test('construirAgendaSanitaria não quebra com db vazio', () => {
  const agenda = construirAgendaSanitaria({}, { agora: AGORA });
  assert.deepEqual(agenda, {
    vencidos: [],
    vencendoHoje: [],
    proximos7Dias: [],
    proximos30Dias: [],
    realizados: [],
    emCarencia: [],
  });
});

// ── verificarCarenciaAtivaLote (Onda A — UX-SAN1: venda bloqueada em carência) ──

test('verificarCarenciaAtivaLote: lote com carência ativa bloqueia', () => {
  const resultado = verificarCarenciaAtivaLote(db.sanitario, 2, '2026-07-10');
  assert.equal(resultado.ativa, true);
  assert.equal(resultado.produto, 'Antibiótico com carência');
  assert.equal(resultado.dataFim, '2026-07-15');
});

test('verificarCarenciaAtivaLote: carência já vencida não bloqueia', () => {
  const resultado = verificarCarenciaAtivaLote(db.sanitario, 1, '2026-07-10');
  assert.equal(resultado.ativa, false);
});

test('verificarCarenciaAtivaLote: lote sem nenhum registro sanitário não bloqueia', () => {
  const resultado = verificarCarenciaAtivaLote(db.sanitario, 99, '2026-07-10');
  assert.equal(resultado.ativa, false);
});

test('verificarCarenciaAtivaLote: no dia exato do fim da carência ainda bloqueia (>= 0)', () => {
  const resultado = verificarCarenciaAtivaLote(db.sanitario, 2, '2026-07-15');
  assert.equal(resultado.ativa, true);
});

test('verificarCarenciaAtivaLote: um dia após o fim da carência libera', () => {
  const resultado = verificarCarenciaAtivaLote(db.sanitario, 2, '2026-07-16');
  assert.equal(resultado.ativa, false);
});

test('verificarCarenciaAtivaLote: usa o fim de carência mais restritivo quando há mais de um', () => {
  const registros = [
    { id: 1, desc: 'Vacina A', lote_id: 5, data_fim_carencia: '2026-07-12' },
    { id: 2, desc: 'Vacina B (mais restritiva)', lote_id: 5, data_fim_carencia: '2026-07-20' },
  ];
  const resultado = verificarCarenciaAtivaLote(registros, 5, '2026-07-10');
  assert.equal(resultado.ativa, true);
  assert.equal(resultado.produto, 'Vacina B (mais restritiva)');
  assert.equal(resultado.dataFim, '2026-07-20');
});

test('verificarCarenciaAtivaLote: tolerante a loteId nulo e lista vazia/nula', () => {
  assert.equal(verificarCarenciaAtivaLote(db.sanitario, null, '2026-07-10').ativa, false);
  assert.equal(verificarCarenciaAtivaLote(null, 2, '2026-07-10').ativa, false);
  assert.equal(verificarCarenciaAtivaLote([], 2, '2026-07-10').ativa, false);
});
