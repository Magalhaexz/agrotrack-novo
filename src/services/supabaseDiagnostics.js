import { getSupabaseEnvStatus, supabase } from '../lib/supabase.js';

const DEFAULT_TIMEOUT_MS = 10000;

function normalizeEnvValue(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (
    (text.startsWith('"') && text.endsWith('"'))
    || (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function getErrorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || error.details || error.hint || error.name || String(error);
}

function isNetworkLikeError(error) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network error')
    || message.includes('fetch failed')
    || message.includes('err_connection')
  );
}

function safeUrlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function getSessionSafeState(session) {
  return {
    hasSession: Boolean(session),
    hasUser: Boolean(session?.user?.id),
    hasAccessToken: Boolean(session?.access_token || session?.session?.access_token),
    sessionUserIdPresent: Boolean(session?.user?.id),
  };
}

function classifyHttpStatus(status, body = null) {
  const lowerBody = String(body?.message || body?.error_description || body?.hint || '').toLowerCase();
  const code = String(body?.code || '').toUpperCase();

  if (status === 401) {
    return {
      classification: 'auth_error',
      message: 'Sessão inválida ou expirada para acessar a nuvem.',
    };
  }
  if (status === 403 || code === '42501' || lowerBody.includes('row-level security') || lowerBody.includes('permission denied')) {
    return {
      classification: 'rls_or_policy_error',
      message: 'Permissão negada no Supabase. Verifique políticas RLS e perfil de acesso.',
    };
  }
  if (status === 404 || code === 'PGRST204' || code === '42703' || code === '42P01' || lowerBody.includes('column') || lowerBody.includes('schema') || lowerBody.includes('relation')) {
    return {
      classification: 'schema_error',
      message: 'Estrutura da tabela fazendas está incompatível com o aplicativo.',
    };
  }

  return {
    classification: 'http_error',
    message: `Falha HTTP ao acessar Supabase (status ${status}).`,
  };
}

async function runRestConnectivityCheck({ url, anonKey, token, timeoutMs }) {
  const requestUrl = `${String(url).replace(/\/$/, '')}/rest/v1/fazendas?select=id&limit=1`;
  const controller = new AbortController();
  const timeoutHandle = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const method = 'GET';
  const headers = {
    apikey: anonKey,
    Accept: 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(requestUrl, {
      method,
      headers,
      signal: controller.signal,
    });

    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (response.ok) {
      return {
        ok: true,
        stage: 'rest_check',
        classification: 'ok',
        message: 'Conexão REST com Supabase validada com sucesso.',
        safeDetails: {
          method,
          requestUrlHost: safeUrlHost(requestUrl),
          requestUrlPath: '/rest/v1/fazendas',
          status: response.status,
        },
      };
    }

    const classified = classifyHttpStatus(response.status, body);
    return {
      ok: false,
      stage: 'rest_check',
      classification: classified.classification,
      message: classified.message,
      safeDetails: {
        method,
        requestUrlHost: safeUrlHost(requestUrl),
        requestUrlPath: '/rest/v1/fazendas',
        status: response.status,
        errorCode: body?.code || null,
        errorName: null,
        errorMessage: body?.message || null,
      },
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        stage: 'rest_check',
        classification: 'timeout',
        message: 'Tempo limite excedido ao conectar com a nuvem.',
        safeDetails: {
          method,
          requestUrlHost: safeUrlHost(requestUrl),
          requestUrlPath: '/rest/v1/fazendas',
          status: null,
          errorName: 'TimeoutError',
          errorMessage: 'request_timeout',
        },
      };
    }

    const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false;
    const likelyFetchBlocked = error?.name === 'TypeError' && String(error?.message || '').toLowerCase().includes('failed to fetch');
    const classification = offline
      ? 'network_error'
      : likelyFetchBlocked
        ? 'cors_or_fetch_blocked'
        : isNetworkLikeError(error)
          ? 'network_error'
          : 'http_error';

    return {
      ok: false,
      stage: 'rest_check',
      classification,
      message: classification === 'cors_or_fetch_blocked'
        ? 'Falha de conexão no navegador ao acessar a nuvem (CORS, bloqueio ou rede).'
        : 'Não foi possível conectar à nuvem.',
      safeDetails: {
        method,
        requestUrlHost: safeUrlHost(requestUrl),
        requestUrlPath: '/rest/v1/fazendas',
        status: null,
        errorName: error?.name || null,
        errorMessage: getErrorMessage(error) || null,
      },
    };
  } finally {
    globalThis.clearTimeout(timeoutHandle);
  }
}

