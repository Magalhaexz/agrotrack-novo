import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarStatusMovimentacao,
  getDataCompetencia,
  getDataVencimento,
  getDataPagamento,
  isMovimentacaoRealizada,
  isMovimentacaoPaga,
  isMovimentacaoCancelada,
  deveEntrarNoResultadoLote,
  deveEntrarNoFluxoCaixa,
  resumirPagamentosPendentes,
} from './financeiroStatus.js';

describe('normalizarStatusMovimentacao', () => {
  it('status ausente → realizado (legado)', () => {
    assert.equal(normalizarStatusMovimentacao({}), 'realizado');
  });
  it('status null → realizado', () => {
    assert.equal(normalizarStatusMovimentacao({ status: null }), 'realizado');
  });
  it('status vazio → realizado', () => {
    assert.equal(normalizarStatusMovimentacao({ status: '' }), 'realizado');
  });
  it('status realizado → realizado', () => {
    assert.equal(normalizarStatusMovimentacao({ status: 'realizado' }), 'realizado');
  });
  it('status previsto → previsto', () => {
    assert.equal(normalizarStatusMovimentacao({ status: 'previsto' }), 'previsto');
  });
  it('status pago → pago', () => {
    assert.equal(normalizarStatusMovimentacao({ status: 'pago' }), 'pago');
  });
  it('status cancelado → cancelado', () => {
    assert.equal(normalizarStatusMovimentacao({ status: 'cancelado' }), 'cancelado');
  });
  it('status inválido → realizado (fallback seguro)', () => {
    assert.equal(normalizarStatusMovimentacao({ status: 'pendente' }), 'realizado');
  });
});

describe('getDataCompetencia', () => {
  it('retorna data_competencia quando presente', () => {
    assert.equal(getDataCompetencia({ data_competencia: '2026-01-01', data: '2026-02-01' }), '2026-01-01');
  });
  it('cai para data quando data_competencia ausente', () => {
    assert.equal(getDataCompetencia({ data: '2026-02-01' }), '2026-02-01');
  });
  it('retorna null quando ambos ausentes', () => {
    assert.equal(getDataCompetencia({}), null);
  });
});

describe('getDataVencimento', () => {
  it('retorna data_vencimento quando presente', () => {
    assert.equal(getDataVencimento({ data_vencimento: '2026-03-01', data: '2026-02-01' }), '2026-03-01');
  });
  it('cai para data quando data_vencimento ausente', () => {
    assert.equal(getDataVencimento({ data: '2026-02-01' }), '2026-02-01');
  });
});

describe('getDataPagamento', () => {
  it('retorna data_pagamento quando presente', () => {
    assert.equal(getDataPagamento({ data_pagamento: '2026-04-01' }), '2026-04-01');
  });
  it('retorna null quando ausente', () => {
    assert.equal(getDataPagamento({}), null);
  });
});

describe('isMovimentacaoRealizada', () => {
  it('legado sem status → realizada', () => assert.equal(isMovimentacaoRealizada({}), true));
  it('status realizado → true', () => assert.equal(isMovimentacaoRealizada({ status: 'realizado' }), true));
  it('status pago → false (pago ≠ realizado)', () => assert.equal(isMovimentacaoRealizada({ status: 'pago' }), false));
  it('status previsto → false', () => assert.equal(isMovimentacaoRealizada({ status: 'previsto' }), false));
});

describe('isMovimentacaoPaga', () => {
  it('status pago → true', () => assert.equal(isMovimentacaoPaga({ status: 'pago' }), true));
  it('legado com pago:true → true', () => assert.equal(isMovimentacaoPaga({ pago: true }), true));
  it('legado com pago:false → false', () => assert.equal(isMovimentacaoPaga({ pago: false }), false));
  it('legado sem pago → false', () => assert.equal(isMovimentacaoPaga({}), false));
  it('status realizado sem campo pago → false', () => assert.equal(isMovimentacaoPaga({ status: 'realizado' }), false));
  it('status previsto com pago:true → false (previsto prevalece)', () => assert.equal(isMovimentacaoPaga({ status: 'previsto', pago: true }), false));
});

describe('isMovimentacaoCancelada', () => {
  it('status cancelado → true', () => assert.equal(isMovimentacaoCancelada({ status: 'cancelado' }), true));
  it('legado sem status → false', () => assert.equal(isMovimentacaoCancelada({}), false));
  it('status realizado → false', () => assert.equal(isMovimentacaoCancelada({ status: 'realizado' }), false));
});

