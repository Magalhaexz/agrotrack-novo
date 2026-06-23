import { getSupabaseAdminClient, getSupabaseServerEnvStatus, resolveAuthenticatedUser } from './_supabaseAdmin.js';

function json(res, status, payload) {
  res.status(status).json(payload);
}

function isMalformedAuthorizationHeader(req) {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  if (!raw) return false;
  const header = String(raw).trim();
  if (!header.toLowerCase().startsWith('bearer ')) return true;
  const token = header.slice(7).trim();
  return !token || token === 'undefined' || token === 'null' || token.includes('{') || token.includes('}') || token.includes('[object Object]') || token.split('.').length !== 3;
}

function classify(error) {
  const status = Number(error?.status) || null;
  const code = String(error?.code || '').toUpperCase() || null;

  if (status === 401) return 'Sessão inválida ou expirada.';
  if (status === 403 || code === '42501') return 'Permissão insuficiente. Verifique as políticas RLS no Supabase.';
  if (status === 400 || code === '42703' || code === 'PGRST204') return 'Estrutura da tabela incompatível com o app.';
  if (status === 404 || code === 'PGRST205' || code === '42P01') return 'Tabela não encontrada na nuvem.';
  if (!status) return 'Falha ao conectar o servidor à nuvem.';
  return 'Falha ao conectar o servidor à nuvem.';
}

export async function runTableCheck(client, table, userId = null) {
  let query = client.from(table).select('id', { count: 'exact', head: false }).limit(1);
  if (userId) query = query.eq('owner_user_id', userId);

  const { data, error, count } = await query;
  // SPRINT 30: este client usa service_role (ignora RLS) só para checar se a
  // tabela responde. Quando userId não é informado, a contagem é de TODAS as
  // contas da plataforma — nunca devolver esse número ao usuário autenticado,
  // mesmo sendo "só uma contagem": é dado agregado entre contas, e o frontend
  // não usa esse campo (só status/message importam para o diagnóstico).
  const safeCount = userId ? (Number(count) || (Array.isArray(data) ? data.length : 0)) : null;

  if (error) {
    return {
      name: `table_${table}`,
      status: 'error',
      table,
      httpStatus: Number(error?.status) || null,
      code: String(error?.code || '').toUpperCase() || null,
      message: classify(error),
      count: userId ? 0 : null,
    };
  }

  return {
    name: `table_${table}`,
    status: 'success',
    table,
    httpStatus: 200,
    code: null,
    message: 'Nuvem conectada pelo servidor.',
    count: safeCount,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, message: 'Método não permitido.' });
  }

  const env = getSupabaseServerEnvStatus();
  if (!env.supabaseUrlPresent || !env.serviceRolePresent) {
    return json(res, 500, {
      ok: false,
      message: 'Configuração do servidor de nuvem incompleta.',
      checks: [
        {
          name: 'env',
          status: 'error',
          table: null,
          httpStatus: 500,
          code: 'SERVER_ENV_MISSING',
          message: 'Configuração do servidor de nuvem incompleta.',
        },
      ],
    });
  }

  if (isMalformedAuthorizationHeader(req)) {
    return json(res, 401, { ok: false, message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.' });
  }

  const authenticatedUser = await resolveAuthenticatedUser(req);
  if (!authenticatedUser?.id) {
    return json(res, 401, {
      ok: false,
      message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
    });
  }

  const userId = String(authenticatedUser.id);

  try {
    const client = getSupabaseAdminClient();
    const checks = [];

    checks.push({
      name: 'env',
      status: 'success',
      table: null,
      httpStatus: 200,
      code: null,
      message: 'Configuração do servidor de nuvem válida.',
    });

    checks.push(await runTableCheck(client, 'lotes', null));
    checks.push(await runTableCheck(client, 'fazendas', null));
    checks.push(await runTableCheck(client, 'lotes', userId));
    checks.push(await runTableCheck(client, 'fazendas', userId));

    const ok = checks.every((item) => item.status === 'success');
    return json(res, ok ? 200 : 207, {
      ok,
      checks,
    });
  } catch {
    return json(res, 502, {
      ok: false,
      message: 'Falha ao conectar o servidor à nuvem.',
      checks: [
        {
          name: 'server_connection',
          status: 'error',
          table: null,
          httpStatus: 502,
          code: 'SERVER_CONNECTION_FAILED',
          message: 'Falha ao conectar o servidor à nuvem.',
        },
      ],
    });
  }
}
