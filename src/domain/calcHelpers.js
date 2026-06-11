const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const semEspacos = trimmed.replace(/\s+/g, '');
    const ultimaVirgula = semEspacos.lastIndexOf(',');
    const ultimoPonto = semEspacos.lastIndexOf('.');

    let normalized = semEspacos;

    if (ultimaVirgula > -1 && ultimoPonto > -1) {
      normalized = ultimaVirgula > ultimoPonto
        ? semEspacos.replace(/\./g, '').replace(',', '.')
        : semEspacos.replace(/,/g, '');
    } else if (ultimaVirgula > -1) {
      normalized = semEspacos.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toNonNegativeNumber(value) {
  return Math.max(0, toNumber(value));
}

export function safeDivide(value, divisor, fallback = 0) {
  const safeDivisor = toNumber(divisor);
  if (!safeDivisor) return fallback;
  const result = toNumber(value) / safeDivisor;
  return Number.isFinite(result) ? result : fallback;
}

export function toDateKey(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();
  if (!raw) return '';

  const key = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return Number.isNaN(new Date(`${key}T00:00:00Z`).getTime()) ? '' : key;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export function daysBetween(start, end) {
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  if (!startKey || !endKey) return 0;
  const startDate = new Date(`${startKey}T00:00:00Z`);
  const endDate = new Date(`${endKey}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

export function addDaysToDate(dateValue, days) {
  const dateKey = toDateKey(dateValue);
  if (!dateKey) return '';
  const offset = Math.round(toNumber(days));
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function calculateEstimatedDays(pesoInicial, pesoAlvo, gmdEsperado) {
  const ganhoPlanejado = toNumber(pesoAlvo) - toNumber(pesoInicial);
  const gmd = toNumber(gmdEsperado);
  if (ganhoPlanejado <= 0 || gmd <= 0) return 0;
  return safeDivide(ganhoPlanejado, gmd);
}

export function calculateDailyConsumptionKg({ mode, heads, pesoInicial, pesoFinal, percentualPv, kgPorCabeca }) {
  const totalCabecas = toNonNegativeNumber(heads);
  if (!totalCabecas) return 0;

  if (mode === 'kg_cab_dia') {
    return totalCabecas * toNonNegativeNumber(kgPorCabeca);
  }

  const pesoMedio = (toNonNegativeNumber(pesoInicial) + toNonNegativeNumber(pesoFinal)) / 2;
  const percentual = toNonNegativeNumber(percentualPv);
  return pesoMedio > 0 && percentual > 0
    ? totalCabecas * ((pesoMedio * percentual) / 100)
    : 0;
}

export function calculateConsumptionCost(consumoTotalKg, precoKg) {
  return toNonNegativeNumber(consumoTotalKg) * toNonNegativeNumber(precoKg);
}
