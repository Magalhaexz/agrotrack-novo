import { obterLabelPerfil, PERFIS, normalizarPerfil, perfilEhAdministrador } from '../auth/perfis.js';
import { supabase } from '../lib/supabase.js';

const PROFILE_COLUMNS = 'id, owner_user_id, email, nome, perfil, telefone, cargo, foto_url, created_at, updated_at';
const INVITE_COLUMNS = 'id, email, nome, perfil, status, notes, created_by, used_by, used_at, created_at, updated_at';
const PROFILE_CACHE_PREFIX = 'HERDON_PROFILE_CACHE::';
const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = ['magalhaesh617@gmail.com'];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getBootstrapAdminEmails() {
  const envValue = import.meta?.env?.VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS;
  const configured = String(envValue || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return DEFAULT_BOOTSTRAP_ADMIN_EMAILS;
}

function isBootstrapOwnerEmail(user) {
  const userEmail = normalizeEmail(user?.email);
  if (!userEmail) return false;

  return getBootstrapAdminEmails().includes(userEmail);
}

/**
 * Exceção interna controlada do gate comercial: e-mails de admin bootstrap
 * (VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS) nunca são bloqueados por assinatura.
 * Usado por services/accessControl.js.
 */
export function isBootstrapAdminUser(user) {
  return isBootstrapOwnerEmail(user);
}

function getOwnerAccountMarkerRaw(user) {
  return (
    user?.user_metadata?.owner_account
    ?? user?.user_metadata?.account_kind
    ?? user?.raw_user_meta_data?.owner_account
    ?? user?.raw_user_meta_data?.account_kind
    ?? null
  );
}

function isOwnerAccountMetadata(user) {
  const marker = String(getOwnerAccountMarkerRaw(user) || '').trim().toLowerCase();
  return marker === 'true' || marker === '1' || marker === 'yes' || marker === 'self_service' || marker === 'owner';
}

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('relation') || message.includes('does not exist');
}

function isRlsError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42501' || message.includes('permission denied') || message.includes('row-level security');
}

export function isAccessModuleUnavailable(error) {
  return isMissingTableError(error) || isRlsError(error);
}

function getAuthMetadataRoleRaw(user) {
  return (
    user?.user_metadata?.perfil
    ?? user?.user_metadata?.role
    ?? user?.user_metadata?.cargo
    ?? user?.raw_user_meta_data?.perfil
    ?? user?.raw_user_meta_data?.role
    ?? user?.raw_user_meta_data?.cargo
    ?? null
  );
}

export function resolveUserRoleFromAuthAndCache(user, profile) {
  const metadataRawPerfil = getAuthMetadataRoleRaw(user);
  const metadataRawHasValue = Boolean(String(metadataRawPerfil || '').trim());
  const metadataPerfil = normalizarPerfil(metadataRawPerfil);
  const metadataExplicitRole =
    metadataRawHasValue
    && (
      perfilEhAdministrador(metadataPerfil)
      || metadataPerfil === PERFIS.GERENTE
      || metadataPerfil === PERFIS.OPERADOR
    );

  const profilePerfil = normalizarPerfil(profile?.perfil || null);
  const hasProfilePerfil = Boolean(String(profile?.perfil || '').trim());

  // Regra de segurança (o isolamento real entre contas é garantido pelo RLS via owner_user_id):
  // 1) metadata explícita admin/gerente/operador sempre vence cache stale visualizador.
  // 2) se metadata não for explícita, perfil válido em cache/profile (ex.: convidado
  //    visualizador) é respeitado.
  // 3) conta nova sem profile e sem metadata (cadastro self-service) assume proprietário
  //    da PRÓPRIA conta — owner_user_id passa a ser o próprio id do usuário.
  if (metadataExplicitRole) {
    return { perfil: metadataPerfil, source: 'auth_metadata' };
  }
  if (hasProfilePerfil) {
    return { perfil: profilePerfil, source: 'cached_profile' };
  }
  if (isBootstrapOwnerEmail(user) || isOwnerAccountMetadata(user) || metadataPerfil === PERFIS.PROPRIETARIO) {
    return { perfil: PERFIS.PROPRIETARIO, source: isOwnerAccountMetadata(user) ? 'self_service_signup' : 'bootstrap_owner_email' };
  }
  if (metadataRawHasValue) {
    return { perfil: metadataPerfil, source: 'auth_metadata' };
  }
  return { perfil: PERFIS.PROPRIETARIO, source: 'fallback_owner_default' };
}

