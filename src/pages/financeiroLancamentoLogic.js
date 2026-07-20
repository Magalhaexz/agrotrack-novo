// Lógica pura de NovoLancamentoModal (FinanceiroPage.jsx) extraída para ser
// testável (mesmo padrão de lotesLogic.js/calendarioOperacionalLogic.js).
//
// Auditoria funcional: um lançamento sem lote nunca gravava `fazenda_id` —
// em `filtrarDbPorFazenda` (domain/escopoFazenda.js), um registro sem
// fazenda_id/lote_id é tratado como "pertence a qualquer fazenda" e aparecia
// em todas as fazendas da conta, mesmo fora do modo consolidado.

/**
 * Resolve o `fazenda_id` a gravar num novo lançamento financeiro.
 * Prioriza a fazenda do lote escolhido (correto mesmo em modo consolidado);
 * cai para a fazenda ativa quando não há lote. `null` quando nenhuma das
 * duas está disponível (ex.: modo consolidado sem lote selecionado) — o
 * chamador deve bloquear o salvamento nesse caso.
 */
export function resolverFazendaIdLancamento({ loteEscolhido = null, fazendaSelecionada = null } = {}) {
  if (loteEscolhido) {
    const fazendaDoLote = Number(loteEscolhido.faz_id ?? loteEscolhido.fazenda_id);
    if (Number.isFinite(fazendaDoLote) && fazendaDoLote > 0) return fazendaDoLote;
  }
  const ativa = Number(fazendaSelecionada?.id ?? fazendaSelecionada?.fazenda_id);
  return Number.isFinite(ativa) && ativa > 0 ? ativa : null;
}

// Onda A (UX-FN1): edição/exclusão livre só faz sentido para lançamento
// MANUAL. Lançamento automático (origem_tipo — movimentacoes.js/
// consumoSuplementacao — ou origem — CustosPage, convenção mais antiga) só
// pode ser estornado, para não quebrar a rastreabilidade com a operação de
// origem que o gerou.
export const ORIGEM_LABELS = {
  movimentacao_animal: 'Venda/saída de animal',
  movimentacao_estoque: 'Estoque',
  consumo_suplementacao: 'Suplementação',
  custo: 'Custo operacional',
  estorno: 'Estorno',
};

export function isLancamentoManual(item) {
  return !item?.origem_tipo && !item?.origem;
}

export function getOrigemLabel(item) {
  const tipo = item?.origem_tipo || item?.origem || null;
  return tipo ? (ORIGEM_LABELS[tipo] || tipo) : null;
}

/** Um lançamento já estornado (`estornado_em` preenchido) nunca pode ser estornado de novo. */
export function podeEstornar(item) {
  return !item?.estornado_em;
}

/**
 * Segunda checagem contra estorno duplicado, além da flag `estornado_em`:
 * varre por uma linha `origem_tipo: 'estorno'` já apontando para este id.
 * Cobre o caso em que criar o reverso deu certo mas marcar a flag no
 * original falhou — sem isso, uma nova tentativa duplicaria o estorno.
 */
export function possuiEstornoRegistrado(movimentacoes, itemId) {
  return (Array.isArray(movimentacoes) ? movimentacoes : []).some(
    (mov) => mov?.origem_tipo === 'estorno' && Number(mov?.origem_id) === Number(itemId)
  );
}

/**
 * Monta o lançamento REVERSO de um estorno — nunca sobrescreve o original
 * (isso é feito à parte, marcando `estornado_em` nele). Tipo invertido (não
 * valor negativo) para que o DRE existente já neutralize o efeito sem
 * nenhuma regra nova. Motivo é obrigatório e fica registrado na observação,
 * junto do vínculo com o lançamento original via origem_tipo/origem_id.
 */
export function construirLancamentoEstorno(item, motivo, { dataHoje } = {}) {
  const motivoTrim = String(motivo || '').trim();
  if (!motivoTrim) {
    throw new Error('Informe o motivo do estorno.');
  }
  return {
    tipo: item.tipo === 'receita' ? 'despesa' : 'receita',
    categoria: item.categoria,
    valor: item.valor,
    data: dataHoje,
    data_competencia: dataHoje,
    status: 'realizado',
    lote_id: item.lote_id ?? null,
    fazenda_id: item.fazenda_id ?? null,
    descricao: `Estorno de: ${item.descricao || item.categoria || 'lançamento'}`,
    observacao: `Estorno do lançamento #${item.id}. Motivo: ${motivoTrim}`,
    origem_tipo: 'estorno',
    origem_id: item.id,
  };
}
