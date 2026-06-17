const pageRouteMap = {
  dashboard: '/',
  minhaAssinatura: '/minha-assinatura',
  termos: '/termos-de-uso',
  privacidade: '/politica-de-privacidade',
  cobranca: '/politica-de-cobranca',
  suporte: '/suporte',
};

const routePageMap = Object.entries(pageRouteMap).reduce((acc, [page, route]) => {
  acc[route] = page;
  return acc;
}, {});

export { pageRouteMap };

export function getRouteForPage(pageId) {
  if (Object.prototype.hasOwnProperty.call(pageRouteMap, pageId)) {
    return pageRouteMap[pageId];
  }
  return null;
}

export function getPageFromPathname(pathname) {
  const normalizedPath = String(pathname || '/').trim() || '/';
  return routePageMap[normalizedPath] || 'dashboard';
}
