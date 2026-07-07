import { parseNumeroEntrada } from '../utils/formatters.js';
import { calcularRendimentoCarcaca } from './indicadores.js';
import { safeDivide, toNumber } from './calcHelpers.js';

const KG_POR_ARROBA = 15;
const RENDIMENTO_PADRAO = 52;
const RENDIMENTO_PADRAO_FRACAO = RENDIMENTO_PADRAO / 100;

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

// ── Sprint 14 — fonte única de cálculo de arroba ────────────────────────────
// Contrato oficial: docs/DECISAO_CALCULO_ARROBA_HERDON.md. `calcularIndicadoresArroba`
// acima é mantida (usada por ArrobaPreview/useArroba/VendaLoteModal) — as
// funções abaixo são a base reutilizável para todo cálculo de custo/lucro por
// arroba a partir daqui (calculos.js, resumoLote.js, indicadoresEstrategicos.js).

/**
 * Normaliza rendimento de carcaça para fração (0–1). Aceita tanto `52` quanto
 * `0.52` (o projeto já tem as duas representações em uso — `lote.rendimento_carcaca`
 * é sempre percentual, mas alguns chamadores já passam fração). Valores
 * ausentes/inválidos caem no padrão de mercado (52%).
 */
export function normalizarRendimentoCarcaca(valor) {
  const parsed = toNumber(valor);
  if (!Number.isFinite(parsed) || parsed <= 0) return RENDIMENTO_PADRAO_FRACAO;
  const fracao = parsed > 1 ? parsed / 100 : parsed;
  return clamp(fracao, 0.01, 1);
}

/** Arroba de peso vivo — leitura física do animal/lote, sem rendimento de carcaça. */
export function calcularArrobasPesoVivo(pesoKg) {
  return safeDivide(pesoKg, KG_POR_ARROBA);
}

/** Arroba de carcaça — base de toda decisão econômica (venda, custo/@, lucro/@). */
export function calcularArrobasCarcaca(pesoKg, rendimentoCarcaca) {
  return safeDivide(toNumber(pesoKg) * normalizarRendimentoCarcaca(rendimentoCarcaca), KG_POR_ARROBA);
}

/** Arroba de ganho no ciclo (carcaça) — eficiência de engorda, não confundir com arroba de carcaça do peso total. */
export function calcularArrobasGanho(pesoInicialKg, pesoFinalKg, rendimentoCarcaca) {
  const ganhoKg = toNumber(pesoFinalKg) - toNumber(pesoInicialKg);
  return safeDivide(ganhoKg * normalizarRendimentoCarcaca(rendimentoCarcaca), KG_POR_ARROBA);
}

/** Custo por arroba de carcaça — base oficial para decisão econômica (não usar arroba de ganho/peso vivo aqui). */
export function calcularCustoPorArrobaCarcaca(custoTotal, pesoKg, rendimentoCarcaca) {
  return safeDivide(custoTotal, calcularArrobasCarcaca(pesoKg, rendimentoCarcaca));
}

/** Lucro por arroba de carcaça — mesma base do custo por arroba, para os dois serem comparáveis entre si. */
export function calcularLucroPorArrobaCarcaca(lucroTotal, pesoKg, rendimentoCarcaca) {
  return safeDivide(lucroTotal, calcularArrobasCarcaca(pesoKg, rendimentoCarcaca));
}

/** Preço de venda realizado por arroba de carcaça (receita ÷ arrobas de carcaça vendidas). */
export function calcularPrecoVendaPorArrobaCarcaca(receitaTotal, pesoKg, rendimentoCarcaca) {
  return safeDivide(receitaTotal, calcularArrobasCarcaca(pesoKg, rendimentoCarcaca));
}

