import { toNumber, toNonNegativeNumber } from './calcHelpers.js';

export function calcularUaPorAnimal(pesoVivoKg) {
  return toNonNegativeNumber(pesoVivoKg) / 450;
}

/**
 * UA de um lote. Sem `loteCanonico`, soma direto sobre `animais[]` filtrados
 * por `lote_id` (comportamento original — cabeças/peso vêm só dos registros
 * de animais, podem divergir de `lote.qtd` após venda/morte/ajuste).
 *
 * Com `loteCanonico` (`{ qtd, p_at }`, ex.: o próprio objeto de `db.lotes`):
 * a CONTAGEM usa `lote.qtd` (fonte canônica, mesma regra de `calcLote` —
 * teste de campo PST-1/PST-2: antes a página de Pastos mostrava o total de
 * cabeças certo, mas a UA/status de lotação usava a contagem desatualizada
 * de `animais[]`), e o peso médio continua vindo dos registros de animais
 * (com fallback para `lote.p_at` se não houver nenhum registro).
 */
export function calcularUaPorLote(animais = [], loteId, loteCanonico = null) {
  const animaisDoLote = (Array.isArray(animais) ? animais : [])
    .filter((animal) => Number(animal?.lote_id) === Number(loteId));

  if (loteCanonico && loteCanonico.qtd != null) {
    const qtdCanonica = toNonNegativeNumber(loteCanonico.qtd);
    const somaPeso = animaisDoLote.reduce((s, a) => s + toNumber(a?.p_at || a?.peso_vivo_kg || a?.p_ini) * toNonNegativeNumber(a?.qtd), 0);
    const somaQtdAnimais = animaisDoLote.reduce((s, a) => s + toNonNegativeNumber(a?.qtd), 0);
    const pesoMedio = somaQtdAnimais > 0 ? somaPeso / somaQtdAnimais : toNumber(loteCanonico.p_at);
    return calcularUaPorAnimal(pesoMedio) * qtdCanonica;
  }

  return animaisDoLote.reduce((sum, animal) => {
    const pesoVivo = toNumber(animal?.p_at || animal?.peso_vivo_kg || animal?.p_ini);
    const qtd = toNonNegativeNumber(animal?.qtd);
    return sum + (calcularUaPorAnimal(pesoVivo) * qtd);
  }, 0);
}

/**
 * UA total da fazenda. Sem `lotes`, soma tudo (comportamento original).
 * Com `lotes`: só considera lotes com `status === 'ativo'` (lote finalizado/
 * vendido não deve continuar ocupando capacidade da fazenda para sempre —
 * PST-2) e usa `lote.qtd` como contagem canônica de cada lote (via
 * `calcularUaPorLote` com o 3º argumento).
 */
export function calcularUaTotalFazenda(animais = [], lotes = null) {
  const lista = Array.isArray(animais) ? animais : [];
  if (!Array.isArray(lotes)) {
    return lista.reduce((sum, animal) => {
      const pesoVivo = toNumber(animal?.p_at || animal?.peso_vivo_kg || animal?.p_ini);
      const qtd = toNonNegativeNumber(animal?.qtd);
      return sum + (calcularUaPorAnimal(pesoVivo) * qtd);
    }, 0);
  }
  return lotes
    .filter((l) => String(l?.status || 'ativo') === 'ativo')
    .reduce((soma, lote) => soma + calcularUaPorLote(lista, lote.id, lote), 0);
}

export function calcularCapacidadeTotalUa(pastagens = []) {
  return (Array.isArray(pastagens) ? pastagens : []).reduce((sum, pastagem) => {
    return sum + (toNonNegativeNumber(pastagem?.area_ha) * toNonNegativeNumber(pastagem?.capacidade_suporte_ua_ha));
  }, 0);
}

export function calcularDiagnosticoCapacidade({ animais = [], pastagens = [], lotes = null } = {}) {
  const uaTotalFazenda = calcularUaTotalFazenda(animais, lotes);
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
