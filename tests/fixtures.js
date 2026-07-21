export function makeSession() {
  return { user: { id: 'user-1', email: 'user1@test.local' } };
}

function base64url(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function makeFakeAccessToken(payloadOverrides = {}) {
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payloadOverrides,
  });
  return `${header}.${payload}.fake-signature`;
}

/**
 * Faz o cliente supabase (singleton) responder com uma sessão válida para
 * validateSupabaseSessionForCloud, permitindo testar o caminho "online" de
 * createOperationalRecord/updateOperationalRecord sem uma sessão real de browser.
 */
export function mockValidSupabaseAuthSession(supabase, session = makeSession()) {
  const fakeSession = { access_token: makeFakeAccessToken(), user: session.user };
  supabase.auth.getSession = async () => ({ data: { session: fakeSession }, error: null });
  supabase.auth.refreshSession = async () => ({ data: { session: fakeSession }, error: null });
  return fakeSession;
}

/**
 * Faz validateSupabaseSessionForCloud falhar (sessão expirada/sem token),
 * simulando o caminho "offline"/sem sessão válida.
 */
export function mockInvalidSupabaseAuthSession(supabase) {
  supabase.auth.getSession = async () => ({ data: { session: null }, error: null });
  supabase.auth.refreshSession = async () => ({ data: { session: null }, error: { message: 'no session to refresh' } });
}

export function makeBaseDb() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda A', owner_user_id: 'user-1' }],
    lotes: [{ id: 10, fazenda_id: 1, nome: 'Lote 10', status: 'ativo', gmd_meta: 1.3, owner_user_id: 'user-1' }],
    animais: [{ id: 100, lote_id: 10, qtd: 10, p_at: 320, p_i: 280, data_entrada: '2026-01-01', owner_user_id: 'user-1' }],
    pesagens: [{ id: 200, lote_id: 10, peso_medio: 320, data: '2026-02-01', owner_user_id: 'user-1' }],
    custos: [{ id: 300, lote_id: 10, val: 1200, owner_user_id: 'user-1' }],
    movimentacoes_financeiras: [
      { id: 400, tipo: 'despesa', categoria: 'compra_animal', lote_id: 10, valor: 1500, origem: 'custo', origem_id: 300, owner_user_id: 'user-1' },
      { id: 401, tipo: 'receita', categoria: 'venda_animal', lote_id: 10, valor: 2500, owner_user_id: 'user-1' },
    ],
    movimentacoes_animais: [{ id: 500, lote_id: 10, tipo: 'compra', qtd: 10, peso_medio: 280, valor_total: 1500, owner_user_id: 'user-1' }],
  };
}
