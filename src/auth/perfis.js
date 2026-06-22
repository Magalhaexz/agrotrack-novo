export const PERFIS = {
  PROPRIETARIO: 'proprietario',
  ADMIN: 'proprietario',
  GERENTE: 'gerente',
  OPERADOR: 'operador',
  VISUALIZADOR: 'visualizador',
};

export const PERFIL_LABELS = {
  [PERFIS.PROPRIETARIO]: 'Proprietário',
  [PERFIS.GERENTE]: 'Gerente',
  [PERFIS.OPERADOR]: 'Operador',
  [PERFIS.VISUALIZADOR]: 'Visualizador',
};

const PERFIL_ALIASES = {
  admin: PERFIS.PROPRIETARIO,
  administrador: PERFIS.PROPRIETARIO,
  proprietario: PERFIS.PROPRIETARIO,
  proprietário: PERFIS.PROPRIETARIO,
  owner: PERFIS.PROPRIETARIO,
  gerente: PERFIS.GERENTE,
  gestor: PERFIS.GERENTE,
  operador: PERFIS.OPERADOR,
  funcionario: PERFIS.OPERADOR,
  visualizador: PERFIS.VISUALIZADOR,
  viewer: PERFIS.VISUALIZADOR,
};

export const permissoesPorPerfil = {
  [PERFIS.ADMIN]: ['*'],
  [PERFIS.GERENTE]: [
    'perfil:ver',
    'dashboard:ver',
    'fazendas:ver',
    'fazendas:editar',
    'lotes:ver',
    'lotes:editar',
    'lotes:excluir',
    'animais:ver',
    'animais:movimentar',
    'animais:editar',
    'animais:excluir',
    'pesagens:ver',
    'pesagens:editar',
    'pesagens:excluir',
    'sanitario:ver',
    'sanitario:editar',
    'sanitario:excluir',
    'estoque:ver',
    'estoque:movimentar',
    'estoque:editar',
    'estoque:excluir',
    'financeiro:ver',
    'financeiro:editar',
    'financeiro:excluir',
    'custos:editar',
    'custos:excluir',
    'tarefas:ver',
    'tarefas:editar',
    'tarefas:excluir',
    'resultados:ver',
    'comparativo:ver',
    'configuracoes:ver',
    'configuracoes:editar',
    'pastagens:ver',
    'pastagens:editar',
    'pastagens:excluir',
    'planejamento:ver',
    'evolucao_rebanho:ver',
    'indicadores:ver',
    'cenarios:ver',
    'cenarios:editar',
    'dashboard_premium:ver',
    'relatorios_gerenciais:ver',
    'dados:importar',
    'dados:limpar',
    'funcionarios:ver',
    'funcionarios:editar',
    'acessos:gerenciar',
  ],
  [PERFIS.OPERADOR]: [
    'perfil:ver',
    'dashboard:ver',
    'lotes:ver',
    'lotes:editar',
    'lotes:excluir',
    'animais:ver',
    'animais:movimentar',
    'animais:editar',
    'animais:excluir',
    'pesagens:ver',
    'pesagens:editar',
    'pesagens:excluir',
    'sanitario:ver',
    'sanitario:editar',
    'sanitario:excluir',
    'estoque:ver',
    'estoque:movimentar',
    'estoque:editar',
    'tarefas:ver',
    'tarefas:editar',
    'tarefas:excluir',
    'resultados:ver',
    'comparativo:ver',
    'suplementacao:ver',
    'suplementacao:editar',
    'pastagens:ver',
    'pastagens:editar',
    'planejamento:ver',
    'evolucao_rebanho:ver',
    'indicadores:ver',
    'cenarios:ver',
    'cenarios:editar',
    'dashboard_premium:ver',
    'relatorios_gerenciais:ver',
  ],
  [PERFIS.VISUALIZADOR]: [
    'perfil:ver',
    'dashboard:ver',
    'fazendas:ver',
    'lotes:ver',
    'animais:ver',
    'pesagens:ver',
    'sanitario:ver',
    'estoque:ver',
    'suplementacao:ver',
    'resultados:ver',
    'comparativo:ver',
    'financeiro:ver',
    'pastagens:ver',
    'planejamento:ver',
    'evolucao_rebanho:ver',
    'indicadores:ver',
    'cenarios:ver',
    'dashboard_premium:ver',
    'relatorios_gerenciais:ver',
    'tarefas:ver',
    'funcionarios:ver',
  ],
};

export const permissoesPorPagina = {
  dashboard: 'dashboard:ver',
  fazendas: 'fazendas:ver',
  lotes: 'lotes:ver',
  calendarioOperacional: 'sanitario:ver',
  comparativo: 'comparativo:ver',
  funcionarios: 'funcionarios:ver',
  rotina: 'sanitario:ver',
  animais: 'animais:ver',
  suplementacao: 'suplementacao:ver',
  sanitario: 'sanitario:ver',
  estoque: 'estoque:ver',
  pesagens: 'pesagens:ver',
  acompanhamentoPeso: 'animais:ver',
  custos: 'financeiro:ver',
  fluxoCaixa: 'financeiro:ver',
  custosCompartilhados: 'financeiro:ver',
  resultados: 'resultados:ver',
  financeiro: 'financeiro:ver',
  tarefas: 'tarefas:ver',
  perfil: 'perfil:ver',
  minhaAssinatura: 'perfil:ver',
  configuracoes: 'configuracoes:ver',
  sincronizacao: 'dashboard:ver',
  pastagens: 'pastagens:ver',
  evolucaoRebanho: 'evolucao_rebanho:ver',
  indicadores: 'indicadores:ver',
  cenarios: 'cenarios:ver',
  dashboardPremium: 'dashboard_premium:ver',
  relatoriosGerenciais: 'relatorios_gerenciais:ver',
  planejamento: 'planejamento:ver',
  importacao: 'dados:importar',
};

export function normalizarPerfil(perfil) {
  const valor = String(perfil || '').trim().toLowerCase();
  if (PERFIL_ALIASES[valor]) return PERFIL_ALIASES[valor];
  return PERFIS.VISUALIZADOR;
}

export function perfilEhAdministrador(perfil) {
  return normalizarPerfil(perfil) === PERFIS.PROPRIETARIO;
}

export function obterPerfilDoUsuario(user) {
  const bruto =
    user?.profile?.perfil ||
    user?.perfil ||
    user?.user_metadata?.perfil ||
    user?.user_metadata?.cargo ||
    user?.user_metadata?.tipo ||
    user?.app_metadata?.perfil ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    user?.raw_user_meta_data?.perfil ||
    user?.raw_user_meta_data?.role ||
    user?.raw_user_meta_data?.cargo ||
    user?.raw_user_meta_data?.tipo;

  return normalizarPerfil(bruto);
}

export function obterLabelPerfil(perfil) {
  const normalizado = normalizarPerfil(perfil);
  return PERFIL_LABELS[normalizado] || PERFIL_LABELS[PERFIS.VISUALIZADOR];
}

export function perfilPodeGerenciarAcessos(perfil) {
  return perfilTemPermissao(perfil, 'acessos:gerenciar');
}

export function perfilTemPermissao(perfil, permissao) {
  if (!permissao) return true;
  const perfilNormalizado = normalizarPerfil(perfil);
  const permissoes = permissoesPorPerfil[perfilNormalizado] || [];
  return permissoes.includes('*') || permissoes.includes(permissao);
}

export function usuarioTemPermissao(user, permissao) {
  if (!permissao) return true;

  const perfil = obterPerfilDoUsuario(user);
  return perfilTemPermissao(perfil, permissao);
}
