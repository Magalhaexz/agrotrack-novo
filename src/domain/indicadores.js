export function calcularGMD(pesoInicial, pesoFinal, diasTrato) {
  if (!diasTrato) return 0;
  return ((Number(pesoFinal || 0) - Number(pesoInicial || 0)) / Number(diasTrato)) * 1000;
}

export function calcularArrobasProduzidas(pesoInicial, pesoFinal, qtdCabecas) {
  return ((Number(pesoFinal || 0) - Number(pesoInicial || 0)) * Number(qtdCabecas || 0)) / 15;
}

export function calcularTaxaMortalidade(qtdEntrada, qtdMortes) {
  if (!qtdEntrada) return 0;
  return (Number(qtdMortes || 0) / Number(qtdEntrada || 0)) * 100;
}

export function calcularCustoporArroba(custoTotal, arrobasProduzidas) {
  if (!arrobasProduzidas) return 0;
  return Number(custoTotal || 0) / Number(arrobasProduzidas || 0);
}

export function calcularCustoPorCabecaDia(custoTotal, qtdCabecas, diasTrato) {
  if (!qtdCabecas || !diasTrato) return 0;
  return Number(custoTotal || 0) / (Number(qtdCabecas || 0) * Number(diasTrato || 0));
}

export function calcularRendimentoCarcaca(pesoVivo, rendimento) {
  return Number(pesoVivo || 0) * (Number(rendimento || 0) / 100);
}

export function calcularGMDMeta(pesoInicial, pesoAlvo, diasMeta) {
  if (!diasMeta) return 0;
  return (Number(pesoAlvo || 0) - Number(pesoInicial || 0)) / Number(diasMeta || 0);
}

export function calcularDesvioPorcentual(realizado, meta) {
  if (!meta) return 0;
  return ((Number(realizado || 0) - Number(meta || 0)) / Number(meta || 0)) * 100;
}
