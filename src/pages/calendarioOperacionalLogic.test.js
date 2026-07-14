import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRotinaRecurrence, matchesEventoRecurrence } from './calendarioOperacionalLogic.js';

// Auditoria funcional: RotinaForm.jsx só oferece 'diaria' e 'semanal', mas
// matchesRotinaRecurrence não tratava 'diaria' — toda rotina diária ficava
// invisível no Calendário Operacional (caía no `return false` final).
test('rotina diária aparece em qualquer dia a partir do início', () => {
  const rotina = { recorrencia_tipo: 'diaria', data_inicio: '2026-07-01' };
  assert.equal(matchesRotinaRecurrence(rotina, new Date('2026-07-01T00:00:00')), true);
  assert.equal(matchesRotinaRecurrence(rotina, new Date('2026-07-15T00:00:00')), true);
});

test('rotina diária não aparece antes da data de início', () => {
  const rotina = { recorrencia_tipo: 'diaria', data_inicio: '2026-07-01' };
  assert.equal(matchesRotinaRecurrence(rotina, new Date('2026-06-30T00:00:00')), false);
});

test('rotina semanal segue tratada normalmente (sem regressão)', () => {
  const rotina = { recorrencia_tipo: 'semanal', dias_semana: [1, 3] };
  const segunda = new Date('2026-07-13T00:00:00'); // segunda-feira
  const terca = new Date('2026-07-14T00:00:00');
  assert.equal(matchesRotinaRecurrence(rotina, segunda), true);
  assert.equal(matchesRotinaRecurrence(rotina, terca), false);
});

// Regressão BB-14: "Novo evento" (Calendário) sempre ofereceu um select de
// Recorrência (Semanal/Quinzenal/Mensal/Anual), mas nada em
// CalendarioOperacionalPage.jsx lia esse metadata para gerar ocorrências —
// o evento só aparecia uma vez, na data de criação, mesmo com "Mensal"
// selecionado. Reproduzido ao vivo: evento criado 14/07 com recorrência
// mensal não aparecia em nenhum dia de agosto.
test('evento sem recorrência não repete', () => {
  const evento = { data_inicio: '2026-07-14', metadata: { recorrencia: 'nenhuma' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-14T00:00:00')), false);
});

test('evento semanal repete no mesmo dia da semana do início', () => {
  const evento = { data_inicio: '2026-07-14', metadata: { recorrencia: 'semanal' } }; // terça-feira
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-14T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-21T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-15T00:00:00')), false);
});

test('evento quinzenal repete a cada 14 dias a partir do início', () => {
  const evento = { data_inicio: '2026-07-01', metadata: { recorrencia: 'quinzenal' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-15T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-08T00:00:00')), false);
});

test('evento mensal repete no mesmo dia do mês, inclusive virada de ano', () => {
  const evento = { data_inicio: '2026-11-15', metadata: { recorrencia: 'mensal' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-12-15T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2027-01-15T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2027-01-14T00:00:00')), false);
});

// Dia 31: meses mais curtos não têm dia 31 — o evento simplesmente não
// ocorre nesses meses (mesmo comportamento já aceito para rotinas mensais).
test('evento mensal com início no dia 31 não ocorre em meses sem dia 31', () => {
  const evento = { data_inicio: '2026-01-31', metadata: { recorrencia: 'mensal' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-03-31T00:00:00')), true);
  const nenhumDiaDeFevereiroBate = Array.from({ length: 28 }, (_, i) => i + 1)
    .every((dia) => !matchesEventoRecurrence(evento, new Date(`2026-02-${String(dia).padStart(2, '0')}T00:00:00`)));
  assert.equal(nenhumDiaDeFevereiroBate, true);
});

test('evento anual repete no mesmo dia e mês, ano seguinte', () => {
  const evento = { data_inicio: '2026-02-14', metadata: { recorrencia: 'anual' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2027-02-14T00:00:00')), true);
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-03-14T00:00:00')), false);
});

test('evento anual iniciado em 29/02 só ocorre em anos bissextos', () => {
  const evento = { data_inicio: '2024-02-29', metadata: { recorrencia: 'anual' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2028-02-29T00:00:00')), true); // próximo bissexto
  const nenhumDiaDeFevereiro2026Bate = Array.from({ length: 28 }, (_, i) => i + 1)
    .every((dia) => !matchesEventoRecurrence(evento, new Date(`2026-02-${String(dia).padStart(2, '0')}T00:00:00`)));
  assert.equal(nenhumDiaDeFevereiro2026Bate, true);
});

test('evento recorrente não aparece antes da data de início', () => {
  const evento = { data_inicio: '2026-07-14', metadata: { recorrencia: 'semanal' } };
  assert.equal(matchesEventoRecurrence(evento, new Date('2026-07-07T00:00:00')), false);
});
