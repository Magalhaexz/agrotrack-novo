import { createClient } from '@supabase/supabase-js';

const runtimeEnv = (typeof import.meta !== 'undefined' && import.meta?.env)
  ? import.meta.env
  : {};
const processEnv = globalThis?.process?.env || {};
const supabaseUrl = runtimeEnv.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL;
const supabaseAnonKey = runtimeEnv.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY;
const isTestEnvironment = processEnv.NODE_ENV === 'test';

if ((!supabaseUrl || !supabaseAnonKey) && !isTestEnvironment) {
  throw new Error(
    'Variáveis do Supabase não carregadas. Confira o arquivo .env e reinicie o Vite.'
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      from() {
        throw new Error('Supabase não inicializado no ambiente de teste.');
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
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
    // localStorage indisponivel
  }

  try {
    action(sessionStorage);
  } catch {
    // sessionStorage indisponivel
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

export async function signOutLocalSafely(timeoutMs = 5000) {
  const signOutPromise = supabase.auth.signOut({ scope: 'local' });
  const timeoutPromise = wait(timeoutMs).then(() => {
    throw createTimeoutError('local_sign_out_timeout');
  });

  return Promise.race([signOutPromise, timeoutPromise]);
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
