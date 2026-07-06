/* global process */
// Helper server-side para o Telegram Bot API (Sprint 6). Só é importado por
// functions dentro de `api/` — nunca pelo frontend (`src/`).

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

export function getTelegramEnvStatus() {
  return {
    botTokenPresent: Boolean(readEnv('TELEGRAM_BOT_TOKEN')),
    chatIdPresent: Boolean(readEnv('TELEGRAM_CHAT_ID')),
  };
}

/** Envia uma mensagem de texto simples ao chat configurado via env. Lança erro classificado em caso de falha. */
export async function enviarMensagemTelegram(texto) {
  const botToken = readEnv('TELEGRAM_BOT_TOKEN');
  const chatId = readEnv('TELEGRAM_CHAT_ID');

  if (!botToken || !chatId) {
    const error = new Error('telegram_env_missing');
    error.code = 'MISSING_TELEGRAM_ENV';
    throw error;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });
  } catch {
    const error = new Error('telegram_unreachable');
    error.code = 'TELEGRAM_UNREACHABLE';
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    const error = new Error('telegram_send_failed');
    error.code = 'TELEGRAM_SEND_FAILED';
    error.telegramDescription = payload?.description || null;
    throw error;
  }

  return { messageId: payload.result?.message_id || null };
}
