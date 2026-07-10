import test from 'node:test';
import assert from 'node:assert/strict';
import { podeExecutarComandoTelegram, intencaoEhMutavel } from './permissoesTelegram.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

test('visualizador consulta mas não transfere', () => {
  assert.equal(podeExecutarComandoTelegram('visualizador', INTENCOES.LISTAR_LOTES).permitido, true);
  assert.equal(podeExecutarComandoTelegram('visualizador', INTENCOES.CONSULTAR_ESTOQUE).permitido, true);
  assert.equal(podeExecutarComandoTelegram('visualizador', INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES).permitido, false);
  assert.equal(podeExecutarComandoTelegram('visualizador', INTENCOES.RENOMEAR_LOTE).permitido, false);
});

test('operador e gerente podem transferir animais', () => {
  assert.equal(podeExecutarComandoTelegram('operador', INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES).permitido, true);
  assert.equal(podeExecutarComandoTelegram('gerente', INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES).permitido, true);
});

test('proprietário pode tudo', () => {
  for (const intencao of Object.values(INTENCOES)) {
    assert.equal(podeExecutarComandoTelegram('proprietario', intencao).permitido, true, intencao);
  }
});

test('operador não renomeia lote (não tem lotes:editar? — tem) mas visualizador não', () => {
  // operador tem 'lotes:editar' na matriz → pode renomear
  assert.equal(podeExecutarComandoTelegram('operador', INTENCOES.RENOMEAR_LOTE).permitido, true);
  assert.equal(podeExecutarComandoTelegram('visualizador', INTENCOES.RENOMEAR_LOTE).permitido, false);
});

test('ajuda/confirmar/cancelar/desconhecido não exigem permissão', () => {
  for (const intencao of [INTENCOES.AJUDA, INTENCOES.CONFIRMAR, INTENCOES.CANCELAR, INTENCOES.AMBIGUO, INTENCOES.DESCONHECIDO]) {
    assert.equal(podeExecutarComandoTelegram('visualizador', intencao).permitido, true, intencao);
  }
});

test('perfil desconhecido cai para visualizador (não escala privilégio)', () => {
  assert.equal(podeExecutarComandoTelegram('qualquer_coisa', INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES).permitido, false);
  assert.equal(podeExecutarComandoTelegram(null, INTENCOES.CONSULTAR_FINANCEIRO).permitido, true);
});

test('intencaoEhMutavel', () => {
  assert.equal(intencaoEhMutavel(INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES), true);
  assert.equal(intencaoEhMutavel(INTENCOES.RENOMEAR_LOTE), true);
  assert.equal(intencaoEhMutavel(INTENCOES.LISTAR_LOTES), false);
});
