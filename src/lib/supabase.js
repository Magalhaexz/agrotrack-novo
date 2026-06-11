import { createClient } from '@supabase/supabase-js';

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

const runtimeEnv = (typeof import.meta !== 'undefined' && import.meta?.env)
  ? import.meta.env
  : {};
const processEnv = globalThis?.process?.env || {};
const supabaseUrl = normalizeEnvValue(runtimeEnv.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL);
const supabaseAnonKey = normalizeEnvValue(runtimeEnv.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY);
const isDevRuntime = Boolean((typeof import.meta !== 'undefined' && import.meta?.env?.DEV) || processEnv.NODE_ENV === 'development');
const isTestEnvironment = processEnv.NODE_ENV === 'test';
const supabaseEnvConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const publicAppUrl = normalizeEnvValue(
  runtimeEnv.VITE_APP_URL
  || runtimeEnv.VITE_PUBLIC_APP_URL
  || processEnv.VITE_APP_URL
  || processEnv.VITE_PUBLIC_APP_URL
);

export function getSafeOAuthRedirectTo() {
  if (typeof window !== 'undefined' && window?.location?.origin) {
    return window.location.origin;
  }
  const envUrl = normalizeEnvValue(publicAppUrl);
  if (envUrl) return envUrl;
  return undefined;
}

export function buildSupabaseSignUpOptions({ nome = '', redirectTo = null } = {}) {
  return {
    emailRedirectTo: normalizeEnvValue(redirectTo) || getSafeOAuthRedirectTo(),
    data: {
      nome: normalizeEnvValue(nome),
      name: normalizeEnvValue(nome),
    },
  };
}

export function getSupabaseEnvStatus() {
  return {
    configured: supabaseEnvConfigured,
    urlPresent: Boolean(supabaseUrl),
    anonKeyPresent: Boolean(supabaseAnonKey),
    isTestEnvironment,
    message: supabaseEnvConfigured
      ? null
      : (isDevRuntime
        ? 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.'
        : null),
  };
}

export const supabase = supabaseEnvConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
    from() {
      const envStatus = getSupabaseEnvStatus();
      throw new Error(envStatus.message || 'Supabase não inicializado.');
    },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      refreshSession: async () => ({ data: { session: null }, error: null }),
      signInWithPassword: async () => ({ data: { session: null }, error: null }),
      signInWithOAuth: async () => ({ data: null, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      resetPasswordForEmail: async () => ({ data: null, error: null }),
      updateUser: async () => ({ data: null, error: null }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe() {},
          },
        },
      }),
      signOut: async () => ({ error: null }),
    },
  };

export const HERDON_LOGOUT_EVENT_KEY = 'herdon_logout_event';
export const HERDON_LOGOUT_CHANNEL = 'herdon_auth_channel';
export const HERDON_LOGOUT_IN_PROGRESS_KEY = 'herdon_logout_in_progress';
export const HERDON_LOGIN_ATTEMPT_KEY = 'HERDON_LOGIN_ATTEMPT_AT';
export const HERDON_LOGIN_ACCEPTED_AT = 'HERDON_LOGIN_ACCEPTED_AT';

