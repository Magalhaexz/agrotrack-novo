import { obterLabelPerfil, normalizarPerfil } from '../auth/perfis';
import { supabase } from '../lib/supabase';

const PROFILE_COLUMNS = 'id, email, nome, perfil, telefone, cargo, foto_url, created_at, updated_at';
const INVITE_COLUMNS = 'id, email, nome, perfil, status, notes, created_by, used_by, used_at, created_at, updated_at';

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

export function mapProfileRowToUser(user, profile) {
  if (!user) return null;

  const nomeFallback =
    user?.user_metadata?.nome ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario';

  const perfil = normalizarPerfil(profile?.perfil || user?.perfil);

  return {
    ...user,
    nome: profile?.nome || nomeFallback,
    email: profile?.email || user?.email || '',
    perfil,
    perfilLabel: obterLabelPerfil(perfil),
    foto_url: profile?.foto_url ?? user?.user_metadata?.avatar_url ?? null,
    telefone: profile?.telefone ?? user?.user_metadata?.telefone ?? '',
    cargo: profile?.cargo ?? user?.user_metadata?.cargo ?? '',
    profile: profile || null,
  };
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
    .single();
}

export async function deleteInvite(inviteId) {
  return supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);
}
