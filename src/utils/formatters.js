/**
 * Formata um valor numérico como moeda brasileira (BRL).
 * Retorna "R$ 0,00" se o valor for nulo, indefinido ou 0.
 * @param {number} valor - O valor a ser formatado.
 * @returns {string} O valor formatado como moeda.
 */
export const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);

/**
 * Formata um valor numérico para uma string com um número fixo de casas decimais.
 * Retorna "0.00" (ou com o número de casas especificado) se o valor for nulo, indefinido ou 0.
 * @param {number} valor - O valor a ser formatado.
 * @param {number} [casas=2] - O número de casas decimais.
 * @returns {string} O número formatado como string.
 */
export const formatarNumero = (valor, casas = 2) =>
  Number(valor || 0).toFixed(casas);

/**
 * Formata uma string de data (assumindo formato YYYY-MM-DD) para o formato de data local (pt-BR).
 * Retorna '-' se a data for nula ou vazia.
 * Adiciona 'T00:00:00' para garantir que a data seja interpretada como UTC e evitar problemas de fuso horário.
 * @param {string} data - A string de data a ser formatada.
 * @returns {string} A data formatada localmente ou '-'.
 */
export const formatarData = (data) => {
  if (!data) return '-';
  // Adiciona 'T00:00:00' para garantir que a string seja interpretada como uma data UTC
  // Isso ajuda a evitar problemas de fuso horário que podem mudar o dia da data.
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
};

/**
 * Formata um valor numérico como "X @" (arrobas), com 2 casas decimais.
 * @param {number} valor - O valor em arrobas.
 * @returns {string} O valor formatado como arrobas.
 */
export const formatarArroba = (valor) =>
  `${formatarNumero(valor)} @`;