export function mapProfileRowToUser(user, profile) {
  if (!user) return null;

  const nomeFallback =
    user?.user_metadata?.nome ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const resolved = resolveUserRoleFromAuthAndCache(user, profile);
  const perfil = resolved.perfil;
  if (import.meta?.env?.DEV) {
    console.debug('[HERDON_ROLE_BOOT]', {
      source: resolved.source,
      hasProfile: Boolean(profile),
      hasMetadataRole: Boolean(String(getAuthMetadataRoleRaw(user) || '').trim()),
      resolvedPerfil: perfil,
    });
  }

  return {
    ...user,
    owner_user_id: profile?.owner_user_id ?? user?.owner_user_id ?? (resolved.perfil === PERFIS.PROPRIETARIO ? user?.id ?? null : null),
    nome: profile?.nome || nomeFallback,
    email: profile?.email || user?.email || '',
    perfil,
    perfilLabel: obterLabelPerfil(perfil),
    roleSource: resolved.source,
    foto_url: profile?.foto_url ?? user?.user_metadata?.avatar_url ?? null,
    telefone: profile?.telefone ?? user?.user_metadata?.telefone ?? '',
    cargo: profile?.cargo ?? user?.user_metadata?.cargo ?? '',
    profile: profile || null,
  };
}

export function getProfileCacheKey(userId) {
  return `${PROFILE_CACHE_PREFIX}${userId}`;
}

export function readCachedProfile(userId) {
  if (!userId) return null;

  try {
    const raw = localStorage.getItem(getProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedProfile(userId, profile) {
  if (!userId || !profile) return;

  try {
    localStorage.setItem(getProfileCacheKey(userId), JSON.stringify(profile));
  } catch {
    // Cache local indisponivel
  }
}

export function clearCachedProfile(userId) {
  if (!userId) return;

  try {
    localStorage.removeItem(getProfileCacheKey(userId));
  } catch {
    // Cache local indisponivel
  }
}

export async function fetchUserProfile(userId) {
  if (!userId) {
    return { data: null, error: null };
  }

  const response = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  return response;
}

/**
 * Safety net for users authenticated by Supabase (e-mail/senha ou Google OAuth) that, por
 * qualquer motivo, ainda não têm linha em public.profiles (o gatilho on_auth_user_created
 * deveria cobrir isso, mas esta função garante o caso no app caso o gatilho falhe).
 * Usa ignoreDuplicates para nunca sobrescrever um profile que já exista.
 */
export async function ensureUserProfile(user) {
  if (!user?.id || !user?.email) {
    return { data: null, error: null };
  }

  const metadata = user.user_metadata || {};
  const nome =
    String(metadata.nome || '').trim()
    || String(metadata.name || '').trim()
    || String(metadata.full_name || '').trim()
    || user.email.split('@')[0];

  return supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email,
        nome,
        perfil: 'admin',
        owner_user_id: user.id,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
}

export async function upsertOwnProfile(userId, payload) {
  if (!userId) {
    return { data: null, error: new Error('Usuario invalido para salvar profile.') };
  }

  return supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        ...payload,
      },
      { onConflict: 'id' }
    )
    .select(PROFILE_COLUMNS)
    .single();
}

export async function listProfiles() {
  return supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('nome', { ascending: true, nullsFirst: false });
}

export async function listInvites() {
  return supabase
    .from('invites')
    .select(INVITE_COLUMNS)
    .order('created_at', { ascending: false });
}

export async function createInvite(payload) {
  return supabase
    .from('invites')
    .insert(payload)
    .select(INVITE_COLUMNS)
    .single();
}

export async function updateInvite(inviteId, payload) {
  return supabase
    .from('invites')
    .update(payload)
    .eq('id', inviteId)
    .select(INVITE_COLUMNS)
    .maybeSingle();
}

export async function deleteInvite(inviteId) {
  return supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);
}
