// Diagnóstico do webhook do Telegram (Sprint 20) — chama getWebhookInfo e
// imprime só campos não sensíveis. Nunca imprime TELEGRAM_BOT_TOKEN.
//
// Uso: TELEGRAM_BOT_TOKEN=xxxx node scripts/telegram-diagnostico.mjs
// (ou já exportado no shell — nunca colar o token na linha de comando de um
// histórico compartilhado).

const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no ambiente. Aborting.');
  process.exit(1);
}

const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const payload = await response.json().catch(() => null);

if (!response.ok || !payload?.ok) {
  console.error('Falha ao consultar getWebhookInfo (status HTTP:', response.status, ')');
  process.exit(1);
}

const { url, pending_update_count, last_error_date, last_error_message, max_connections, allowed_updates } = payload.result || {};

console.log('Diagnóstico do webhook Telegram');
console.log('--------------------------------');
console.log('url:', url || '(vazia — webhook não registrado)');
console.log('pending_update_count:', pending_update_count);
console.log('max_connections:', max_connections);
console.log('allowed_updates:', allowed_updates || '(todos)');
console.log('last_error_date:', last_error_date ? new Date(last_error_date * 1000).toISOString() : '(nenhum)');
console.log('last_error_message:', last_error_message || '(nenhum)');

if (url !== 'https://herdonapp.com.br/api/telegram-webhook') {
  console.warn('\nAVISO: url não é o domínio de produção esperado (https://herdonapp.com.br/api/telegram-webhook).');
}
if (last_error_message && /401|unauthorized/i.test(last_error_message)) {
  console.warn('\nAVISO: last_error_message indica 401 — provável divergência de secret_token (ver docs/TELEGRAM_COMANDOS.md).');
}
