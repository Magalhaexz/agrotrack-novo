import { supabase } from '../lib/supabase.js';

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

async function _runMinimalRestStep({ step, table, supabaseUrl, anonKey, token = null, timeoutMs = 8000 }) {
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

async function _runMinimalClientStep({ table, timeoutMs = 8000 }) {
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

function _buildEnvStep() {
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
    safeMessage: rawUrl && rawAnonKey && urlValid ? 'Ambiente configurado' : 'Configuração da nuvem incompleta.',
  };
}

export async function runMinimalCloudDiagnostic({ table = 'lotes' } = {}) {
  const envStep = _buildEnvStep();
  if (!envStep.ok) {
    return {
      ok: false,
      table,
      steps: [envStep],
      conclusion: 'config_error',
      conclusionMessage: 'Não foi possível conectar à nuvem. Verifique a configuração. Modo local ativo.',
    };
  }

  const tokenInfo = await getSafeAccessToken();
  if (!tokenInfo.hasAccessToken || !tokenInfo.tokenLooksJwt) {
    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_CLOUD_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: null, ok: false, checks: [], safeMessage: INVALID_SESSION_MESSAGE });
      console.groupEnd();
    }
    return {
      ok: false,
      table,
      steps: [
        envStep,
        { step: 'session_check', ok: false, status: 'invalid', safeMessage: INVALID_SESSION_MESSAGE },
      ],
      conclusion: 'session_failure',
      conclusionMessage: INVALID_SESSION_MESSAGE,
    };
  }

  try {
    const response = await fetch('/api/cloud-diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenInfo.accessToken}` },
      body: JSON.stringify({}),
    });

    const payload = await response.json().catch(() => null);
    const isLocalhost = typeof window !== 'undefined'
      ? ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
      : false;
    if (isLocalhost && response.status === 404) {
      const safeMessage = 'Diagnóstico serverless indisponível no localhost. Use Vercel Preview ou vercel dev para testar.';
      if (import.meta.env.DEV) {
        console.groupCollapsed('[HERDON_SERVERLESS_CLOUD_DIAGNOSTIC]');
        console.info({
          endpoint: '/api/cloud-diagnostic',
          status: 404,
          ok: false,
          checks: [],
          classification: 'local_serverless_unavailable',
          safeMessage,
        });
        console.groupEnd();
      }
      return {
        ok: false,
        table,
        steps: [{ step: 'server_diagnostic', ok: false, safeMessage }],
        conclusion: 'local_serverless_unavailable',
        conclusionMessage: safeMessage,
      };
    }
    const checks = Array.isArray(payload?.checks) ? payload.checks : [];
    const mappedChecks = checks.map((item) => ({ name: item?.name || null, status: item?.status || 'error' }));
    const ok = Boolean(response.ok && payload?.ok === true);
    const safeMessage = ok
      ? 'Nuvem conectada pelo servidor.'
      : `Não foi possível conectar à nuvem. Verifique a configuração.${response?.status ? ` (status ${response.status})` : ''} Modo local ativo.`;

    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_CLOUD_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: response.status, ok, checks: mappedChecks, safeMessage });
      console.groupEnd();
    }

    return {
      ok,
      table,
      steps: [
        { step: 'env_check', ok: checks.find((c) => c?.name === 'env')?.status === 'success', safeMessage: checks.find((c) => c?.name === 'env')?.status === 'success' ? 'Ambiente: OK' : 'Configuração da nuvem incompleta.' },
        { step: 'fazendas_check', ok: checks.find((c) => c?.name === 'table_fazendas')?.status === 'success', safeMessage: 'Fazendas: OK' },
        { step: 'lotes_check', ok: checks.find((c) => c?.name === 'table_lotes')?.status === 'success', safeMessage: 'Lotes: OK' },
      ],
      conclusion: ok ? 'connectivity_ok' : 'server_bridge_failure',
      conclusionMessage: safeMessage,
    };
  } catch {
    const safeMessage = 'Não foi possível conectar à nuvem. Verifique a configuração. Modo local ativo.';
    if (import.meta.env.DEV) {
      console.groupCollapsed('[HERDON_SERVERLESS_CLOUD_DIAGNOSTIC]');
      console.info({ endpoint: '/api/cloud-diagnostic', status: null, ok: false, checks: [], safeMessage });
      console.groupEnd();
    }
    return {
      ok: false,
      table,
      steps: [{ step: 'server_diagnostic', ok: false, safeMessage }],
      conclusion: 'server_bridge_failure',
      conclusionMessage: safeMessage,
    };
  }
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
