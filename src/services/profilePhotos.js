import { supabase } from '../lib/supabase.js';

export const PROFILE_AVATARS_BUCKET = 'profile-avatars';
export const MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024;
export const PROFILE_AVATAR_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const PROFILE_AVATAR_ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeUserId(userId) {
  return normalizeText(userId).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function getProfileAvatarInitials(nome) {
  if (!nome) return 'U';
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

function getFileExtension(file) {
  const name = normalizeText(file?.name);
  const extension = name.includes('.') ? name.split('.').pop() : '';
  const normalizedExtension = normalizeText(extension).toLowerCase();
  if (PROFILE_AVATAR_ALLOWED_EXTENSIONS.has(normalizedExtension)) {
    return normalizedExtension === 'jpeg' ? 'jpg' : normalizedExtension;
  }

  const mimeType = normalizeText(file?.type).toLowerCase();
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';

  return '';
}

export function buildProfileAvatarPath(userId, extension) {
  const safeUserId = normalizeUserId(userId);
  const safeExtension = normalizeText(extension).toLowerCase();
  if (!safeUserId || !PROFILE_AVATAR_ALLOWED_EXTENSIONS.has(safeExtension)) {
    return null;
  }

  return `${PROFILE_AVATARS_BUCKET}/${safeUserId}/avatar.${safeExtension === 'jpeg' ? 'jpg' : safeExtension}`;
}

export function extractProfileAvatarPath(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const marker = `${PROFILE_AVATARS_BUCKET}/`;
      const index = url.pathname.indexOf(marker);
      if (index >= 0) {
        return url.pathname.slice(index);
      }
    } catch {
      return null;
    }
  }

  if (text.startsWith(`${PROFILE_AVATARS_BUCKET}/`)) {
    return text;
  }

  return null;
}

export function validateProfileAvatarFile(file) {
  if (!file) {
    return { ok: false, message: 'Envie uma imagem em formato JPG, PNG ou WEBP.' };
  }

  if (Number(file.size || 0) > MAX_PROFILE_AVATAR_BYTES) {
    return { ok: false, message: 'A imagem excede o tamanho permitido.' };
  }

  const mimeType = normalizeText(file.type).toLowerCase();
  const extension = getFileExtension(file);

  if (!PROFILE_AVATAR_ALLOWED_MIME_TYPES.has(mimeType) && !extension) {
    return { ok: false, message: 'Envie uma imagem em formato JPG, PNG ou WEBP.' };
  }

  return { ok: true, message: null, extension: extension || (mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp') };
}

export function resolveProfileAvatarUrl(value) {
  const text = normalizeText(value);
  if (!text) return null;
  if (/^(data:|blob:|https?:\/\/)/i.test(text)) {
    return text;
  }

  const storagePath = extractProfileAvatarPath(text);
  if (!storagePath) {
    return text;
  }

  try {
    const storage = supabase?.storage?.from?.(PROFILE_AVATARS_BUCKET);
    if (!storage?.getPublicUrl) {
      return text;
    }

    const { data } = storage.getPublicUrl(storagePath.replace(`${PROFILE_AVATARS_BUCKET}/`, ''));
    const publicUrl = data?.publicUrl || null;
    return publicUrl || text;
  } catch {
    return text;
  }
}

export async function uploadProfileAvatar({ userId, file }) {
  const validation = validateProfileAvatarFile(file);
  if (!validation.ok) {
    return { data: null, error: new Error(validation.message) };
  }

  const path = buildProfileAvatarPath(userId, validation.extension);
  if (!path) {
    return { data: null, error: new Error('Não foi possível atualizar a foto agora.') };
  }

  const bucket = supabase?.storage?.from?.(PROFILE_AVATARS_BUCKET);
  if (!bucket?.upload || !bucket?.getPublicUrl) {
    return { data: null, error: new Error('Não foi possível atualizar a foto agora.') };
  }

  const objectPath = path.replace(`${PROFILE_AVATARS_BUCKET}/`, '');
  const uploadResult = await bucket.upload(objectPath, file, {
    upsert: true,
    cacheControl: '3600',
    contentType: file.type || `image/${validation.extension}`,
  });

  if (uploadResult?.error) {
    return { data: null, error: new Error('Não foi possível atualizar a foto agora.') };
  }

  const { data } = bucket.getPublicUrl(objectPath);
  const basePublicUrl = data?.publicUrl || null;
  if (!basePublicUrl) {
    return { data: null, error: new Error('Não foi possível atualizar a foto agora.') };
  }

  const versionedPublicUrl = `${basePublicUrl}${basePublicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;

  return {
    data: {
      storagePath: path,
      publicUrl: versionedPublicUrl,
    },
    error: null,
  };
}
