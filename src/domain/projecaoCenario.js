import { toNonNegativeNumber, toNumber, safeDivide } from './calcHelpers.js';

function round2(value) {
  const safe = toNumber(value);
  return Math.round(safe * 100) / 100;
}

export function calcularCenarioPecuaria(input = {}) {
  const cabecas = toNonNegativeNumber(input.cabecas);
  const pesoInicialKg = toNonNegativeNumber(input.pesoInicialKg);
  const precoCompraArroba = toNonNegativeNumber(input.precoCompraArroba);
  const rendimento = toNonNegativeNumber(input.rendimentoCarcaca ?? 52) / 100;
  const dias = toNonNegativeNumber(input.diasConfinamento);
  const gmd = toNonNegativeNumber(input.gmdKgDia);
  const custoDiarioCabeca = toNonNegativeNumber(input.custoDiarioCabeca);
  const precoVendaArroba = toNonNegativeNumber(input.precoVendaArroba);
  const frete = toNonNegativeNumber(input.custoFrete);
  const outros = toNonNegativeNumber(input.outrosCustos);

  const pesoFinalKg = round2(pesoInicialKg + gmd * dias);

  const arrobasCarcacaCompra = round2(safeDivide(pesoInicialKg * rendimento, 15));
  const arrobasCarcacaVenda = round2(safeDivide(pesoFinalKg * rendimento, 15));

  const custoCompra = round2(arrobasCarcacaCompra * precoCompraArroba * cabecas);
  const custoDiario = round2(custoDiarioCabeca * dias * cabecas);
  const custoTotal = round2(custoCompra + custoDiario + frete + outros);

  const receitaProjetada = round2(arrobasCarcacaVenda * precoVendaArroba * cabecas);
  const margemBruta = round2(receitaProjetada - custoTotal);

  const arrobasTotaisVenda = round2(arrobasCarcacaVenda * cabecas);
  const lucroPorArroba = round2(safeDivide(margemBruta, arrobasTotaisVenda));
  const lucroPorCabeca = round2(safeDivide(margemBruta, cabecas));
  const roiPct = round2(safeDivide(margemBruta, custoTotal) * 100);

  const breakEvenArroba = round2(safeDivide(custoTotal, arrobasTotaisVenda));
  const viavel = margemBruta >= 0;

  return {
    arrobasCarcacaCompra,
    arrobasCarcacaVenda,
    pesoFinalKg,
    custoCompra,
    custoDiario,
    custoTotal,
    receitaProjetada,
    margemBruta,
    lucroPorArroba,
    lucroPorCabeca,
    roiPct,
    breakEvenArroba,
    viavel,
  };
}
