// Recorte do db operacional pela fazenda ativa (Sprint 21) — puro, sem I/O.
// `useOperationalData` carrega TODAS as fazendas da conta de uma vez (só
// filtra por owner_user_id); é este módulo que garante que cada página veja
// somente os dados da fazenda selecionada, evitando misturar lotes, estoque,
// custos, sanidade, pastos e alertas entre fazendas diferentes.

/** Registros sem fazenda_id (legado) ficam visíveis em qualquer fazenda — nunca desaparecem silenciosamente. */
function pertenceAFazenda(valor, farmId) {
  return !valor || Number(valor) === farmId;
}

/**
 * @param {object} db
 * @param {number|string|null} fazendaId - id da fazenda ativa; null/undefined devolve `db` sem alterações
 */
export function filtrarDbPorFazenda(db, fazendaId) {
  if (!fazendaId) return db;
  const farmId = Number(fazendaId);
  const belongs = (valor) => pertenceAFazenda(valor, farmId);

  const loteIds = new Set(
    (db.lotes || [])
      .filter((lote) => Number(lote.faz_id) === farmId)
      .map((lote) => lote.id)
  );
  const estoqueIds = new Set(
    (db.estoque || [])
      .filter((item) => belongs(item.fazenda_id))
      .map((item) => item.id)
  );

  return {
    ...db,
    lotes: (db.lotes || []).filter((lote) => loteIds.has(lote.id)),
    animais: (db.animais || []).filter((animal) => loteIds.has(animal.lote_id)),
    custos: (db.custos || []).filter((custo) => loteIds.has(custo.lote_id)),
    pesagens: (db.pesagens || []).filter((pesagem) => loteIds.has(pesagem.lote_id)),
    sanitario: (db.sanitario || []).filter((item) => loteIds.has(item.lote_id)),
    tarefas: (db.tarefas || []).filter(
      (tarefa) => belongs(tarefa.fazenda_id) || loteIds.has(tarefa.lote_id)
    ),
    movimentacoes_animais: (db.movimentacoes_animais || []).filter((movimento) => loteIds.has(movimento.lote_id)),
    estoque: (db.estoque || []).filter((item) => estoqueIds.has(item.id)),
    movimentacoes_estoque: (db.movimentacoes_estoque || []).filter((mov) => estoqueIds.has(mov.item_estoque_id)),
    movimentacoes_financeiras: (db.movimentacoes_financeiras || []).filter(
      (mov) => belongs(mov.fazenda_id) || loteIds.has(mov.lote_id)
    ),
    pastagens: (db.pastagens || []).filter((pasto) => belongs(pasto.fazenda_id ?? pasto.faz_id)),
    rotinas: (db.rotinas || []).filter(
      (rotina) => belongs(rotina.fazenda_id) || loteIds.has(rotina.lote_id)
    ),
    cenarios: (db.cenarios || []).filter(
      (cenario) => belongs(cenario.fazenda_id) || loteIds.has(cenario.lote_id)
    ),
    alertas_tratativas: (db.alertas_tratativas || []).filter((item) => belongs(item.fazenda_id)),
    eventos_operacionais: (db.eventos_operacionais || []).filter(
      (evento) => belongs(evento.fazenda_id) || loteIds.has(evento.lote_id)
    ),
    consumo_suplementacao: (db.consumo_suplementacao || []).filter(
      (item) => belongs(item.fazenda_id) || loteIds.has(item.lote_id)
    ),
  };
}
