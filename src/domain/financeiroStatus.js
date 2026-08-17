const STATUS_VALIDOS = ['previsto', 'realizado', 'pago', 'cancelado'];

export function normalizarStatusMovimentacao(movimentacao) {
  const status = movimentacao?.status;
  if (status == null || status === '') return 'realizado';
  if (STATUS_VALIDOS.includes(status)) return status;
  return 'realizado';
}

export function getDataCompetencia(movimentacao) {
  return movimentacao?.data_competencia || movimentacao?.data || null;
}

export function getDataVencimento(movimentacao) {
  return movimentacao?.data_vencimento || movimentacao?.data || null;
}

export function getDataPagamento(movimentacao) {
  return movimentacao?.data_pagamento || null;
}

export function isMovimentacaoRealizada(movimentacao) {
  const status = normalizarStatusMovimentacao(movimentacao);
  return status === 'realizado';
}

export function isMovimentacaoPaga(movimentacao) {
  const status = normalizarStatusMovimentacao(movimentacao);
  if (status === 'pago') return true;
  // Compatibilidade com campo legado `pago: true` do Pagamento Diário
  if (status === 'realizado' && movimentacao?.pago === true) return true;
  return false;
}

export function isMovimentacaoCancelada(movimentacao) {
  const status = normalizarStatusMovimentacao(movimentacao);
  return status === 'cancelado';
}

export function deveEntrarNoResultadoLote(movimentacao) {
  const status = normalizarStatusMovimentacao(movimentacao);
  // Previsto e cancelado não entram no resultado econômico
  return status !== 'previsto' && status !== 'cancelado';
}

export function deveEntrarNoFluxoCaixa(movimentacao) {
  if (isMovimentacaoPaga(movimentacao)) return true;
  // Legado sem status e sem campo pago: trata como caixa se não tiver data_vencimento futura
  const status = normalizarStatusMovimentacao(movimentacao);
  if (status === 'realizado' && movimentacao?.pago == null) return true;
  return false;
}

/**
 * Resumo de despesas pendentes/pagas para o card "Resumo financeiro" do
 * Dashboard — vencidas, vencendo hoje, próximas e totais. Bug P1 (auditoria
 * 2026-08-13): antes só considerava despesas com categoria exatamente
 * "Pagamento Diário", então o card sempre mostrava R$ 0,00/0 pendências
 * mesmo com despesas reais e vencidas cadastradas pelo fluxo normal do
 * Financeiro. Usa os mesmos critérios de "conta a pagar" já usados pela
 * Central de Alertas e por Financeiro > Pagamentos (listarContasFinanceiras).
 * `hojeIso` é opcional (default: data local de hoje) só para facilitar teste.
 */
export function resumirPagamentosPendentes(movimentacoes = [], hojeIso = null) {
  const hoje = hojeIso ? new Date(`${hojeIso}T00:00:00`) : new Date();
  hoje.setHours(0, 0, 0, 0);
  let vencidos = 0; let hojeCount = 0; let proximos = 0; let totalPendente = 0; let totalPago = 0;
  (Array.isArray(movimentacoes) ? movimentacoes : []).forEach((item) => {
    if (item?.tipo !== 'despesa' || isMovimentacaoCancelada(item)) return;
    const valor = Number(item.valor || 0);
    if (isMovimentacaoPaga(item)) { totalPago += valor; return; }
    const vencimento = getDataVencimento(item);
    if (!vencimento) return;
    totalPendente += valor;
    const dataBase = new Date(`${vencimento}T00:00:00`);
    if (dataBase < hoje) vencidos += 1;
    else if (dataBase.getTime() === hoje.getTime()) hojeCount += 1;
    else proximos += 1;
  });
  return { vencidos, hoje: hojeCount, proximos, totalPendente, totalPago };
}
