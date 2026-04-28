export function makeSession() {
  return { user: { id: 'user-1', email: 'user1@test.local' } };
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
