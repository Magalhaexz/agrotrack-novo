import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFluxoCaixa } from './fluxoCaixa.js';

function mov(overrides = {}) {
  return {
    id: 1,
    tipo: 'receita',
    valor: 1000,
    data: '2026-01-01',
    lote_id: null,
    ...overrides,
  };
}

describe('calcularFluxoCaixa', () => {
  it('receita paga entra no totalRecebido', () => {
    const r = calcularFluxoCaixa([mov({ status: 'pago', valor: 5000 })]);
    assert.equal(r.totalRecebido, 5000);
    assert.equal(r.totalPago, 0);
    assert.equal(r.saldoCaixa, 5000);
  });

  it('despesa paga entra no totalPago', () => {
    const r = calcularFluxoCaixa([mov({ tipo: 'despesa', status: 'pago', valor: 3000 })]);
    assert.equal(r.totalPago, 3000);
    assert.equal(r.totalRecebido, 0);
    assert.equal(r.saldoCaixa, -3000);
  });

  it('legado sem status entra no fluxo como caixa', () => {
    const r = calcularFluxoCaixa([
      mov({ valor: 8000, tipo: 'receita' }),
      mov({ valor: 4000, tipo: 'despesa' }),
    ]);
    assert.equal(r.totalRecebido, 8000);
    assert.equal(r.totalPago, 4000);
    assert.equal(r.saldoCaixa, 4000);
  });

  it('legado com pago:true entra no fluxo', () => {
    const r = calcularFluxoCaixa([mov({ pago: true, valor: 2000 })]);
    assert.equal(r.totalRecebido, 2000);
  });

  it('receita realizada não paga vai para contasAReceber', () => {
    const r = calcularFluxoCaixa([mov({ status: 'realizado', pago: false, valor: 6000 })]);
    assert.equal(r.totalRecebido, 0);
    assert.equal(r.contasAReceber, 6000);
  });

  it('despesa realizada não paga vai para contasAPagar', () => {
    const r = calcularFluxoCaixa([mov({ tipo: 'despesa', status: 'realizado', pago: false, valor: 4500 })]);
    assert.equal(r.totalPago, 0);
    assert.equal(r.contasAPagar, 4500);
  });

  it('movimentação prevista vai para previstoFuturo', () => {
    const r = calcularFluxoCaixa([mov({ status: 'previsto', valor: 12000 })]);
    assert.equal(r.previstoFuturo, 12000);
    assert.equal(r.totalRecebido, 0);
  });

  it('movimentação cancelada não aparece em nenhum campo', () => {
    const r = calcularFluxoCaixa([mov({ status: 'cancelado', valor: 9999 })]);
    assert.equal(r.totalRecebido, 0);
    assert.equal(r.totalPago, 0);
    assert.equal(r.contasAReceber, 0);
    assert.equal(r.previstoFuturo, 0);
    assert.equal(r.vencido, 0);
  });

  it('vencido: receita realizada com vencimento passado', () => {
    const r = calcularFluxoCaixa(
      [mov({ status: 'realizado', pago: false, valor: 5000, data_vencimento: '2025-01-01' })],
      { hoje: '2026-01-01' }
    );
    assert.equal(r.contasAReceber, 5000);
    assert.equal(r.vencido, 5000);
  });

  it('não vencido: vencimento futuro não vai para vencido', () => {
    const r = calcularFluxoCaixa(
      [mov({ status: 'realizado', pago: false, valor: 5000, data_vencimento: '2027-01-01' })],
      { hoje: '2026-01-01' }
    );
    assert.equal(r.contasAReceber, 5000);
    assert.equal(r.vencido, 0);
  });

  it('saldo caixa = totalRecebido - totalPago', () => {
    const r = calcularFluxoCaixa([
      mov({ tipo: 'receita', status: 'pago', valor: 10000 }),
      mov({ tipo: 'despesa', status: 'pago', valor: 7000 }),
    ]);
    assert.equal(r.saldoCaixa, 3000);
  });

  it('filtra por loteId quando fornecido', () => {
    const r = calcularFluxoCaixa([
      mov({ lote_id: 1, tipo: 'receita', status: 'pago', valor: 5000 }),
      mov({ lote_id: 2, tipo: 'receita', status: 'pago', valor: 9999 }),
    ], { loteId: 1 });
    assert.equal(r.totalRecebido, 5000);
  });

  it('array vazio → todos os campos zero', () => {
    const r = calcularFluxoCaixa([]);
    assert.equal(r.totalRecebido, 0);
    assert.equal(r.totalPago, 0);
    assert.equal(r.saldoCaixa, 0);
    assert.equal(r.contasAReceber, 0);
    assert.equal(r.contasAPagar, 0);
    assert.equal(r.previstoFuturo, 0);
    assert.equal(r.vencido, 0);
  });
});
