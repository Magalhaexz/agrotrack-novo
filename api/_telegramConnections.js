// Helpers puros de pareamento Telegram (Sprint 7) — sem I/O, compartilhados
// por api/telegram-gerar-codigo.js e api/telegram-webhook.js.
import { randomInt } from 'node:crypto';

export const CODE_PREFIX = 'HERDON-';
export const CODE_DIGITS = 6;
export const CODE_TTL_MINUTES = 15;
export const CODE_COOLDOWN_SECONDS = 15;

/** Gera um código no formato HERDON-482913. */
export function generateConnectionCode() {
  const digits = String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, '0');
  return `${CODE_PREFIX}${digits}`;
}

/**
 * Extrai um código HERDON-XXXXXX de uma mensagem do Telegram, aceitando
 * tanto "/start HERDON-482913" quanto apenas "HERDON-482913".
 */
export function extractHerdonCodeFromText(text) {
  const match = String(text || '').toUpperCase().match(/HERDON-(\d{6})/);
  return match ? `${CODE_PREFIX}${match[1]}` : null;
}

export function isCodeUsable(codeRow, now = new Date()) {
  if (!codeRow) return false;
  if (codeRow.used_at) return false;
  return new Date(codeRow.expires_at).getTime() > now.getTime();
}
