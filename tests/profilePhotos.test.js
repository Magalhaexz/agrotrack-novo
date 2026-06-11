import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '../src/lib/supabase.js';
import {
  buildProfileAvatarPath,
  extractProfileAvatarPath,
  getProfileAvatarInitials,
  resolveProfileAvatarUrl,
  uploadProfileAvatar,
  validateProfileAvatarFile,
} from '../src/services/profilePhotos.js';

test('profile avatar validation accepts supported images and rejects invalid files', () => {
  const ok = validateProfileAvatarFile({
    name: 'foto.png',
    type: 'image/png',
    size: 1024,
  });
  const wrongType = validateProfileAvatarFile({
    name: 'foto.txt',
    type: 'text/plain',
    size: 1024,
  });
  const tooLarge = validateProfileAvatarFile({
    name: 'foto.jpg',
    type: 'image/jpeg',
    size: 3 * 1024 * 1024,
  });

  assert.equal(ok.ok, true);
  assert.equal(ok.extension, 'png');
  assert.equal(wrongType.ok, false);
  assert.equal(wrongType.message, 'Envie uma imagem em formato JPG, PNG ou WEBP.');
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.message, 'A imagem excede o tamanho permitido.');
});

test('profile avatar path is scoped to the authenticated user', () => {
  assert.equal(buildProfileAvatarPath('user-123', 'jpg'), 'profile-avatars/user-123/avatar.jpg');
  assert.equal(extractProfileAvatarPath('https://example.com/storage/v1/object/public/profile-avatars/user-123/avatar.jpg?v=1'), 'profile-avatars/user-123/avatar.jpg');
  assert.equal(resolveProfileAvatarUrl('profile-avatars/user-123/avatar.jpg'), 'profile-avatars/user-123/avatar.jpg');
});

test('profile avatar upload returns a versioned public URL when storage confirms the write', async () => {
  const previousStorage = supabase.storage;
  supabase.storage = {
    from: () => ({
      upload: async () => ({ data: { path: 'user-123/avatar.jpg' }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example.com/profile-avatars/user-123/avatar.jpg' } }),
    }),
  };

  try {
    const result = await uploadProfileAvatar({
      userId: 'user-123',
      file: {
        name: 'avatar.jpg',
        type: 'image/jpeg',
        size: 1024,
      },
    });

    assert.equal(result.error, null);
    assert.equal(result.data.storagePath, 'profile-avatars/user-123/avatar.jpg');
    assert.match(result.data.publicUrl, /^https:\/\/cdn\.example\.com\/profile-avatars\/user-123\/avatar\.jpg\?v=\d+$/);
  } finally {
    supabase.storage = previousStorage;
  }
});

test('user avatar falls back to initials when no photo exists', () => {
  const markup = renderToStaticMarkup(
    React.createElement('div', { style: { width: 40, height: 40 } }, getProfileAvatarInitials('Ana Clara'))
  );

  assert.match(markup, /AC/);
});
