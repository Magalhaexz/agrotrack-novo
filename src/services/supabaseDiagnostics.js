import { supabase, validateSupabaseSessionForCloud } from '../lib/supabase.js';

const DEFAULT_TIMEOUT_MS = 10000;
const INVALID_SESSION_MESSAGE = 'Sessão inválida. Reconecte à nuvem.';

async function getSafeAccessToken() {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult?.data?.session?.access_token || null;
  const tokenLooksJwt = typeof accessToken === 'string' && accessToken.split('.').length === 3;
  const tokenLength = typeof accessToken === 'string' ? accessToken.length : 0;
  return { accessToken, hasAccessToken: Boolean(accessToken), tokenLooksJwt, tokenLength };
}


function normalizeEnvValue(value) {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
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

function classifyMinimalDiagnosticFailure({ error = null, status = null, code = null }) {
  const text = getErrorMessage(error).toLowerCase();
  const pgCode = String(code || '').toUpperCase();

  if (status === 401) return { type: 'auth', message: 'Sessão inválida ou expirada.' };
  if (status === 403 || pgCode === '42501') return { type: 'rls', message: 'Permissão insuficiente. Verifique as políticas RLS no Supabase.' };
  if (status === 404 || pgCode === 'PGRST205' || pgCode === '42P01') return { type: 'schema', message: 'Tabela não encontrada na nuvem.' };
  if (status === 400 || pgCode === '42703' || pgCode === 'PGRST204') return { type: 'payload', message: 'Estrutura da tabela incompatível com o app.' };
  if (error?.name === 'AbortError' || text.includes('timeout')) return { type: 'timeout', message: 'Falha de conexão do navegador com o Supabase.' };
  if (text.includes('err_http2_protocol_error')) return { type: 'http2_protocol_error', message: 'Falha de conexão do navegador com o Supabase.' };
  if (text.includes('err_connection_reset')) return { type: 'network_reset', message: 'Falha de conexão do navegador com o Supabase.' };
  if (text.includes('err_connection_closed')) return { type: 'network_reset', message: 'Falha de conexão do navegador com o Supabase.' };
  if (isNetworkLikeError(error)) return { type: 'network_reset', message: 'Falha de conexão do navegador com o Supabase.' };
  return { type: 'unknown', message: 'Falha de conexão do navegador com o Supabase.' };
}

async function runMinimalRestStep({ step, table, supabaseUrl, anonKey, token = null, timeoutMs = 8000 }) {
  const endpointPath = `/rest/v1/${table}?select=id&limit=1`;
  const endpoint = `${String(supabaseUrl).replace(/\/$/, '')}${endpointPath}`;
  const headers = {
    apikey: anonKey,
    Accept: 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (response.ok) {
      return {
        step,
        table,
        endpointPath,
        ok: true,
        httpStatus: response.status,
        postgrestCode: null,
        failureType: null,
        safeMessage: 'OK',
      };
    }

    const code = String(payload?.code || '').toUpperCase() || null;
    const classified = classifyMinimalDiagnosticFailure({ status: response.status, code });
    return {
      step,
      table,
      endpointPath,
      ok: false,
      httpStatus: response.status,
      postgrestCode: code,
      failureType: classified.type,
      safeMessage: classified.message,
    };
  } catch (error) {
    const classified = classifyMinimalDiagnosticFailure({ error });
    return {
      step,
      table,
      endpointPath,
      ok: false,
      httpStatus: null,
      postgrestCode: null,
      failureType: classified.type,
      safeMessage: classified.message,
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function runMinimalClientStep({ table, timeoutMs = 8000 }) {
  const endpointPath = `/rest/v1/${table}?select=id,nome,cloud_id&limit=1`;
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { error } = await supabase.from(table).select('id,nome,cloud_id').limit(1).abortSignal(controller.signal);

    if (!error) {
      return {
        step: 'client_select',
        table,
        endpointPath,
        ok: true,
        httpStatus: 200,
        postgrestCode: null,
        failureType: null,
        safeMessage: 'OK',
      };
    }

    const status = Number(error?.status) || null;
    const code = String(error?.code || '').toUpperCase() || null;
    const classified = classifyMinimalDiagnosticFailure({ error, status, code });

    return {
      step: 'client_select',
      table,
      endpointPath,
      ok: false,
      httpStatus: status,
      postgrestCode: code,
      failureType: classified.type,
      safeMessage: classified.message,
    };
  } catch (error) {
    const classified = classifyMinimalDiagnosticFailure({ error });
    return {
      step: 'client_select',
      table,
      endpointPath,
      ok: false,
      httpStatus: null,
      postgrestCode: null,
      failureType: classified.type,
      safeMessage: classified.message,
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function buildEnvStep() {
  const rawUrl = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_URL || '');
  const rawAnonKey = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_ANON_KEY || '');
  let urlValid = false;
  let host = null;

  try {
    if (rawUrl) {
      const parsed = new URL(rawUrl);
      urlValid = true;
      host = parsed.host;
    }
  } catch {
    urlValid = false;
  }

  const anonKeyLooksValid = rawAnonKey.length >= 20 && rawAnonKey.includes('.');

  return {
    step: 'env_check',
    ok: Boolean(rawUrl && rawAnonKey && urlValid),
    envStatus: {
      supabaseUrlPresent: Boolean(rawUrl),
      anonKeyPresent: Boolean(rawAnonKey),
      host,
      urlValid,
      anonKeyLooksValid,
    },
    safeMessage: rawUrl && rawAnonKey && urlValid ? 'Ambiente configurado' : 'Erro de configuração',
  };
}

export async function runMinimalCloudDiagnostic({ table = 'lotes', session, timeoutMs = 8000 } = {}) {
  const tokenInfo = await getSafeAccessToken();
  if (!tokenInfo.hasAccessToken || !tokenInfo.tokenLooksJwt) {
    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: null, hasAccessToken: tokenInfo.hasAccessToken, tokenLooksJwt: tokenInfo.tokenLooksJwt, tokenLength: tokenInfo.tokenLength, failureType: 'invalid_session', safeMessage: INVALID_SESSION_MESSAGE });
      console.groupEnd();
    }
    return {
      ok: false,
      table,
      appOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      supabaseHost: null,
      envStatus: buildEnvStep().envStatus,
      authState: {
        hasSession: Boolean(session?.user),
        hasAccessToken: tokenInfo.hasAccessToken,
        tokenLooksJwt: tokenInfo.tokenLooksJwt,
        tokenExpired: null,
        refreshAttempted: false,
        refreshSucceeded: false,
      },
      steps: [
        { step: 'env_check', ok: true, safeMessage: 'Ambiente configurado' },
        { step: 'rest_without_session', ok: true, safeMessage: 'OK' },
        { step: 'session_check', ok: false, status: 'missing', safeMessage: 'Sessão inválida ou expirada.' },
        { step: 'rest_with_session', ok: false, safeMessage: 'Bloqueado por sessão inválida', skipped: true },
        { step: 'client_select', ok: false, safeMessage: 'Bloqueado por sessão inválida', skipped: true },
      ],
      conclusion: 'session_failure',
      conclusionMessage: INVALID_SESSION_MESSAGE,
    };
  }

  try {
    const serverResponse = await fetch('/api/cloud-diagnostic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenInfo.accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: serverResponse.status, hasAccessToken: tokenInfo.hasAccessToken, tokenLooksJwt: tokenInfo.tokenLooksJwt, tokenLength: tokenInfo.tokenLength, failureType: serverResponse.ok ? null : 'server_http_error', safeMessage: serverResponse.ok ? 'Nuvem conectada pelo servidor.' : 'Diagnóstico pelo servidor falhou. O modo local continua ativo.' });
      console.groupEnd();
    }
    const serverJson = await serverResponse.json().catch(() => null);
    if (serverResponse.ok && serverJson) {
      const checks = Array.isArray(serverJson?.checks) ? serverJson.checks : [];
      const mapCheck = (name, fallbackStep) => {
        const hit = checks.find((item) => item?.name === name);
        if (!hit) return null;
        return {
          step: fallbackStep,
          table: hit?.table || table,
          endpointPath: `/api/cloud-diagnostic:${name}`,
          ok: hit?.status === 'success',
          httpStatus: hit?.httpStatus ?? (hit?.status === 'success' ? 200 : null),
          postgrestCode: hit?.code ?? null,
          failureType: hit?.status === 'success' ? null : 'server_check_error',
          safeMessage: hit?.message || (hit?.status === 'success' ? 'OK' : 'Erro no diagnóstico do servidor'),
          source: 'server',
        };
      };

      const envStep = {
        step: 'env_check',
        ok: checks.some((item) => item?.name === 'env' ? item?.status === 'success' : false),
        envStatus: {
          supabaseUrlPresent: true,
          anonKeyPresent: true,
          host: null,
          urlValid: true,
          anonKeyLooksValid: true,
        },
        safeMessage: checks.find((item) => item?.name === 'env')?.message || 'Ambiente configurado',
        source: 'server',
      };
      const restNoAuth = mapCheck('table_lotes', 'rest_without_session') || {
        step: 'rest_without_session',
        table,
        endpointPath: '/api/cloud-diagnostic:table_lotes',
        ok: false,
        httpStatus: null,
        postgrestCode: null,
        failureType: 'unknown',
        safeMessage: 'Falha ao conectar o servidor à nuvem.',
        source: 'server',
      };
      const sessionStep = {
        step: 'session_check',
        ok: Boolean(session?.user?.id),
        status: session?.user?.id ? 'valid' : 'missing',
        safeMessage: session?.user?.id ? 'Sessão válida' : 'Sessão inválida ou expirada.',
        source: 'server',
      };
      const restWithAuth = mapCheck('table_lotes_owner', 'rest_with_session') || {
        step: 'rest_with_session',
        table,
        endpointPath: '/api/cloud-diagnostic:table_lotes_owner',
        ok: false,
        httpStatus: null,
        postgrestCode: null,
        failureType: 'unknown',
        safeMessage: 'Falha ao conectar o servidor à nuvem.',
        source: 'server',
      };
      const clientStep = mapCheck('table_fazendas_owner', 'client_select') || {
        step: 'client_select',
        table: 'fazendas',
        endpointPath: '/api/cloud-diagnostic:table_fazendas_owner',
        ok: false,
        httpStatus: null,
        postgrestCode: null,
        failureType: 'unknown',
        safeMessage: 'Falha ao conectar o servidor à nuvem.',
        source: 'server',
      };

      const steps = [envStep, restNoAuth, sessionStep, restWithAuth, clientStep];
      const ok = steps.every((item) => item?.ok);
      return {
        ok,
        table,
        appOrigin: typeof window !== 'undefined' ? window.location.origin : null,
        supabaseHost: null,
        envStatus: envStep.envStatus,
        authState: {
          hasSession: Boolean(session?.user),
          hasAccessToken: Boolean(session?.access_token || session?.session?.access_token),
          tokenLooksJwt: null,
          tokenExpired: null,
          refreshAttempted: false,
          refreshSucceeded: false,
        },
        steps,
        conclusion: ok ? 'connectivity_ok' : 'server_bridge_failure',
        conclusionMessage: ok
          ? 'Nuvem conectada pelo servidor.'
          : 'Não foi possível sincronizar pelo servidor. O modo local continua ativo.',
      };
    }
  } catch {
    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_AUTH_HEADER_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: 494, hasAccessToken: tokenInfo.hasAccessToken, tokenLooksJwt: tokenInfo.tokenLooksJwt, tokenLength: tokenInfo.tokenLength, failureType: 'server_network_error', safeMessage: 'Diagnóstico pelo servidor falhou. O modo local continua ativo.' });
      console.groupEnd();
    }
    return {
      ok: false,
      table,
      appOrigin: typeof window !== 'undefined' ? window.location.origin : null,
      supabaseHost: null,
      envStatus: buildEnvStep().envStatus,
      authState: { hasSession: Boolean(session?.user), hasAccessToken: tokenInfo.hasAccessToken, tokenLooksJwt: tokenInfo.tokenLooksJwt, tokenExpired: null, refreshAttempted: false, refreshSucceeded: false },
      steps: [
        { step: 'env_check', ok: true, safeMessage: 'Ambiente configurado' },
        { step: 'rest_without_session', ok: false, safeMessage: 'Diagnóstico pelo servidor falhou. O modo local continua ativo.' },
        { step: 'session_check', ok: false, status: 'invalid', safeMessage: 'Diagnóstico pelo servidor falhou. O modo local continua ativo.' },
      ],
      conclusion: 'server_bridge_failure',
      conclusionMessage: 'Diagnóstico pelo servidor falhou. O modo local continua ativo.',
    };
  }

  const envStep = buildEnvStep();
  const supabaseUrl = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_URL || '');
  const anonKey = normalizeEnvValue(import.meta?.env?.VITE_SUPABASE_ANON_KEY || '');

  const token = session?.access_token || session?.session?.access_token || session?.user?.access_token || null;
  const validatedSession = await validateSupabaseSessionForCloud();
  const authState = validatedSession?.authState || {
    hasSession: Boolean(session?.user),
    hasAccessToken: Boolean(token),
    tokenLooksJwt: false,
    tokenExpired: false,
    refreshAttempted: false,
    refreshSucceeded: false,
  };

  const sessionStep = {
    step: 'session_check',
    ok: Boolean(validatedSession?.ok),
    status: validatedSession?.status || 'missing',
    safeMessage: validatedSession?.ok ? 'Sessão válida' : 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
  };

  const restNoAuth = envStep.ok
    ? await runMinimalRestStep({
      step: 'rest_without_session',
      table,
      supabaseUrl,
      anonKey,
      token: null,
      timeoutMs,
    })
    : {
      step: 'rest_without_session',
      table,
      endpointPath: `/rest/v1/${table}?select=id&limit=1`,
      ok: false,
      httpStatus: null,
      postgrestCode: null,
      failureType: 'config',
      safeMessage: 'Erro de configuração',
    };

  const restWithAuth = validatedSession?.ok
    ? await runMinimalRestStep({
      step: 'rest_with_session',
      table,
      supabaseUrl,
      anonKey,
      token: validatedSession?.session?.access_token || token,
      timeoutMs,
    })
    : {
      step: 'rest_with_session',
      table,
      endpointPath: `/rest/v1/${table}?select=id&limit=1`,
      ok: false,
      httpStatus: null,
      postgrestCode: null,
      failureType: 'auth',
      safeMessage: 'Bloqueado por sessão inválida',
      skipped: true,
    };

  const clientStep = envStep.ok && validatedSession?.ok
    ? await runMinimalClientStep({ table, timeoutMs })
    : {
      step: 'client_select',
      table,
      endpointPath: `/rest/v1/${table}?select=id,nome,cloud_id&limit=1`,
      ok: false,
      httpStatus: null,
      postgrestCode: null,
      failureType: 'auth',
      safeMessage: 'Bloqueado por sessão inválida',
      skipped: true,
    };

  const steps = [envStep, restNoAuth, sessionStep, restWithAuth, clientStep];
  const ok = envStep.ok && restNoAuth.ok && sessionStep.ok && restWithAuth.ok && clientStep.ok;

  let conclusion = 'sync_pipeline_issue';
  let conclusionMessage = 'REST e cliente Supabase operacionais. O problema está no pipeline de sincronização.';

  if (!restNoAuth.ok && ['network_reset', 'http2_protocol_error', 'timeout'].includes(restNoAuth.failureType)) {
    conclusion = 'browser_network_failure';
    conclusionMessage = 'Falha de conexão do navegador com o Supabase. O modo local continua ativo.';
  } else if (!sessionStep.ok) {
    conclusion = 'session_failure';
    conclusionMessage = 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
  } else if (restNoAuth.ok && !clientStep.ok) {
    conclusion = 'supabase_client_failure';
    conclusionMessage = 'Falha no cliente Supabase. Verifique sessão e configuração.';
  } else if (!envStep.ok) {
    conclusion = 'config_failure';
    conclusionMessage = 'Erro de configuração';
  } else if (ok) {
    conclusion = 'connectivity_ok';
    conclusionMessage = 'Conectividade com a nuvem validada.';
  }

  return {
    ok,
    table,
    appOrigin: typeof window !== 'undefined' ? window.location.origin : null,
    supabaseHost: envStep.envStatus?.host || null,
    envStatus: envStep.envStatus,
    authState,
    steps,
    conclusion,
    conclusionMessage,
  };
}

export async function runBrowserSafeCloudProbe({ timeoutMs = 8000, table = 'lotes', session } = {}) {
  return runMinimalCloudDiagnostic({ timeoutMs, table, session });
}

export async function runSupabaseConnectivityDiagnostics({ session, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const result = await runMinimalCloudDiagnostic({ session, table: 'lotes', timeoutMs });
  return {
    ok: result.ok,
    stage: 'diagnostics_complete',
    classification: result.ok ? 'ok' : (result.conclusion === 'session_failure' ? 'auth_error' : 'unknown'),
    message: result.conclusionMessage,
    safeDetails: {
      envStatus: result.envStatus,
      authState: result.authState,
      host: safeUrlHost(import.meta?.env?.VITE_SUPABASE_URL || ''),
    },
  };
}
