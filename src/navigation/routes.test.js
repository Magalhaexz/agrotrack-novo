import test from 'node:test';
import assert from 'node:assert/strict';
import { pageRouteMap, legacyRouteAliases, getRouteForPage, getPageFromPathname } from './routes.js';

test('toda página em pageRouteMap tem round-trip rota -> página -> rota estável', () => {
  for (const [pagina, rota] of Object.entries(pageRouteMap)) {
    assert.equal(getRouteForPage(pagina), rota, `getRouteForPage(${pagina})`);
    assert.equal(getPageFromPathname(rota), pagina, `getPageFromPathname(${rota})`);
  }
});

test('getPageFromPathname cai para dashboard em rota desconhecida (fallback seguro)', () => {
  assert.equal(getPageFromPathname('/rota-que-nao-existe'), 'dashboard');
  assert.equal(getPageFromPathname(''), 'dashboard');
  assert.equal(getPageFromPathname(null), 'dashboard');
});

test('getRouteForPage devolve null para página sem rota mapeada', () => {
  assert.equal(getRouteForPage('pagina_inexistente'), null);
});

test('dashboard usa a raiz "/"', () => {
  assert.equal(getRouteForPage('dashboard'), '/');
  assert.equal(getPageFromPathname('/'), 'dashboard');
});

test('nenhuma rota duplicada entre páginas diferentes (senão popstate resolveria a página errada)', () => {
  const rotas = Object.values(pageRouteMap);
  assert.equal(new Set(rotas).size, rotas.length);
});

// Sprint de reorganização da sidebar (Etapa 9): rotas antigas de páginas
// unificadas/removidas do menu não podem quebrar nem cair silenciosamente
// no Dashboard — precisam resolver para o pageId que assumiu a função.
test('rota antiga /acompanhamento-peso resolve para "pesagens", nunca para "dashboard"', () => {
  assert.equal(getPageFromPathname('/acompanhamento-peso'), 'pesagens');
  assert.notEqual(getPageFromPathname('/acompanhamento-peso'), 'dashboard');
});

test('aliases legados nunca colidem com uma rota canônica já existente', () => {
  const rotasCanonicas = new Set(Object.values(pageRouteMap));
  for (const rota of Object.keys(legacyRouteAliases)) {
    assert.ok(!rotasCanonicas.has(rota), `"${rota}" é alias mas também é rota canônica de outra página`);
  }
});

test('todo alias legado resolve para um pageId que realmente existe em pageRouteMap', () => {
  for (const [rota, pageId] of Object.entries(legacyRouteAliases)) {
    assert.ok(pageRouteMap[pageId], `alias "${rota}" -> "${pageId}" não é uma página válida`);
  }
});
