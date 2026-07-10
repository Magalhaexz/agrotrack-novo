import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularExpiraEm, conversaExpirada, mesclarDados, proximoCampoFaltante, estaCompleta,
} from './conversas.js';

const campos = [
  { nome: 'valor', pergunta: 'Qual o valor?' },
  { nome: 'descricao', pergunta: 'Qual a descrição?' },
  { nome: 'lote', pergunta: 'Pertence a algum lote?', obrigatorio: false },
];

test('proximoCampoFaltante segue a ordem e ignora opcionais', () => {
  assert.deepEqual(proximoCampoFaltante(campos, {}), { nome: 'valor', pergunta: 'Qual o valor?' });
  assert.deepEqual(proximoCampoFaltante(campos, { valor: 500 }), { nome: 'descricao', pergunta: 'Qual a descrição?' });
  assert.equal(proximoCampoFaltante(campos, { valor: 500, descricao: 'sal' }), null);
});

test('estaCompleta quando obrigatórios preenchidos', () => {
  assert.equal(estaCompleta(campos, { valor: 500, descricao: 'sal' }), true);
  assert.equal(estaCompleta(campos, { valor: 500 }), false);
});

test('mesclarDados não apaga com null/vazio', () => {
  assert.deepEqual(mesclarDados({ valor: 500 }, { descricao: 'sal' }), { valor: 500, descricao: 'sal' });
  assert.deepEqual(mesclarDados({ valor: 500 }, { valor: null }), { valor: 500 });
  assert.deepEqual(mesclarDados({ valor: 500 }, { valor: 800 }), { valor: 800 });
});

test('expiração', () => {
  const agora = new Date('2026-07-10T12:00:00Z');
  assert.equal(calcularExpiraEm(agora, 10).toISOString(), '2026-07-10T12:10:00.000Z');
  assert.equal(conversaExpirada({ expira_em: '2026-07-10T11:59:00Z' }, agora), true);
  assert.equal(conversaExpirada({ expira_em: '2026-07-10T12:05:00Z' }, agora), false);
});
