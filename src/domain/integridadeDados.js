// Sprint 28: detector de integridade de vínculo com fazenda. Puro, sem I/O.
//
// Motivação: registros sem `faz_id`/`fazenda_id` ficam invisíveis no recorte
// por fazenda (o filtro estrito de lotes os esconde de todas as fazendas) — e
// só aparecem na visão "Todas as fazendas". Este módulo os localiza para que
// não fiquem escondidos silenciosamente antes de o produtor importar dados.
//
// NÃO corrige nada automaticamente (não apaga, não atribui fazenda) — só
// diagnostica. A correção é decisão do usuário.

function idFazendaDoLote(lote) {
  return lote?.faz_id ?? lote?.fazenda_id ?? null;
}

/** Lotes sem fazenda vinculada (`faz_id`/`fazenda_id` ausente/nulo). */
export function detectarLotesOrfaos(db) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  return lotes.filter((lote) => {
    const fid = idFazendaDoLote(lote);
    return fid == null || Number.isNaN(Number(fid));
  });
}

/**
 * Registros operacionais sem fazenda vinculada, por tabela. Tabelas que se
 * ancoram num lote (custos, pesagens, sanitário, animais) são consideradas
 * órfãs quando o lote referenciado não existe ou é ele próprio órfão; tabelas
 * com `fazenda_id` direto (estoque, pastagens, tarefas, movimentações) quando
 * esse campo está ausente.
 */
export function detectarRegistrosSemFazenda(db) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lotesOrfaosIds = new Set(detectarLotesOrfaos(db).map((l) => Number(l.id)));
  const loteExiste = new Set(lotes.map((l) => Number(l.id)));

  const anchoradoEmLoteValido = (loteId) => {
    if (loteId == null) return false; // sem lote_id → não atribuível
    const n = Number(loteId);
    return loteExiste.has(n) && !lotesOrfaosIds.has(n);
  };

  const semFazendaDireta = (arr, campo = 'fazenda_id') =>
    (Array.isArray(arr) ? arr : []).filter((r) => {
      const v = r?.[campo] ?? r?.faz_id;
      return v == null || Number.isNaN(Number(v));
    });

  const semLoteValido = (arr) =>
    (Array.isArray(arr) ? arr : []).filter((r) => !anchoradoEmLoteValido(r?.lote_id));

  return {
    custos: semLoteValido(db?.custos),
    pesagens: semLoteValido(db?.pesagens),
    sanitario: semLoteValido(db?.sanitario),
    estoque: semFazendaDireta(db?.estoque),
    pastagens: semFazendaDireta(db?.pastagens),
    // tarefas e movimentações podem legitimamente não ter lote nem fazenda
    // (gerais da conta) — só marcamos quando NÃO têm nenhum dos dois.
    tarefas: (Array.isArray(db?.tarefas) ? db.tarefas : []).filter(
      (t) => (t?.fazenda_id ?? null) == null && !anchoradoEmLoteValido(t?.lote_id)
    ),
  };
}

/**
 * Resumo consolidado dos problemas de integridade — pronto para exibir num
 * aviso administrativo. `total` é a soma de tudo; `temProblemas` é o gatilho
 * do aviso.
 */
export function resumirProblemasIntegridade(db) {
  const lotesOrfaos = detectarLotesOrfaos(db);
  const registros = detectarRegistrosSemFazenda(db);
  const porTabela = {
    lotes: lotesOrfaos.length,
    custos: registros.custos.length,
    pesagens: registros.pesagens.length,
    sanitario: registros.sanitario.length,
    estoque: registros.estoque.length,
    pastagens: registros.pastagens.length,
    tarefas: registros.tarefas.length,
  };
  const total = Object.values(porTabela).reduce((a, b) => a + b, 0);
  return {
    total,
    temProblemas: total > 0,
    porTabela,
    // mensagem única, segura para exibir ao usuário
    mensagem:
      total > 0
        ? 'Existem registros sem fazenda vinculada. Revise para garantir filtros corretos.'
        : null,
  };
}
