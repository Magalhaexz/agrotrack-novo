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
