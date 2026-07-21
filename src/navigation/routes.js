const pageRouteMap = {
  dashboard: '/',
  alertas: '/alertas',
  decisoesFazenda: '/decisoes-fazenda',
  fazendas: '/fazendas',
  lotes: '/lotes',
  calendarioOperacional: '/calendario-operacional',
  comparativo: '/comparativo',
  funcionarios: '/funcionarios',
  rotina: '/rotina',
  tarefas: '/tarefas',
  perfil: '/perfil',
  minhaAssinatura: '/minha-assinatura',
  configuracoes: '/configuracoes',
  equipeAcessos: '/equipe-acessos',
  animais: '/animais',
  suplementacao: '/suplementacao',
  sanitario: '/sanitario',
  estoque: '/estoque',
  pesagens: '/pesagens',
  custos: '/custos',
  fluxoCaixa: '/fluxo-caixa',
  custosCompartilhados: '/custos-compartilhados',
  resultados: '/resultados',
  financeiro: '/financeiro',
  pastagens: '/pastagens',
  evolucaoRebanho: '/evolucao-rebanho',
  indicadores: '/indicadores',
  cenarios: '/cenarios',
  relatoriosGerenciais: '/relatorios-gerenciais',
  relatorios: '/relatorios',
  relatorioLote: '/relatorio-lote',
  relatorioPesagens: '/relatorio-pesagens',
  relatorioFinanceiro: '/relatorio-financeiro',
  relatorioPastagens: '/relatorio-pastagens',
  relatorioResumoGeral: '/relatorio-resumo-geral',
  guiaCriador: '/guia-criador',
  planejamento: '/planejamento',
  importacao: '/importacao',
  sincronizacao: '/sincronizacao',
  termos: '/termos-de-uso',
  privacidade: '/politica-de-privacidade',
  cobranca: '/politica-de-cobranca',
  suporte: '/suporte',
};

const routePageMap = Object.entries(pageRouteMap).reduce((acc, [page, route]) => {
  acc[route] = page;
  return acc;
}, {});

// Rotas antigas de páginas que saíram da sidebar ou foram unificadas em
// outra — não têm mais uma página própria, mas continuar existindo é
// obrigatório (favoritos, links salvos, histórico do navegador). Cada uma
// resolve para o pageId que assumiu a função.
export const legacyRouteAliases = {
  // AcompanhamentoPesoPage foi unificada em Pesagens (aba "Nova pesagem" /
  // "Evolução" cobrem tudo que a página separada fazia).
  '/acompanhamento-peso': 'pesagens',
  // DashboardPremiumPage foi removida por ser subconjunto estrito do Painel
  // Gerencial (mesmos 12 indicadores, contra 17 de relatoriosGerenciais).
  // Alias mantém links salvos e bookmarks funcionando.
  '/dashboard-premium': 'relatoriosGerenciais',
};

export { pageRouteMap };

export function getRouteForPage(pageId) {
  if (Object.prototype.hasOwnProperty.call(pageRouteMap, pageId)) {
    return pageRouteMap[pageId];
  }
  return null;
}

export function getPageFromPathname(pathname) {
  const normalizedPath = String(pathname || '/').trim() || '/';
  if (routePageMap[normalizedPath]) return routePageMap[normalizedPath];
  if (legacyRouteAliases[normalizedPath]) return legacyRouteAliases[normalizedPath];
  return 'dashboard';
}
