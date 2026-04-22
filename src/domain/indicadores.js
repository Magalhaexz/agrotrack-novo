/**
 * Converte um valor para número, usando 0 como fallback para valores nulos ou indefinidos.
 * Assumindo que esta função está disponível globalmente ou importada.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  return Number(value || 0);
}

/**
 * Calcula o Ganho Médio Diário (GMD) em gramas/dia.
 * @param {number} pesoInicial - Peso inicial em kg.
 * @param {number} pesoFinal - Peso final em kg.
 * @param {number} diasTrato - Número de dias de trato.
 * @returns {number} O GMD em g/dia, ou 0 se diasTrato for zero.
 */
export function calcularGMD(pesoInicial, pesoFinal, diasTrato) {
  if (!toNumber(diasTrato)) return 0;
  return ((toNumber(pesoFinal) - toNumber(pesoInicial)) / toNumber(diasTrato)) * 1000;
}

/**
 * Calcula a quantidade de arrobas produzidas.
 * @param {number} pesoInicial - Peso inicial em kg.
 * @param {number} pesoFinal - Peso final em kg.
 * @param {number} qtdCabecas - Quantidade de cabeças de gado.
 * @returns {number} A quantidade de arrobas produzidas.
 */
export function calcularArrobasProduzidas(pesoInicial, pesoFinal, qtdCabecas) {
  return ((toNumber(pesoFinal) - toNumber(pesoInicial)) * toNumber(qtdCabecas)) / 15;
}

/**
 * Calcula a taxa de mortalidade em porcentagem.
 * @param {number} qtdEntrada - Quantidade de animais na entrada.
 * @param {number} qtdMortes - Quantidade de mortes.
 * @returns {number} A taxa de mortalidade em %, ou 0 se qtdEntrada for zero.
 */
export function calcularTaxaMortalidade(qtdEntrada, qtdMortes) {
  if (!toNumber(qtdEntrada)) return 0;
  return (toNumber(qtdMortes) / toNumber(qtdEntrada)) * 100;
}

/**
 * Calcula o custo por arroba produzida.
 * @param {number} custoTotal - Custo total.
 * @param {number} arrobasProduzidas - Quantidade de arrobas produzidas.
 * @returns {number} O custo por arroba, ou 0 se arrobasProduzidas for zero.
 */
export function calcularCustoPorArroba(custoTotal, arrobasProduzidas) {
  if (!toNumber(arrobasProduzidas)) return 0;
  return toNumber(custoTotal) / toNumber(arrobasProduzidas);
}

/**
 * Calcula o custo por cabeça por dia.
 * @param {number} custoTotal - Custo total.
 * @param {number} qtdCabecas - Quantidade de cabeças de gado.
 * @param {number} diasTrato - Número de dias de trato.
 * @returns {number} O custo por cabeça por dia, ou 0 se qtdCabecas ou diasTrato for zero.
 */
export function calcularCustoPorCabecaDia(custoTotal, qtdCabecas, diasTrato) {
  const totalCabecasDias = toNumber(qtdCabecas) * toNumber(diasTrato);
  if (!totalCabecasDias) return 0;
  return toNumber(custoTotal) / totalCabecasDias;
}

/**
 * Calcula o rendimento da carcaça em kg.
 * @param {number} pesoVivo - Peso vivo do animal em kg.
 * @param {number} rendimento - Rendimento da carcaça em porcentagem (ex: 52 para 52%).
 * @returns {number} O peso da carcaça em kg.
 */
export function calcularRendimentoCarcaca(pesoVivo, rendimento) {
  return toNumber(pesoVivo) * (toNumber(rendimento) / 100);
}

/**
 * Calcula o GMD meta (Ganho Médio Diário meta) em kg/dia.
 * @param {number} pesoInicial - Peso inicial em kg.
 * @param {number} pesoAlvo - Peso alvo em kg.
 * @param {number} diasMeta - Número de dias para atingir a meta.
 * @returns {number} O GMD meta em kg/dia, ou 0 se diasMeta for zero.
 */
export function calcularGMDMeta(pesoInicial, pesoAlvo, diasMeta) {
  if (!toNumber(diasMeta)) return 0;
  return (toNumber(pesoAlvo) - toNumber(pesoInicial)) / toNumber(diasMeta);
}

/**
 * Calcula o desvio percentual entre um valor realizado e uma meta.
 * @param {number} realizado - Valor realizado.
 * @param {number} meta - Valor da meta.
 * @returns {number} O desvio percentual, ou 0 se a meta for zero.
 */
export function calcularDesvioPorcentual(realizado, meta) {
  if (!toNumber(meta)) return 0;
  return ((toNumber(realizado) - toNumber(meta)) / toNumber(meta)) * 100;
}
