const pageRouteMap = {
  dashboard: '/',
  minhaAssinatura: '/minha-assinatura',
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
