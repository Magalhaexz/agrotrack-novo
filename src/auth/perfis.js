export const PERFIS = {
  PROPRIETARIO: 'proprietario',
  GERENTE: 'gerente',
  OPERADOR: 'operador',
  VISUALIZADOR: 'visualizador',
};

export const permissoesPorPerfil = {
  [PERFIS.PROPRIETARIO]: ['*'],
  [PERFIS.GERENTE]: [
    'dashboard:ver',
    'lotes:ver',
    'lotes:editar',
    'animais:ver',
    'animais:movimentar',
    'sanitario:ver',
    'sanitario:editar',
    'estoque:ver',
    'estoque:movimentar',
    'financeiro:ver',
    'tarefas:ver',
    'resultados:ver',
    'configuracoes:ver',
    'funcionarios:ver',
  ],
  [PERFIS.OPERADOR]: [
    'dashboard:ver',
    'lotes:ver',
    'animais:ver',
    'animais:movimentar',
    'sanitario:ver',
    'estoque:ver',
    'estoque:movimentar',
    'tarefas:ver',
    'resultados:ver',
  ],
  [PERFIS.VISUALIZADOR]: [
    'dashboard:ver',
    'lotes:ver',
    'animais:ver',
    'sanitario:ver',
    'estoque:ver',
    'resultados:ver',
    'financeiro:ver',
    'tarefas:ver',
  ],
};

export const permissoesPorPagina = {
  dashboard: 'dashboard:ver',
  fazendas: 'configuracoes:ver',
  lotes: 'lotes:ver',
  calendarioOperacional: 'sanitario:ver',
  comparativoLotes: 'resultados:ver',
  funcionarios: 'funcionarios:ver',
  rotina: 'sanitario:ver',
  animais: 'animais:ver',
  suplementacao: 'estoque:ver',
  sanitario: 'sanitario:ver',
  estoque: 'estoque:ver',
  pesagens: 'animais:movimentar',
  acompanhamentoPeso: 'animais:ver',
  custos: 'financeiro:ver',
  resultados: 'resultados:ver',
  financeiro: 'financeiro:ver',
  tarefas: 'tarefas:ver',
  configuracoes: 'configuracoes:ver',
};

export function normalizarPerfil(perfil) {
  const valor = String(perfil || '').trim().toLowerCase();
  if (Object.values(PERFIS).includes(valor)) return valor;
  return PERFIS.VISUALIZADOR;
}

export function obterPerfilDoUsuario(user) {
  const bruto =
    user?.user_metadata?.perfil ||
    user?.app_metadata?.perfil ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role;

  return normalizarPerfil(bruto);
}

export function usuarioTemPermissao(user, permissao) {
  if (!permissao) return true;

  const perfil = obterPerfilDoUsuario(user);
  const permissoes = permissoesPorPerfil[perfil] || [];

  return permissoes.includes('*') || permissoes.includes(permissao);
}
