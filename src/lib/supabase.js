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
        signOut: async () => ({ error: null }),
      },
    };

export const HERDON_LOGOUT_EVENT_KEY = 'herdon_logout_event';
export const HERDON_LOGOUT_CHANNEL = 'herdon_auth_channel';

function removerChavesAuthDoStorage(storage) {
  const fixedKeys = new Set([
    'herdon_usuario',
    'herdon_user',
    'herdon_token',
    'supabase.auth.token',
    'herdon_logout_in_progress',
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
