import test from 'node:test';
import assert from 'node:assert/strict';
import { construirAgendaSanitaria } from './agendaSanitaria.js';

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
