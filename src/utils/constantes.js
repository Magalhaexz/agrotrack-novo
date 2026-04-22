export const TIPOS_SAIDA_ANIMAL = {
  venda: 'Venda',
  morte: 'Morte',
  descarte: 'Descarte',
  transferencia: 'Transferência',
};

export const STATUS_LOTE = {
  ativo: 'Ativo',
  vendido: 'Vendido',
  encerrado: 'Encerrado',
};

export const TIPOS_MOVIMENTACAO_ESTOQUE = {
  entrada: 'Entrada',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
  perda: 'Perda',
  // Consider adding 'venda' if stock items can be sold directly
  // venda: 'Venda',
};

export const UNIDADES_ESTOQUE = ['kg', 'saco', 'litro', 'dose', 'unidade'];
