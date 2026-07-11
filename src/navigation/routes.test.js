import test from 'node:test';
import assert from 'node:assert/strict';
import { pageRouteMap, getRouteForPage, getPageFromPathname } from './routes.js';

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
