import test from 'node:test';
import assert from 'node:assert/strict';
import { navSections } from '../src/navigation/navConfig.js';
import { getPageFromPathname, getRouteForPage } from '../src/navigation/routes.js';
import { permissoesPorPagina } from '../src/auth/perfis.js';

test('minha assinatura route maps to dedicated pathname', () => {
  assert.equal(getRouteForPage('minhaAssinatura'), '/minha-assinatura');
  assert.equal(getPageFromPathname('/minha-assinatura'), 'minhaAssinatura');
  assert.equal(getPageFromPathname('/rota-inexistente'), 'dashboard');
});

test('minha assinatura is visible in sidebar navigation and protected by profile permission', () => {
  const subscriptionEntry = navSections
    .flatMap((section) => section.items)
    .find((item) => item.id === 'minhaAssinatura');

  assert.ok(subscriptionEntry);
  assert.equal(subscriptionEntry.label, 'Minha Assinatura');
  assert.equal(permissoesPorPagina.minhaAssinatura, 'perfil:ver');
});
