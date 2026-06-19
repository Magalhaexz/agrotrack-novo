export const MOTIVOS_MOVIMENTACAO_PASTO = [
  { value: 'rotacao_pasto', label: 'Rotação de pasto' },
  { value: 'recuperacao_pasto', label: 'Recuperação do pasto' },
  { value: 'manejo_nutricional', label: 'Manejo nutricional' },
  { value: 'separacao_lote', label: 'Separação de lote' },
  { value: 'entrada_confinamento', label: 'Entrada em confinamento' },
  { value: 'saida_confinamento', label: 'Saída de confinamento' },
  { value: 'outro', label: 'Outro' },
];

export function filterPastagensPorFazenda(pastagens = [], fazId = null) {
  if (!fazId) return [];
  return (Array.isArray(pastagens) ? pastagens : []).filter(
    (item) => Number(item?.faz_id) === Number(fazId)
  );
}

export function isMesmoPastoAtual(lote, pastagemDestinoId) {
  if (!lote?.pastagem_id || !pastagemDestinoId) return false;
  return String(lote.pastagem_id) === String(pastagemDestinoId);
}

export function validarMovimentacaoPastoForm(form = {}, lote = null) {
  if (!lote?.id) return 'Selecione um lote válido.';
  if (!lote?.faz_id) return 'O lote não está vinculado a uma fazenda.';
  if (!form.pastagemDestinoId) return 'Selecione o pasto de destino.';
  if (!form.dataMovimentacao) return 'Informe a data da movimentação.';

  if (form.quantidadeCabecas !== '' && form.quantidadeCabecas !== null && form.quantidadeCabecas !== undefined) {
    const quantidade = Number(form.quantidadeCabecas);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return 'A quantidade de cabeças deve ser maior que zero.';
    }
  }

  if (isMesmoPastoAtual(lote, form.pastagemDestinoId) && !String(form.motivo || '').trim()) {
    return 'O destino é igual ao pasto atual. Informe um motivo para confirmar a movimentação.';
  }

  return null;
}
