/* global process */
// Webhook do Telegram (Sprint 7) — recebe updates do Bot API, resolve o
// código HERDON-XXXXXX enviado pelo usuário e vincula o chat_id à conexão
// dele. Nunca expõe TELEGRAM_BOT_TOKEN; a única validação de origem é o
// secret_token que o Telegram reenvia no header quando o webhook é
// registrado com `secret_token` (ver docs/SPRINT7_TELEGRAM_MULTIUSUARIO_RESULTADO.md).
import { getSupabaseAdminClient } from './_supabaseAdmin.js';
import { enviarMensagemTelegramParaChat } from './_telegram.js';
import { extractHerdonCodeFromText, isCodeUsable } from './_telegramConnections.js';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

const MSG_SUCESSO = 'Telegram conectado ao HERDON com sucesso. Você já pode fechar esta conversa e voltar ao HERDON.';
const MSG_INVALIDO = 'Código inválido ou expirado. Gere um novo código no HERDON.';
const MSG_SEM_CODIGO = 'Envie o código gerado no HERDON, por exemplo: HERDON-482913';

function isWebhookAuthorized(req) {
  const secret = readEnv('TELEGRAM_WEBHOOK_SECRET');
  if (!secret) return true; // Sem secret configurado: aceita (limitação documentada).
  const header = req.headers?.['x-telegram-bot-api-secret-token'];
  return header === secret;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const message = body.message || body.edited_message || null;
  const chatId = message?.chat?.id;
  const texto = message?.text || '';

  // Sempre responde 200: sem isso o Telegram reenvia o mesmo update.
  if (!chatId) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const codigo = extractHerdonCodeFromText(texto);
  if (!codigo) {
    await enviarMensagemTelegramParaChat(chatId, MSG_SEM_CODIGO).catch(() => null);
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    const client = getSupabaseAdminClient();
    const now = new Date();

    const { data: codeRow } = await client
      .from('telegram_connection_codes')
      .select('*')
      .eq('code', codigo)
      .maybeSingle();

    if (!isCodeUsable(codeRow, now)) {
      await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
      return res.status(200).json({ ok: true, connected: false });
    }

    const { error: upsertError } = await client.from('telegram_connections').upsert({
      owner_user_id: codeRow.owner_user_id,
      user_id: codeRow.user_id,
      fazenda_id: codeRow.fazenda_id,
      telegram_chat_id: String(chatId),
      telegram_username: message?.from?.username || null,
      telegram_first_name: message?.from?.first_name || null,
      telegram_last_name: message?.from?.last_name || null,
      is_active: true,
    }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[telegram-webhook] falha ao salvar conexão', upsertError);
      await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
      return res.status(200).json({ ok: true, connected: false });
    }

    // A conexão já foi salva: avisa o usuário antes de tentar marcar o
    // código como usado, para uma falha nesse passo não virar uma mensagem
    // de "código inválido" incorreta.
    await enviarMensagemTelegramParaChat(chatId, MSG_SUCESSO).catch(() => null);
    await client.from('telegram_connection_codes').update({ used_at: now.toISOString() }).eq('id', codeRow.id).then(() => null, () => null);
    return res.status(200).json({ ok: true, connected: true });
  } catch (error) {
    console.error('[telegram-webhook] erro inesperado', error);
    await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
    return res.status(200).json({ ok: true, connected: false });
  }
}