async function runSdkConnectivityCheck({ userId }) {
  try {
    let query = supabase.from('fazendas').select('id').limit(1);
    if (userId) {
      query = query.eq('owner_user_id', userId);
    }
    const { error } = await query;

    if (!error) {
      return {
        ok: true,
        stage: 'sdk_check',
        classification: 'ok',
        message: 'Conexão SDK com Supabase validada com sucesso.',
        safeDetails: {
          method: 'SDK_SELECT',
          table: 'fazendas',
          status: 200,
          errorName: null,
          errorMessage: null,
          errorCode: null,
        },
      };
    }

    const code = String(error?.code || '').toUpperCase();
    const message = getErrorMessage(error).toLowerCase();
    let classification = 'http_error';
    let humanMessage = 'Falha ao consultar Supabase via SDK.';

    if (code === '42501' || message.includes('row-level security') || message.includes('permission denied')) {
      classification = 'rls_or_policy_error';
      humanMessage = 'Permissão negada no Supabase. Verifique políticas RLS e perfil.';
    } else if (code === 'PGRST204' || code === '42703' || code === '42P01' || message.includes('column') || message.includes('schema') || message.includes('relation')) {
      classification = 'schema_error';
      humanMessage = 'Estrutura da tabela fazendas está incompatível com o aplicativo.';
    } else if (code === '401' || message.includes('jwt') || message.includes('token') || message.includes('auth')) {
      classification = 'auth_error';
      humanMessage = 'Sessão inválida para acessar a nuvem.';
    } else if (isNetworkLikeError(error)) {
      classification = 'network_error';
      humanMessage = 'Falha de rede ao consultar Supabase via SDK.';
    }

    return {
      ok: false,
      stage: 'sdk_check',
      classification,
      message: humanMessage,
      safeDetails: {
        method: 'SDK_SELECT',
        table: 'fazendas',
        status: Number(error?.status) || null,
        errorName: error?.name || null,
        errorMessage: getErrorMessage(error) || null,
        errorCode: error?.code || null,
      },
    };
  } catch (error) {
    return {
      ok: false,
      stage: 'sdk_check',
      classification: isNetworkLikeError(error) ? 'network_error' : 'http_error',
      message: 'Falha inesperada ao validar SDK do Supabase.',
      safeDetails: {
        method: 'SDK_SELECT',
        table: 'fazendas',
        status: null,
        errorName: error?.name || null,
        errorMessage: getErrorMessage(error) || null,
        errorCode: error?.code || null,
      },
    };
  }
}

export async function runSupabaseConnectivityDiagnostics({ session, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const envStatus = getSupabaseEnvStatus();
  const url = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_URL || supabase?.supabaseUrl || '');
  const anonKey = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_ANON_KEY || supabase?.supabaseKey || '');
  const host = safeUrlHost(url);
  const sessionState = getSessionSafeState(session);
  const resolvedTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;

  if (!envStatus?.configured || !url || !anonKey) {
    return {
      ok: false,
      stage: 'env_check',
      classification: 'env_missing',
      message: 'Configuração da nuvem ausente. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      safeDetails: {
        envConfigured: Boolean(envStatus?.configured),
        urlPresent: Boolean(url),
        anonKeyPresent: Boolean(anonKey),
        requestUrlHost: host,
        session: sessionState,
      },
    };
  }

  if (!host) {
    return {
      ok: false,
      stage: 'env_check',
      classification: 'invalid_url',
      message: 'URL do Supabase inválida. Ajuste VITE_SUPABASE_URL.',
      safeDetails: {
        envConfigured: Boolean(envStatus?.configured),
        urlPresent: true,
        anonKeyPresent: true,
        requestUrlHost: null,
        session: sessionState,
      },
    };
  }

  if (!sessionState.hasSession || !sessionState.hasUser || !sessionState.hasAccessToken) {
    return {
      ok: false,
      stage: 'session_check',
      classification: 'auth_error',
      message: 'Sessão de autenticação não está pronta para sincronizar com a nuvem.',
      safeDetails: {
        envConfigured: true,
        requestUrlHost: host,
        session: sessionState,
      },
    };
  }

  const accessToken = session?.access_token || session?.session?.access_token || null;
  const restResult = await runRestConnectivityCheck({
    url,
    anonKey,
    token: accessToken,
    timeoutMs: resolvedTimeout,
  });
  const sdkResult = await runSdkConnectivityCheck({
    userId: session?.user?.id || null,
  });

  if (restResult.ok && sdkResult.ok) {
    return {
      ok: true,
      stage: 'diagnostics_complete',
      classification: 'ok',
      message: 'Conectividade com Supabase validada com sucesso.',
      safeDetails: {
        envConfigured: true,
        requestUrlHost: host,
        rest: restResult.safeDetails,
        sdk: sdkResult.safeDetails,
        session: sessionState,
      },
    };
  }

  if (!restResult.ok && sdkResult.ok) {
    return {
      ok: true,
      stage: 'diagnostics_complete',
      classification: 'ok',
      message: 'SDK do Supabase está funcional; falha isolada no caminho REST manual.',
      safeDetails: {
        envConfigured: true,
        requestUrlHost: host,
        discrepancy: 'sdk_ok_rest_failed',
        rest: restResult.safeDetails,
        sdk: sdkResult.safeDetails,
        session: sessionState,
      },
    };
  }

  const combinedClassification = (!restResult.ok && !sdkResult.ok && (
    restResult.classification === 'network_error'
    || restResult.classification === 'timeout'
    || restResult.classification === 'cors_or_fetch_blocked'
    || sdkResult.classification === 'network_error'
  ))
    ? 'network_error'
    : restResult.classification || sdkResult.classification || 'http_error';

  return {
    ok: false,
    stage: 'diagnostics_complete',
    classification: combinedClassification,
    message: restResult.message || sdkResult.message || 'Não foi possível validar conectividade com a nuvem.',
    safeDetails: {
      envConfigured: true,
      requestUrlHost: host,
      rest: restResult.safeDetails,
      sdk: sdkResult.safeDetails,
      session: sessionState,
    },
  };
}

