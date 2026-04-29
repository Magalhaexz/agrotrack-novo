import { parseNumeroEntrada } from '../utils/formatters';
import { calcularRendimentoCarcaca } from './indicadores';

const KG_POR_ARROBA = 15;
const RENDIMENTO_PADRAO = 52;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePositive(value) {
  const parsed = parseNumeroEntrada(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRendimento(value) {
  const parsed = parseNumeroEntrada(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return RENDIMENTO_PADRAO;
  return clamp(parsed, 1, 100);
}

function normalizePreco(value) {
  const parsed = parseNumeroEntrada(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calcularIndicadoresArroba({ peso, rendimento = RENDIMENTO_PADRAO, precoPorArroba = 0 }) {
  const pesoValido = normalizePositive(peso);

  if (!pesoValido) {
    return {
      temPesoValido: false,
      arrobaViva: null,
      arrobaCarcaca: null,
      valorEstimado: null,
    };
  }

  const rendimentoValido = normalizeRendimento(rendimento);
  const precoValido = normalizePreco(precoPorArroba);

  const arrobaViva = pesoValido / KG_POR_ARROBA;
  const pesoCarcacaKg = calcularRendimentoCarcaca(pesoValido, rendimentoValido);
  const arrobaCarcaca = pesoCarcacaKg / KG_POR_ARROBA;
  const valorEstimado = precoValido ? arrobaCarcaca * precoValido : null;

  return {
    temPesoValido: true,
    arrobaViva: Number.isFinite(arrobaViva) ? arrobaViva : null,
    arrobaCarcaca: Number.isFinite(arrobaCarcaca) ? arrobaCarcaca : null,
    valorEstimado: Number.isFinite(valorEstimado) ? valorEstimado : null,
  };
}

