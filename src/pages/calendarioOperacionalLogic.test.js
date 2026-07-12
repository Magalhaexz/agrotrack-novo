import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesRotinaRecurrence } from './calendarioOperacionalLogic.js';

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
