import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extrairValor, extrairPeso, extrairQuantidade, extrairData, extrairPeriodo,
  extrairNomeApos, parseNumeroBR, unidadeCanonica,
} from './extrairEntidades.js';

const HOJE = new Date(Date.UTC(2026, 6, 10)); // 2026-07-10, sexta-feira

test('parseNumeroBR aceita formato BR e extenso', () => {
  assert.equal(parseNumeroBR('1.234,56'), 1234.56);
  assert.equal(parseNumeroBR('500'), 500);
  assert.equal(parseNumeroBR('vinte'), 20);
  assert.equal(parseNumeroBR('mil'), 1000);
  assert.equal(parseNumeroBR('abc'), null);
});

test('extrairValor', () => {
  assert.equal(extrairValor('gastei 500 reais com sal'), 500);
  assert.equal(extrairValor('R$ 1.234,56'), 1234.56);
  assert.equal(extrairValor('recebi 15 mil pela venda'), 15000);
  assert.equal(extrairValor('2 mil reais'), 2000);
  assert.equal(extrairValor('sem valor aqui'), null);
});

test('extrairPeso', () => {
  assert.equal(extrairPeso('o lote pesou 470 quilos'), 470);
  assert.equal(extrairPeso('peso médio de 425 kg'), 425);
  assert.equal(extrairPeso('pesagem de 390'), 390);
});

test('extrairQuantidade com unidade canônica', () => {
  assert.deepEqual(extrairQuantidade('15 animais'), { quantidade: 15, unidade: 'animais' });
  assert.deepEqual(extrairQuantidade('20 sacos de sal'), { quantidade: 20, unidade: 'sacos' });
  assert.deepEqual(extrairQuantidade('10 cabeças'), { quantidade: 10, unidade: 'animais' });
  assert.deepEqual(extrairQuantidade('trinta animais'), { quantidade: 30, unidade: 'animais' });
  assert.equal(extrairQuantidade('sem quantidade'), null);
});

test('unidadeCanonica', () => {
  assert.equal(unidadeCanonica('quilos'), 'kg');
  assert.equal(unidadeCanonica('cabeças'), 'animais');
  assert.equal(unidadeCanonica('saca'), 'sacos');
});

test('extrairData relativa', () => {
  assert.equal(extrairData('registrar hoje', HOJE), '2026-07-10');
  assert.equal(extrairData('foi ontem', HOJE), '2026-07-09');
  assert.equal(extrairData('vence amanhã', HOJE), '2026-07-11');
});

test('extrairData dd/mm e dia N', () => {
  assert.equal(extrairData('no dia 15/08', HOJE), '2026-08-15');
  assert.equal(extrairData('12/03/2027', HOJE), '2027-03-12');
  assert.equal(extrairData('dia 15', HOJE), '2026-07-15');
  // dia já passado neste mês → próximo mês
  assert.equal(extrairData('dia 5', HOJE), '2026-08-05');
});

test('extrairData dia da semana → próxima ocorrência', () => {
  // 2026-07-10 é sexta; "sexta" → próxima sexta (17)
  assert.equal(extrairData('vacinar na sexta', HOJE), '2026-07-17');
  // segunda seguinte
  assert.equal(extrairData('segunda-feira', HOJE), '2026-07-13');
});

test('extrairPeriodo', () => {
  assert.deepEqual(extrairPeriodo('gastei este mês', HOJE), { inicio: '2026-07-01', fim: '2026-07-31' });
  assert.deepEqual(extrairPeriodo('mês passado', HOJE), { inicio: '2026-06-01', fim: '2026-06-30' });
  assert.deepEqual(extrairPeriodo('últimos 30 dias', HOJE), { inicio: '2026-06-10', fim: '2026-07-10' });
  assert.deepEqual(extrairPeriodo('hoje', HOJE), { inicio: '2026-07-10', fim: '2026-07-10' });
  assert.equal(extrairPeriodo('sem periodo', HOJE), null);
});

test('extrairNomeApos recorta nome de lote', () => {
  assert.equal(extrairNomeApos('registre pesagem no lote Engorda 02'), 'Engorda 02');
  assert.equal(extrairNomeApos('despesa para o lote Recria com ração'), 'Recria');
  assert.equal(extrairNomeApos('usar fazenda Santa Clara', ['fazenda']), 'Santa Clara');
});
