import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarRateLimitTelegram, LIMITE_PADRAO, LIMITE_VINCULO } from './telegramRateLimit.js';

const AGORA = new Date('2026-07-08T12:00:00.000Z');
const AGORA_MS = AGORA.getTime();

test('sem eventos recentes: permitido', () => {
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: [] });
  assert.equal(resultado.permitido, true);
  assert.equal(resultado.quantidadeNaJanela, 0);
});

test('chat_id ausente: bloqueia sem quebrar', () => {
  const resultado = avaliarRateLimitTelegram({ chatId: null, agora: AGORA, eventosRecentes: [] });
  assert.equal(resultado.permitido, false);
  assert.equal(resultado.motivo, 'chat_id_ausente');
});

test('abaixo do limite: permitido', () => {
  const eventos = Array.from({ length: LIMITE_PADRAO - 1 }, (_, i) => AGORA_MS - i * 1000);
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: eventos });
  assert.equal(resultado.permitido, true);
  assert.equal(resultado.quantidadeNaJanela, LIMITE_PADRAO - 1);
});

test('no limite: bloqueado com tempo de espera', () => {
  const eventos = Array.from({ length: LIMITE_PADRAO }, (_, i) => AGORA_MS - i * 1000);
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: eventos });
  assert.equal(resultado.permitido, false);
  assert.equal(resultado.motivo, 'rate_limit_excedido');
  assert.ok(resultado.tentarNovamenteEmSegundos > 0);
});

test('eventos fora da janela não contam', () => {
  const eventos = [AGORA_MS - 120_000, AGORA_MS - 90_000];
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: eventos, janelaSegundos: 60 });
  assert.equal(resultado.permitido, true);
  assert.equal(resultado.quantidadeNaJanela, 0);
});

test('janela expira e libera novamente', () => {
  const eventos = Array.from({ length: LIMITE_PADRAO }, (_, i) => AGORA_MS - 61_000 - i * 1000);
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: eventos, janelaSegundos: 60 });
  assert.equal(resultado.permitido, true);
  assert.equal(resultado.quantidadeNaJanela, 0);
});

test('limite de vínculo é mais generoso que o padrão', () => {
  assert.ok(LIMITE_VINCULO > LIMITE_PADRAO);
});

test('limite customizado é respeitado', () => {
  const eventos = [AGORA_MS - 1000, AGORA_MS - 2000];
  const resultado = avaliarRateLimitTelegram({ chatId: '123', agora: AGORA, eventosRecentes: eventos, limite: 2 });
  assert.equal(resultado.permitido, false);
});
