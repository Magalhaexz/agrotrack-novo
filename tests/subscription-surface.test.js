import test from 'node:test';
import assert from 'node:assert/strict';
import { accountNavItems } from '../src/navigation/navConfig.js';
import { getPageFromPathname, getRouteForPage } from '../src/navigation/routes.js';
import { permissoesPorPagina } from '../src/auth/perfis.js';

test('minha assinatura route maps to dedicated pathname', () => {
  assert.equal(getRouteForPage('minhaAssinatura'), '/minha-assinatura');
  assert.equal(getPageFromPathname('/minha-assinatura'), 'minhaAssinatura');
  assert.equal(getPageFromPathname('/rota-inexistente'), 'dashboard');
});

test('minha assinatura is visible in sidebar navigation and protected by profile permission', () => {
  // Sprint Visual 2: itens de conta (Perfil, Configurações, Assinatura...)
  // saíram da navegação principal e vivem em accountNavItems (rodapé da
  // sidebar / menu do usuário), não mais em navGroups.
  const subscriptionEntry = accountNavItems.find((item) => item.id === 'minhaAssinatura');

  assert.ok(subscriptionEntry);
  assert.equal(subscriptionEntry.label, 'Planos e Assinatura');
  // Sprint comercial: plano/assinatura é exclusivo do proprietário (admin '*').
  assert.equal(permissoesPorPagina.minhaAssinatura, 'assinatura:gerenciar');
});
