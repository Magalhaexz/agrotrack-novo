function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calcularUaPorAnimal(pesoVivoKg) {
  return toNumber(pesoVivoKg) / 450;
}

export function calcularUaPorLote(animais = [], loteId) {
  return (Array.isArray(animais) ? animais : [])
    .filter((animal) => Number(animal?.lote_id) === Number(loteId))
    .reduce((sum, animal) => {
      const pesoVivo = toNumber(animal?.p_at || animal?.peso_vivo_kg || animal?.p_ini);
      const qtd = toNumber(animal?.qtd);
      return sum + (calcularUaPorAnimal(pesoVivo) * qtd);
    }, 0);
}

export function calcularUaTotalFazenda(animais = []) {
  return (Array.isArray(animais) ? animais : []).reduce((sum, animal) => {
    const pesoVivo = toNumber(animal?.p_at || animal?.peso_vivo_kg || animal?.p_ini);
    const qtd = toNumber(animal?.qtd);
    return sum + (calcularUaPorAnimal(pesoVivo) * qtd);
  }, 0);
}

export function calcularCapacidadeTotalUa(pastagens = []) {
  return (Array.isArray(pastagens) ? pastagens : []).reduce((sum, pastagem) => {
    return sum + (toNumber(pastagem?.area_ha) * toNumber(pastagem?.capacidade_suporte_ua_ha));
  }, 0);
}

export function calcularDiagnosticoCapacidade({ animais = [], pastagens = [] } = {}) {
  const uaTotalFazenda = calcularUaTotalFazenda(animais);
  const capacidadeTotalUa = calcularCapacidadeTotalUa(pastagens);
  const saldoCapacidadeUa = capacidadeTotalUa - uaTotalFazenda;
  const statusCapacidade = saldoCapacidadeUa >= 0 ? 'dentro_da_capacidade' : 'superlotado';
  return {
    uaTotalFazenda,
    capacidadeTotalUa,
    saldoCapacidadeUa,
    statusCapacidade,
    superlotado: statusCapacidade === 'superlotado',
  };
}

