/* global process */
import test from 'node:test';
import assert from 'node:assert/strict';
import { iaDisponivel, chamarClaudeParaTelegram } from './_anthropicClient.js';

test('iaDisponivel reflete a presença de ANTHROPIC_API_KEY', () => {
  const original = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(iaDisponivel(), false);
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-para-teste';
    assert.equal(iaDisponivel(), true);
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = original;
  }
});

test('sem chave configurada, nunca lança exceção — devolve {type:"erro"} (habilita o fallback sem IA)', async () => {
  const original = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await chamarClaudeParaTelegram({ system: 'sys', messages: [{ role: 'user', content: 'oi' }], tools: [] });
    assert.equal(r.type, 'erro');
    assert.equal(r.motivo, 'SEM_CHAVE_API');
  } finally {
    if (original === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = original;
  }
});
