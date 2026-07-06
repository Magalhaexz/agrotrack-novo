import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarIntencaoTelegram, INTENCOES } from './telegramIntent.js';

test('classifica os comandos fixos', () => {
  assert.equal(classificarIntencaoTelegram('/ajuda'), INTENCOES.AJUDA);
  assert.equal(classificarIntencaoTelegram('/relatorio'), INTENCOES.RELATORIO);
  assert.equal(classificarIntencaoTelegram('/prioridades'), INTENCOES.PRIORIDADES);
  assert.equal(classificarIntencaoTelegram('/pagamentos'), INTENCOES.PAGAMENTOS);
  assert.equal(classificarIntencaoTelegram('/estoque'), INTENCOES.ESTOQUE);
  assert.equal(classificarIntencaoTelegram('/tarefas'), INTENCOES.TAREFAS);
  assert.equal(classificarIntencaoTelegram('/lotes'), INTENCOES.LOTES);
});

test('classifica as perguntas livres de exemplo do Sprint 8', () => {
  assert.equal(classificarIntencaoTelegram('O que preciso fazer hoje?'), INTENCOES.PRIORIDADES);
  assert.equal(classificarIntencaoTelegram('Tem conta vencida?'), INTENCOES.PAGAMENTOS);
  assert.equal(classificarIntencaoTelegram('Tem produto acabando?'), INTENCOES.ESTOQUE);
  assert.equal(classificarIntencaoTelegram('Qual lote está pior?'), INTENCOES.LOTES);
  assert.equal(classificarIntencaoTelegram('Tenho lote pronto para venda?'), INTENCOES.LOTES);
  assert.equal(classificarIntencaoTelegram('Tem tarefa atrasada?'), INTENCOES.TAREFAS);
  assert.equal(classificarIntencaoTelegram('Como está minha fazenda hoje?'), INTENCOES.RELATORIO);
});

test('é insensível a maiúsculas/espaços e ignora texto sem palavra-chave conhecida', () => {
  assert.equal(classificarIntencaoTelegram('  TEM CONTA VENCIDA?  '), INTENCOES.PAGAMENTOS);
  assert.equal(classificarIntencaoTelegram('bom dia'), INTENCOES.DESCONHECIDO);
  assert.equal(classificarIntencaoTelegram(''), INTENCOES.DESCONHECIDO);
  assert.equal(classificarIntencaoTelegram(null), INTENCOES.DESCONHECIDO);
});
