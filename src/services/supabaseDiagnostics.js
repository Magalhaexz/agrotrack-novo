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
  const missingApiKey = lowerBody.includes('no api key found in request')
    || lowerBody.includes('api key')
    || code === 'PGRST301';

  if (missingApiKey) {
    return {
      classification: 'missing_api_key_header',
      message: 'Configuração da nuvem incompleta. Verifique as variáveis do Supabase.',
    };
  }

  if (status === 401 || status === 403) {
    return {
      classification: 'auth_or_rls_error',
      message: 'Sem permissão para acessar estes dados na nuvem.',
    };
  }

  if (code === '42501' || lowerBody.includes('row-level security') || lowerBody.includes('permission denied')) {
    return {
      classification: 'auth_or_rls_error',
      message: 'Sem permissão para acessar estes dados na nuvem.',
    };
  }

  if (status === 404 || code === 'PGRST204' || code === '42703' || code === '42P01' || lowerBody.includes('column') || lowerBody.includes('schema') || lowerBody.includes('relation')) {
    return {
      classification: 'schema_error',
      message: 'Estrutura da nuvem incompleta. Verifique a tabela fazendas no Supabase.',
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
          anonKeyPresent: Boolean(anonKey),
          accessTokenPresent: Boolean(token),
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
        anonKeyPresent: Boolean(anonKey),
        accessTokenPresent: Boolean(token),
      },
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      return {
        ok: false,
        stage: 'rest_check',
        classification: 'timeout',
        message: 'Projeto Supabase inacessível pela rede.',
        safeDetails: {
          method,
          requestUrlHost: safeUrlHost(requestUrl),
          requestUrlPath: '/rest/v1/fazendas',
          status: null,
          errorName: 'TimeoutError',
          errorMessage: 'request_timeout',
          anonKeyPresent: Boolean(anonKey),
          accessTokenPresent: Boolean(token),
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
      message: 'Projeto Supabase inacessível pela rede.',
      safeDetails: {
        method,
        requestUrlHost: safeUrlHost(requestUrl),
        requestUrlPath: '/rest/v1/fazendas',
        status: null,
        errorName: error?.name || null,
        errorMessage: getErrorMessage(error) || null,
        anonKeyPresent: Boolean(anonKey),
        accessTokenPresent: Boolean(token),
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
      classification = 'auth_or_rls_error';
      humanMessage = 'Sem permissão para acessar estes dados na nuvem.';
    } else if (code === 'PGRST204' || code === '42703' || code === '42P01' || message.includes('column') || message.includes('schema') || message.includes('relation')) {
      classification = 'schema_error';
      humanMessage = 'Estrutura da nuvem incompleta. Verifique a tabela fazendas no Supabase.';
    } else if (code === '401' || code === '403' || message.includes('jwt') || message.includes('token') || message.includes('auth')) {
      classification = 'auth_error';
      humanMessage = 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
    } else if (isNetworkLikeError(error)) {
      classification = 'network_error';
      humanMessage = 'Projeto Supabase inacessível pela rede.';
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
      message: isNetworkLikeError(error)
        ? 'Projeto Supabase inacessível pela rede.'
        : 'Falha inesperada ao validar SDK do Supabase.',
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
      classification: 'config_error',
      message: 'Configuração da nuvem incompleta. Verifique as variáveis do Supabase.',
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
      classification: 'config_error',
      message: 'Configuração da nuvem incompleta. Verifique as variáveis do Supabase.',
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
      message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
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

  const restClassification = restResult.classification;
  const sdkClassification = sdkResult.classification;
  const combinedClassification = (restClassification === 'missing_api_key_header' || restClassification === 'config_error')
    ? 'config_error'
    : (restClassification === 'auth_or_rls_error' || sdkClassification === 'auth_or_rls_error' || restClassification === 'auth_error' || sdkClassification === 'auth_error')
      ? 'auth_or_rls_error'
      : (restClassification === 'schema_error' || sdkClassification === 'schema_error')
        ? 'schema_error'
        : (!restResult.ok && !sdkResult.ok && (
          restClassification === 'network_error'
          || restClassification === 'timeout'
          || restClassification === 'cors_or_fetch_blocked'
          || sdkClassification === 'network_error'
        ))
          ? 'network_error'
          : restClassification || sdkClassification || 'http_error';

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

