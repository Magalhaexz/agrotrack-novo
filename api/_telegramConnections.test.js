import test from 'node:test';
import assert from 'node:assert/strict';
import { generateConnectionCode, extractHerdonCodeFromText, isCodeUsable } from './_telegramConnections.js';

test('generateConnectionCode gera HERDON-000000..999999', () => {
  const code = generateConnectionCode();
  assert.match(code, /^HERDON-\d{6}$/);
});

test('extractHerdonCodeFromText aceita /start e texto puro, com e sem caixa baixa', () => {
  assert.equal(extractHerdonCodeFromText('/start HERDON-482913'), 'HERDON-482913');
  assert.equal(extractHerdonCodeFromText('herdon-482913'), 'HERDON-482913');
  assert.equal(extractHerdonCodeFromText('oi tudo bem'), null);
});

test('isCodeUsable rejeita código usado ou expirado', () => {
  const now = new Date('2026-07-06T12:00:00Z');
  assert.equal(isCodeUsable({ used_at: null, expires_at: '2026-07-06T12:05:00Z' }, now), true);
  assert.equal(isCodeUsable({ used_at: '2026-07-06T11:00:00Z', expires_at: '2026-07-06T12:05:00Z' }, now), false);
  assert.equal(isCodeUsable({ used_at: null, expires_at: '2026-07-06T11:59:00Z' }, now), false);
  assert.equal(isCodeUsable(null, now), false);
});
