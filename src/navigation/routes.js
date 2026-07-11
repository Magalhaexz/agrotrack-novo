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
  acompanhamentoPeso: '/acompanhamento-peso',
  custos: '/custos',
  fluxoCaixa: '/fluxo-caixa',
  custosCompartilhados: '/custos-compartilhados',
  resultados: '/resultados',
  financeiro: '/financeiro',
  pastagens: '/pastagens',
  evolucaoRebanho: '/evolucao-rebanho',
  indicadores: '/indicadores',
  cenarios: '/cenarios',
  dashboardPremium: '/dashboard-premium',
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
