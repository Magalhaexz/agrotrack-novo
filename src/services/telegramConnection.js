import { supabase } from '../lib/supabase.js';
import { extractAccessToken } from './asaasBilling.js';

/**
 * Conexão Telegram do usuário (Sprint 7). A tabela `telegram_connections` tem
 * RLS por user_id = auth.uid(), então um select simples já traz só a própria
 * conexão — nenhum owner_user_id é resolvido no frontend.
 */
export async function fetchTelegramConnection(session) {
  if (!session?.user?.id) {
    return { connection: null, error: null };
  }

  const { data, error } = await supabase
    .from('telegram_connections')
    .select('*')
    .maybeSingle();

  if (error) {
    return { connection: null, error };
  }

  return { connection: data || null, error: null };
}

export async function generateTelegramCode(session) {
  const accessToken = extractAccessToken(session) || (await supabase.auth.getSession()).data?.session?.access_token || null;
  if (!accessToken) {
    return { ok: false, code: 'SESSION_MISSING', message: 'Sessão expirada. Entre novamente para continuar.' };
  }

  const response = await fetch('/api/telegram-gerar-codigo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    return { ok: false, code: payload?.code || null, message: payload?.message || 'Não foi possível gerar o código agora.' };
  }

  return { ok: true, code: payload.code, expiresAt: payload.expiresAt };
}

export async function updateTelegramPreferences(connectionId, patch) {
  const { data, error } = await supabase
    .from('telegram_connections')
    .update(patch)
    .eq('id', connectionId)
    .select('*')
    .maybeSingle();

  return { connection: data || null, error: error || null };
}

export async function disconnectTelegram(connectionId) {
  return updateTelegramPreferences(connectionId, { is_active: false });
}
