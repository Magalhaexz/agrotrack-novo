import { supabase, validateSupabaseSessionForCloud } from '../lib/supabase.js';

const DEFAULT_TIMEOUT_MS = 10000;

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

  if (status === 401) return { type: 'auth', message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.' };
  if (status === 403 || pgCode === '42501') return { type: 'rls', message: 'Permissão insuficiente para sincronizar com a nuvem.' };
  if (status === 404 || pgCode === 'PGRST205' || pgCode === '42P01') return { type: 'schema', message: 'Tabela não encontrada na nuvem. Verifique a estrutura do Supabase.' };
  if (status === 400 || pgCode === '42703' || pgCode === 'PGRST204') return { type: 'payload', message: 'Estrutura da nuvem incompatível com o app. Verifique as colunas no Supabase.' };
  if (error?.name === 'AbortError' || text.includes('timeout')) return { type: 'timeout', message: 'Falha de transporte no navegador' };
  if (text.includes('err_http2_protocol_error')) return { type: 'http2_protocol_error', message: 'Falha de transporte no navegador' };
  if (text.includes('err_connection_reset')) return { type: 'network_reset', message: 'Falha de transporte no navegador' };
  if (text.includes('err_connection_closed')) return { type: 'network_reset', message: 'Falha de transporte no navegador' };
  if (isNetworkLikeError(error)) return { type: 'network_reset', message: 'Falha de transporte no navegador' };
  return { type: 'unknown', message: 'Falha de transporte no navegador' };
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
