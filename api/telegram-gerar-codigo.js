/* global process */
// Geração de código de pareamento Telegram (Sprint 7) — POST autenticado.
// owner_user_id nunca vem do corpo da requisição: é resolvido a partir do
// usuário autenticado + profiles.owner_user_id (mesmo padrão de
// api/_asaas.js), evitando que alguém peça um código para outra conta.
import { getSupabaseAdminClient, resolveAuthenticatedUser } from './_supabaseAdmin.js';
import { generateConnectionCode, CODE_TTL_MINUTES, CODE_COOLDOWN_SECONDS, isCodeUsable } from './_telegramConnections.js';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

async function resolveOwnerUserId(client, userId) {
  const { data } = await client.from('profiles').select('owner_user_id').eq('id', userId).maybeSingle();
  return data?.owner_user_id || userId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  if (!readEnv('TELEGRAM_BOT_TOKEN')) {
    return res.status(500).json({ ok: false, code: 'MISSING_TELEGRAM_ENV', message: 'Telegram não está configurado no servidor.' });
  }

  const user = await resolveAuthenticatedUser(req);
  if (!user?.id) {
    return res.status(401).json({ ok: false, code: 'SESSION_MISSING', message: 'Sessão expirada. Entre novamente para continuar.' });
  }

  const client = getSupabaseAdminClient();
  const ownerUserId = await resolveOwnerUserId(client, user.id);

  const { data: ultimoCodigo } = await client
    .from('telegram_connection_codes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();

  // Evita gerar código novo a cada clique repetido: reaproveita o último
  // enquanto ainda estiver dentro do cooldown e válido.
  if (ultimoCodigo && isCodeUsable(ultimoCodigo, now)) {
    const secondsSinceCreated = (now.getTime() - new Date(ultimoCodigo.created_at).getTime()) / 1000;
    if (secondsSinceCreated < CODE_COOLDOWN_SECONDS) {
      return res.status(200).json({
        ok: true,
        code: ultimoCodigo.code,
        expiresAt: ultimoCodigo.expires_at,
        ttlMinutes: CODE_TTL_MINUTES,
      });
    }
  }

  // Invalida códigos anteriores não usados para não deixar mais de um válido.
  await client
    .from('telegram_connection_codes')
    .update({ used_at: now.toISOString() })
    .eq('user_id', user.id)
    .is('used_at', null);

  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  let code = null;
  let insertError = null;
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const candidato = generateConnectionCode();
    const { error } = await client.from('telegram_connection_codes').insert({
      owner_user_id: ownerUserId,
      user_id: user.id,
      code: candidato,
      expires_at: expiresAt,
    });
    if (!error) {
      code = candidato;
      insertError = null;
      break;
    }
    insertError = error;
  }

  if (!code) {
    console.error('[telegram-gerar-codigo] falha ao gerar código único', insertError);
    return res.status(502).json({ ok: false, code: 'CODE_GENERATION_FAILED', message: 'Não foi possível gerar o código agora. Tente novamente.' });
  }

  return res.status(200).json({ ok: true, code, expiresAt, ttlMinutes: CODE_TTL_MINUTES });
}