function wait(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function createTimeoutError(message) {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
}

function withStorage(action) {
  try {
    action(localStorage);
  } catch {
    // localStorage indisponível
  }

  try {
    action(sessionStorage);
  } catch {
    // sessionStorage indisponível
  }
}

function removerChavesAuthDoStorage(storage) {
  const fixedKeys = new Set([
    'herdon_usuario',
    'herdon_user',
    'herdon_token',
    'supabase.auth.token',
    HERDON_LOGOUT_IN_PROGRESS_KEY,
  ]);

  const dynamicRules = [
    (key) => key.includes('supabase.auth.token'),
    (key) => key.includes('supabase.auth'),
    (key) => key.toLowerCase().includes('supabase'),
    (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
    (key) => key.startsWith('sb-') && key.endsWith('-refresh-token'),
    (key) => key.startsWith('sb-') && key.endsWith('-code-verifier'),
  ];

  const keys = Object.keys(storage);
  keys.forEach((key) => {
    if (fixedKeys.has(key) || dynamicRules.some((rule) => rule(key))) {
      storage.removeItem(key);
    }
  });
}

export function limparPersistenciaSessao() {
  try {
    removerChavesAuthDoStorage(localStorage);
  } catch {
    // Ignora indisponibilidade de localStorage
  }

  try {
    removerChavesAuthDoStorage(sessionStorage);
  } catch {
    // Ignora indisponibilidade de sessionStorage
  }
}

export function resetSupabaseAuthLocally() {
  limparPersistenciaSessao();
}

export function limparMarcadoresFluxoAuth() {
  withStorage((storage) => {
    storage.removeItem(HERDON_LOGOUT_EVENT_KEY);
    storage.removeItem(HERDON_LOGOUT_IN_PROGRESS_KEY);
    storage.removeItem(HERDON_LOGIN_ATTEMPT_KEY);
    storage.removeItem(HERDON_LOGIN_ACCEPTED_AT);
  });
}

export function marcarLogoutEmAndamento(ativo) {
  withStorage((storage) => {
    if (ativo) {
      storage.setItem(HERDON_LOGOUT_IN_PROGRESS_KEY, String(Date.now()));
      return;
    }
    storage.removeItem(HERDON_LOGOUT_IN_PROGRESS_KEY);
  });
}

export function obterLogoutEmAndamentoAt() {
  try {
    const value = Number(localStorage.getItem(HERDON_LOGOUT_IN_PROGRESS_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export async function signOutLocalSafely(timeoutMs = 3000) {
  const signOutPromise = supabase.auth.signOut({ scope: 'local' });
  const timeoutPromise = wait(timeoutMs).then(() => {
    throw createTimeoutError('local_sign_out_timeout');
  });

  return Promise.race([signOutPromise, timeoutPromise]);
}

function looksLikeJwt(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every((part) => part.length > 0);
}

function decodeJwtPayloadSafe(token) {
  if (!looksLikeJwt(token)) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function tokenExpired(token) {
  const payload = decodeJwtPayloadSafe(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp <= (nowSec + 30);
}

export async function validateSupabaseSessionForCloud() {
  const authState = {
    hasSession: false,
    hasAccessToken: false,
    tokenLooksJwt: false,
    tokenExpired: false,
    refreshAttempted: false,
    refreshSucceeded: false,
  };

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return {
        ok: false,
        status: 'invalid',
        code: 'SESSION_READ_ERROR',
        safeMessage: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
        authState,
      };
    }

    let activeSession = data?.session ?? null;
    let token = activeSession?.access_token || null;

    authState.hasSession = Boolean(activeSession);
    authState.hasAccessToken = Boolean(token);
    authState.tokenLooksJwt = looksLikeJwt(token);
    authState.tokenExpired = token ? tokenExpired(token) : false;

    const tokenNeedsRecovery = !activeSession || !token || !authState.tokenLooksJwt || authState.tokenExpired;

    if (tokenNeedsRecovery) {
      authState.refreshAttempted = true;
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData?.session) {
        activeSession = refreshData.session;
        token = activeSession?.access_token || null;
        authState.refreshSucceeded = Boolean(activeSession && token);
        authState.hasSession = Boolean(activeSession);
        authState.hasAccessToken = Boolean(token);
        authState.tokenLooksJwt = looksLikeJwt(token);
        authState.tokenExpired = token ? tokenExpired(token) : false;
      } else {
        return {
          ok: false,
          status: 'refresh_failed',
          code: 'SESSION_REFRESH_FAILED',
          safeMessage: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
          authState,
        };
      }
    }

    if (!activeSession || !token || !authState.tokenLooksJwt || authState.tokenExpired) {
      let status = 'invalid';
      if (!activeSession || !token) status = 'missing';
      else if (authState.tokenExpired) status = 'expired';

      return {
        ok: false,
        status,
        code: 'SESSION_STALE',
        safeMessage: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
        authState,
      };
    }

    return {
      ok: true,
      status: 'valid',
      code: null,
      safeMessage: 'Sessão válida para sincronização com a nuvem.',
      session: activeSession,
      authState,
    };
  } catch {
    return {
      ok: false,
      status: 'invalid',
      code: 'SESSION_READ_EXCEPTION',
      safeMessage: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
      authState,
    };
  }
}

export function publicarEventoLogout(reason = 'manual_logout') {
  const payload = JSON.stringify({
    at: Date.now(),
    reason,
  });

  try {
    localStorage.setItem(HERDON_LOGOUT_EVENT_KEY, payload);
  } catch {
    // Sem storage disponível
  }

  try {
    const channel = new BroadcastChannel(HERDON_LOGOUT_CHANNEL);
    channel.postMessage({ type: 'logout', payload });
    channel.close();
  } catch {
    // BroadcastChannel indisponível
  }
}
