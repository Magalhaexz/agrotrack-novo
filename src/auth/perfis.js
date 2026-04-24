export const PERFIS = {
  ADMIN: 'admin',
  GERENTE: 'gerente',
  OPERADOR: 'operador',
  VISUALIZADOR: 'visualizador',
};

export const PERFIL_LABELS = {
  [PERFIS.ADMIN]: 'Admin',
  [PERFIS.GERENTE]: 'Gerente',
  [PERFIS.OPERADOR]: 'Operador',
  [PERFIS.VISUALIZADOR]: 'Visualizador',
};

const PERFIL_ALIASES = {
  proprietario: PERFIS.ADMIN,
  owner: PERFIS.ADMIN,
  gerente: PERFIS.GERENTE,
  operador: PERFIS.OPERADOR,
  visualizador: PERFIS.VISUALIZADOR,
  viewer: PERFIS.VISUALIZADOR,
};

export const permissoesPorPerfil = {
  [PERFIS.ADMIN]: ['*'],
  [PERFIS.GERENTE]: [
    'dashboard:ver',
    'fazendas:ver',
    'fazendas:editar',
    'lotes:ver',
    'lotes:editar',
    'animais:ver',
    'animais:movimentar',
    'pesagens:ver',
    'pesagens:editar',
    'sanitario:ver',
    'sanitario:editar',
    'estoque:ver',
    'estoque:movimentar',
    'financeiro:ver',
    'financeiro:editar',
    'tarefas:ver',
    'tarefas:editar',
    'resultados:ver',
    'comparativo:ver',
    'configuracoes:ver',
    'configuracoes:editar',
    'funcionarios:ver',
    'funcionarios:editar',
    'acessos:gerenciar',
  ],
  [PERFIS.OPERADOR]: [
    'dashboard:ver',
    'lotes:ver',
    'lotes:editar',
    'animais:ver',
    'animais:movimentar',
    'pesagens:ver',
    'pesagens:editar',
    'sanitario:ver',
    'sanitario:editar',
    'estoque:ver',
    'estoque:movimentar',
    'tarefas:ver',
    'tarefas:editar',
    'resultados:ver',
    'comparativo:ver',
    'suplementacao:ver',
    'suplementacao:editar',
  ],
  [PERFIS.VISUALIZADOR]: [
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
  resultados: 'resultados:ver',
  financeiro: 'financeiro:ver',
  tarefas: 'tarefas:ver',
  configuracoes: 'configuracoes:ver',
};

export function normalizarPerfil(perfil) {
  const valor = String(perfil || '').trim().toLowerCase();
  if (PERFIL_ALIASES[valor]) return PERFIL_ALIASES[valor];
  return PERFIS.VISUALIZADOR;
}

export function obterPerfilDoUsuario(user) {
  const bruto =
    user?.profile?.perfil ||
    user?.perfil ||
    user?.user_metadata?.perfil ||
    user?.app_metadata?.perfil ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role;

  return normalizarPerfil(bruto);
}

export function obterLabelPerfil(perfil) {
  const normalizado = normalizarPerfil(perfil);
  return PERFIL_LABELS[normalizado] || PERFIL_LABELS[PERFIS.VISUALIZADOR];
}

export function perfilPodeGerenciarAcessos(perfil) {
  return normalizarPerfil(perfil) === PERFIS.ADMIN;
}

export function usuarioTemPermissao(user, permissao) {
  if (!permissao) return true;

  const perfil = obterPerfilDoUsuario(user);
  const permissoes = permissoesPorPerfil[perfil] || [];

  return permissoes.includes('*') || permissoes.includes(permissao);
}
