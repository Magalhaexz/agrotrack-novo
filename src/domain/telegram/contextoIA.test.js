import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularExpiraContexto, contextoExpirado, adicionarTurno,
  construirHistoricoParaClaude, comandoDeControle, CONTEXTO_MAX_TURNOS,
} from './contextoIA.js';

test('expira exatamente 20 minutos à frente', () => {
  const agora = new Date('2026-07-15T10:00:00Z');
  const exp = calcularExpiraContexto(agora);
  assert.equal(exp.toISOString(), '2026-07-15T10:20:00.000Z');
});

test('contexto expirado quando expira_em já passou', () => {
  const agora = new Date('2026-07-15T10:30:00Z');
  assert.equal(contextoExpirado({ expira_em: '2026-07-15T10:00:00Z' }, agora), true);
  assert.equal(contextoExpirado({ expira_em: '2026-07-15T11:00:00Z' }, agora), false);
});

test('adicionarTurno acrescenta usuário+assistente e respeita o limite de turnos', () => {
  let mensagens = [];
  for (let i = 0; i < CONTEXTO_MAX_TURNOS + 3; i += 1) {
    mensagens = adicionarTurno(mensagens, { textoUsuario: `pergunta ${i}`, textoAssistente: `resposta ${i}` });
  }
  assert.equal(mensagens.length, CONTEXTO_MAX_TURNOS * 2);
  // mantém os MAIS RECENTES, não os mais antigos
  assert.equal(mensagens[mensagens.length - 2].content, `pergunta ${CONTEXTO_MAX_TURNOS + 2}`);
});

test('construirHistoricoParaClaude filtra entradas vazias/roles inválidas', () => {
  const h = construirHistoricoParaClaude([
    { role: 'user', content: 'quanto sal eu tenho?' },
    { role: 'assistant', content: 'há 320 kg' },
    { role: 'system', content: 'não deve aparecer' },
    { role: 'user', content: '   ' },
    null,
  ]);
  assert.equal(h.length, 2);
  assert.deepEqual(h[0], { role: 'user', content: 'quanto sal eu tenho?' });
});

test('comandoDeControle reconhece os comandos da seção 5', () => {
  assert.equal(comandoDeControle('cancelar'), 'cancelar');
  assert.equal(comandoDeControle('/cancelar'), 'cancelar');
  assert.equal(comandoDeControle('para'), 'cancelar');
  assert.equal(comandoDeControle('começar de novo'), 'recomecar');
  assert.equal(comandoDeControle('limpar conversa'), 'recomecar');
  assert.equal(comandoDeControle('trocar fazenda'), 'trocar_fazenda');
  assert.equal(comandoDeControle('menu'), 'menu');
  assert.equal(comandoDeControle('ajuda'), 'ajuda');
  assert.equal(comandoDeControle('quanto gado eu tenho?'), null);
});
