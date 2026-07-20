// Sprint 28: detector de integridade de vínculo com fazenda. Puro, sem I/O.
// Onda A (sprint de integridade): ganhou também a reconciliação lote.qtd ×
// animais ativos (seção 4 da spec — divergência de quantidade, animal em
// lote encerrado, animal sem lote, venda/morte sem o lançamento financeiro
// esperado).
//
// Motivação: registros sem `faz_id`/`fazenda_id` ficam invisíveis no recorte
// por fazenda (o filtro estrito de lotes os esconde de todas as fazendas) — e
// só aparecem na visão "Todas as fazendas". Este módulo os localiza para que
// não fiquem escondidos silenciosamente antes de o produtor importar dados.
//
// NÃO corrige nada automaticamente (não apaga, não atribui fazenda, não
// recalcula saldo) — só diagnostica. A correção é decisão do usuário.
import { isAnimalIndividualAtivo } from './statusAnimal.js';

const LOTE_STATUS_ENCERRADO = new Set(['encerrado', 'vendido', 'finalizado']);

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

/** Soma de animais ATIVOS (grupo por qtd, individual por status) vinculados a um lote. */
function contarAnimaisAtivosDoLote(animais, loteId) {
  return (Array.isArray(animais) ? animais : []).reduce((acc, animal) => {
    if (Number(animal?.lote_id) !== Number(loteId)) return acc;
    const individual = String(animal?.tipo_registro || '').toLowerCase() === 'individual';
    return individual ? acc + (isAnimalIndividualAtivo(animal) ? 1 : 0) : acc + Number(animal?.qtd || 0);
  }, 0);
}

/**
 * Lotes cujo `qtd` (fonte canônica de saldo — Seção 8 da auditoria) diverge
 * da soma de animais ativos de fato vinculados a ele. NÃO corrige — só aponta
 * para revisão manual, já que a causa pode ser tanto um bug de sincronização
 * quanto um ajuste manual legítimo feito direto no banco.
 */
export function detectarDivergenciaQuantidadeLote(db) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  return lotes
    .filter((lote) => lote?.qtd != null)
    .map((lote) => ({ lote, qtdAnimaisAtivos: contarAnimaisAtivosDoLote(animais, lote.id) }))
    .filter(({ lote, qtdAnimaisAtivos }) => Number(lote.qtd) !== qtdAnimaisAtivos)
    .map(({ lote, qtdAnimaisAtivos }) => ({
      loteId: lote.id,
      loteNome: lote.nome || `Lote ${lote.id}`,
      qtdLote: Number(lote.qtd),
      qtdAnimaisAtivos,
    }));
}

/** Animal ativo (grupo com qtd>0 ou individual ativo) vinculado a um lote já encerrado/vendido/finalizado. */
export function detectarAnimalEmLoteEncerrado(db) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const lotesEncerrados = new Set(
    lotes
      .filter((lote) => LOTE_STATUS_ENCERRADO.has(String(lote?.status || '').toLowerCase()))
      .map((lote) => Number(lote.id))
  );
  if (lotesEncerrados.size === 0) return [];
  return animais.filter((animal) => {
    if (!lotesEncerrados.has(Number(animal?.lote_id))) return false;
    const individual = String(animal?.tipo_registro || '').toLowerCase() === 'individual';
    return individual ? isAnimalIndividualAtivo(animal) : Number(animal?.qtd || 0) > 0;
  });
}

/** Animal individual ativo sem `lote_id` (perdeu o vínculo — não deveria ficar "solto" e ativo). */
export function detectarAnimalSemLote(db) {
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  return animais.filter((animal) => {
    const individual = String(animal?.tipo_registro || '').toLowerCase() === 'individual';
    if (!individual || !isAnimalIndividualAtivo(animal)) return false;
    return animal?.lote_id == null || animal?.lote_id === '';
  });
}

function origensComReceitaDeAnimal(db) {
  const financeiras = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  return new Set(
    financeiras
      .filter((mov) => mov?.origem_tipo === 'movimentacao_animal' && mov?.tipo === 'receita')
      .map((mov) => Number(mov.origem_id))
  );
}

/** Movimentação de venda/abate com valor > 0 sem o lançamento de receita correspondente. */
export function detectarVendaSemReceita(db) {
  const movs = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const origensComReceita = origensComReceitaDeAnimal(db);
  return movs.filter((mov) => {
    const tipo = String(mov?.tipo || '').toLowerCase();
    const valor = Number(mov?.valor_total || 0);
    return (tipo === 'venda' || tipo === 'abate') && valor > 0 && !origensComReceita.has(Number(mov.id));
  });
}

/** Movimentação de morte/perda/descarte com um lançamento de receita indevidamente vinculado. */
export function detectarMorteComReceita(db) {
  const movs = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const origensComReceita = origensComReceitaDeAnimal(db);
  return movs.filter((mov) => {
    const tipo = String(mov?.tipo || '').toLowerCase();
    return ['morte', 'perda', 'descarte'].includes(tipo) && origensComReceita.has(Number(mov.id));
  });
}

/**
 * Resumo consolidado das divergências OPERACIONAIS (lote × animais ×
 * financeiro) — mesmo padrão de agregação de `resumirProblemasIntegridade`,
 * mantido como função separada para não alterar a mensagem/contrato já
 * testado daquela (vínculo com fazenda é outro tipo de problema).
 */
export function resumirDivergenciasOperacionais(db) {
  const porTipo = {
    lotes_qtd_divergente: detectarDivergenciaQuantidadeLote(db).length,
    animais_em_lote_encerrado: detectarAnimalEmLoteEncerrado(db).length,
    animais_sem_lote: detectarAnimalSemLote(db).length,
    vendas_sem_receita: detectarVendaSemReceita(db).length,
    mortes_com_receita: detectarMorteComReceita(db).length,
  };
  const total = Object.values(porTipo).reduce((a, b) => a + b, 0);
  return {
    total,
    temProblemas: total > 0,
    porTipo,
    mensagem: total > 0
      ? 'Existem divergências entre lotes, animais e financeiro. Revise antes de confiar nos totais.'
      : null,
  };
}
