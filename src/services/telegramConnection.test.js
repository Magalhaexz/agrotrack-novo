import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTelegramDeepLink } from './telegramConnection.js';

describe('buildTelegramDeepLink', () => {
  it('monta o link t.me com start=código', () => {
    assert.equal(buildTelegramDeepLink('HerdonBot', 'HERDON-265720'), 'https://t.me/HerdonBot?start=HERDON-265720');
  });

  it('remove @ inicial do username', () => {
    assert.equal(buildTelegramDeepLink('@HerdonBot', 'HERDON-265720'), 'https://t.me/HerdonBot?start=HERDON-265720');
  });

  it('retorna null sem username ou sem código', () => {
    assert.equal(buildTelegramDeepLink('', 'HERDON-265720'), null);
    assert.equal(buildTelegramDeepLink('HerdonBot', ''), null);
    assert.equal(buildTelegramDeepLink(null, null), null);
  });
});
