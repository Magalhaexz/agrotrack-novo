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
