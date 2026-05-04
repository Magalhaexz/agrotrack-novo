/* global process */
import { createClient } from '@supabase/supabase-js';

function readRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    const error = new Error(`missing_env_${name}`);
    error.code = 'MISSING_ENV';
    error.envName = name;
    throw error;
  }
  return value;
}

let cachedClient = null;

export function getSupabaseAdminClient() {
  if (cachedClient) return cachedClient;

  const url = readRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = readRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export function getSupabaseServerEnvStatus() {
  return {
    supabaseUrlPresent: Boolean(String(process.env.SUPABASE_URL || '').trim()),
    serviceRolePresent: Boolean(String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
  };
}

export function safeErrorPayload(error, fallbackMessage) {
  return {
    code: String(error?.code || '').toUpperCase() || null,
    httpStatus: Number(error?.status) || null,
    message: fallbackMessage,
  };
}

export function extractBearerToken(req) {
  const rawHeader = req?.headers?.authorization || req?.headers?.Authorization || '';
  const header = String(rawHeader || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function resolveAuthenticatedUser(req) {
  const token = extractBearerToken(req);
  if (!token) return null;

  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user;
}

