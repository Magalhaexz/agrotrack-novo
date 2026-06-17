import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularCenarioPecuaria } from './projecaoCenario.js';

const BASE = {
  cabecas: 100,
  pesoInicialKg: 300,
  precoCompraArroba: 200,
  rendimentoCarcaca: 52,
  diasConfinamento: 90,
  gmdKgDia: 1.2,
  custoDiarioCabeca: 15,
  precoVendaArroba: 270,
  custoFrete: 0,
  outrosCustos: 0,
};

describe('calcularCenarioPecuaria', () => {
  it('retorna peso final correto com GMD', () => {
    const r = calcularCenarioPecuaria(BASE);
    // 300 + 1.2 * 90 = 408
    assert.equal(r.pesoFinalKg, 408);
  });

  it('calcula arrobas carcaça na compra', () => {
    const r = calcularCenarioPecuaria(BASE);
    // 300 * 0.52 / 15 = 10.4
    assert.equal(r.arrobasCarcacaCompra, 10.4);
  });

  it('calcula arrobas carcaça na venda', () => {
    const r = calcularCenarioPecuaria(BASE);
    // 408 * 0.52 / 15 = 14.144
    assert.equal(r.arrobasCarcacaVenda, 14.14);
  });

  it('calcula custo de compra corretamente', () => {
    const r = calcularCenarioPecuaria(BASE);
    // 10.4 @ * R$200 * 100 cab = 208000
    assert.equal(r.custoCompra, 208000);
  });

  it('calcula custo diário corretamente', () => {
    const r = calcularCenarioPecuaria(BASE);
    // R$15 * 90 dias * 100 cab = 135000
    assert.equal(r.custoDiario, 135000);
  });

  it('custo total soma compra + diário + frete + outros', () => {
    const r = calcularCenarioPecuaria({ ...BASE, custoFrete: 5000, outrosCustos: 2000 });
    assert.equal(r.custoTotal, 208000 + 135000 + 5000 + 2000);
  });

  it('receita projetada = arrobas venda * preço * cabeças', () => {
    const r = calcularCenarioPecuaria(BASE);
    // 14.14 @ * R$270 * 100 cab = 381780
    assert.equal(r.receitaProjetada, 381780);
  });

  it('margem bruta = receita - custo total', () => {
    const r = calcularCenarioPecuaria(BASE);
    assert.equal(r.margemBruta, r.receitaProjetada - r.custoTotal);
  });

  it('cenário lucrativo → viavel = true', () => {
    const r = calcularCenarioPecuaria(BASE);
    assert.equal(r.viavel, true);
  });

  it('cenário com prejuízo → viavel = false', () => {
    const r = calcularCenarioPecuaria({ ...BASE, precoVendaArroba: 100 });
    assert.equal(r.viavel, false);
  });

  it('ROI calculado como (margem / custo) * 100', () => {
    const r = calcularCenarioPecuaria(BASE);
    const roiEsperado = Math.round((r.margemBruta / r.custoTotal) * 100 * 100) / 100;
    assert.equal(r.roiPct, roiEsperado);
  });

  it('break-even: se preço venda = breakEvenArroba → margem ≈ 0', () => {
    const r = calcularCenarioPecuaria(BASE);
    const beResult = calcularCenarioPecuaria({ ...BASE, precoVendaArroba: r.breakEvenArroba });
    assert.ok(Math.abs(beResult.margemBruta) < 10, `Esperado margem ~0, obtido ${beResult.margemBruta}`);
  });

  it('zero cabeças → custo e receita zero', () => {
    const r = calcularCenarioPecuaria({ ...BASE, cabecas: 0 });
    assert.equal(r.custoTotal, 0);
    assert.equal(r.receitaProjetada, 0);
    assert.equal(r.margemBruta, 0);
  });

  it('zero dias confinamento → sem custo diário', () => {
    const r = calcularCenarioPecuaria({ ...BASE, diasConfinamento: 0 });
    assert.equal(r.custoDiario, 0);
    assert.equal(r.pesoFinalKg, 300);
  });

  it('lucro por cabeça = margem / cabeças', () => {
    const r = calcularCenarioPecuaria(BASE);
    const expected = Math.round((r.margemBruta / 100) * 100) / 100;
    assert.equal(r.lucroPorCabeca, expected);
  });
});