describe('deveEntrarNoResultadoLote', () => {
  it('legado sem status → entra', () => assert.equal(deveEntrarNoResultadoLote({}), true));
  it('realizado → entra', () => assert.equal(deveEntrarNoResultadoLote({ status: 'realizado' }), true));
  it('pago → entra', () => assert.equal(deveEntrarNoResultadoLote({ status: 'pago' }), true));
  it('previsto → não entra', () => assert.equal(deveEntrarNoResultadoLote({ status: 'previsto' }), false));
  it('cancelado → não entra', () => assert.equal(deveEntrarNoResultadoLote({ status: 'cancelado' }), false));
});

describe('deveEntrarNoFluxoCaixa', () => {
  it('status pago → entra', () => assert.equal(deveEntrarNoFluxoCaixa({ status: 'pago' }), true));
  it('legado com pago:true → entra', () => assert.equal(deveEntrarNoFluxoCaixa({ pago: true }), true));
  it('legado sem status e sem pago → entra (legado tratado como caixa)', () => assert.equal(deveEntrarNoFluxoCaixa({}), true));
  it('status previsto → não entra', () => assert.equal(deveEntrarNoFluxoCaixa({ status: 'previsto' }), false));
  it('status cancelado → não entra', () => assert.equal(deveEntrarNoFluxoCaixa({ status: 'cancelado' }), false));
  it('status realizado com pago:false → não entra no caixa', () => assert.equal(deveEntrarNoFluxoCaixa({ status: 'realizado', pago: false }), false));
});

// Bug P1 (auditoria 2026-08-13): o card "Resumo financeiro" do Dashboard só
// considerava despesas com categoria exatamente "Pagamento Diário" — uma
// despesa lançada pelo fluxo normal do Financeiro (Ração, Suplemento...)
// nunca entrava na conta, mostrando R$ 0,00/0 pendências mesmo com contas
// reais vencidas.
describe('resumirPagamentosPendentes', () => {
  it('conta despesa comum (categoria != Pagamento Diário) como pendente', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'despesa', categoria: 'Racao', valor: 800, data_vencimento: '2026-08-01' },
    ], '2026-08-17');
    assert.equal(resumo.vencidos, 1);
    assert.equal(resumo.totalPendente, 800);
  });

  it('receita nunca entra na conta de pendências', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'receita', categoria: 'Venda Animal', valor: 5000, data_vencimento: '2026-08-01' },
    ], '2026-08-17');
    assert.equal(resumo.vencidos, 0);
    assert.equal(resumo.totalPendente, 0);
  });

  it('despesa cancelada não entra em vencidos nem em pago', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'despesa', status: 'cancelado', valor: 300, data_vencimento: '2026-08-01' },
    ], '2026-08-17');
    assert.equal(resumo.vencidos, 0);
    assert.equal(resumo.totalPendente, 0);
    assert.equal(resumo.totalPago, 0);
  });

  it('despesa paga soma em totalPago, não em pendente', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'despesa', status: 'pago', valor: 150, data_vencimento: '2026-08-01' },
    ], '2026-08-17');
    assert.equal(resumo.totalPago, 150);
    assert.equal(resumo.totalPendente, 0);
    assert.equal(resumo.vencidos, 0);
  });

  it('classifica vencidos/hoje/próximos pela data de vencimento (cai para `data` quando ausente)', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'despesa', valor: 100, data_vencimento: '2026-08-10' }, // vencido
      { tipo: 'despesa', valor: 200, data_vencimento: '2026-08-17' }, // hoje
      { tipo: 'despesa', valor: 300, data: '2026-08-20' }, // próximo, cai para `data`
    ], '2026-08-17');
    assert.equal(resumo.vencidos, 1);
    assert.equal(resumo.hoje, 1);
    assert.equal(resumo.proximos, 1);
    assert.equal(resumo.totalPendente, 600);
  });

  it('despesa sem nenhuma data não entra em nenhuma contagem', () => {
    const resumo = resumirPagamentosPendentes([
      { tipo: 'despesa', valor: 999 },
    ], '2026-08-17');
    assert.equal(resumo.vencidos, 0);
    assert.equal(resumo.proximos, 0);
    assert.equal(resumo.totalPendente, 0);
  });

  it('lista vazia/indefinida não quebra', () => {
    assert.deepEqual(resumirPagamentosPendentes([], '2026-08-17'), { vencidos: 0, hoje: 0, proximos: 0, totalPendente: 0, totalPago: 0 });
    assert.deepEqual(resumirPagamentosPendentes(undefined, '2026-08-17'), { vencidos: 0, hoje: 0, proximos: 0, totalPendente: 0, totalPago: 0 });
  });
});
