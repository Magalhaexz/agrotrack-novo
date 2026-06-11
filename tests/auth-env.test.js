import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';

function captureEnv(keys) {
  const snapshot = {};
  for (const key of keys) {
    snapshot[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;
  }
  return snapshot;
}

function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

async function importFreshSupabaseModule() {
  const moduleUrl = new URL(`../src/lib/supabase.js?ts=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(moduleUrl.href);
}

test('missing Supabase env reports a friendly dev setup hint', async () => {
  const snapshot = captureEnv(['NODE_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_URL', 'VITE_PUBLIC_APP_URL']);
  try {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    process.env.NODE_ENV = 'development';

    const mod = await importFreshSupabaseModule();
    const status = mod.getSupabaseEnvStatus();

    assert.equal(status.configured, false);
    assert.match(String(status.message || ''), /VITE_SUPABASE_URL/);
    assert.match(String(status.message || ''), /VITE_SUPABASE_ANON_KEY/);
  } finally {
    restoreEnv(snapshot);
  }
});

test('signup helper includes the email redirect and profile data', async () => {
  const snapshot = captureEnv(['NODE_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_URL', 'VITE_PUBLIC_APP_URL']);
  try {
    process.env.NODE_ENV = 'test';
    process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'public-anon-key';

    const mod = await importFreshSupabaseModule();
    const options = mod.buildSupabaseSignUpOptions({
      nome: 'Maria Silva',
      redirectTo: 'https://app.example.com',
    });

    assert.equal(options.emailRedirectTo, 'https://app.example.com');
    assert.deepEqual(options.data, {
      nome: 'Maria Silva',
      name: 'Maria Silva',
      perfil: 'proprietario',
      role: 'proprietario',
      cargo: 'proprietario',
      owner_account: 'true',
      account_kind: 'self_service',
    });
  } finally {
    restoreEnv(snapshot);
  }
});

test('OAuth redirect prefers the current browser origin', async () => {
  const snapshot = captureEnv(['NODE_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_URL', 'VITE_PUBLIC_APP_URL']);
  const previousWindow = globalThis.window;
  try {
    process.env.NODE_ENV = 'test';
    process.env.VITE_SUPABASE_URL = 'https://project.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'public-anon-key';
    globalThis.window = { location: { origin: 'https://example.com' } };

    const mod = await importFreshSupabaseModule();
    assert.equal(mod.getSafeOAuthRedirectTo(), 'https://example.com');
  } finally {
    globalThis.window = previousWindow;
    restoreEnv(snapshot);
  }
});
