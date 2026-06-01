import test from 'node:test';
import assert from 'node:assert/strict';
import { computeIndicadoresEstrategicos } from '../src/domain/indicadoresEstrategicos.js';

function makeDb() {
  return {
    pastagens: [
      { id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 },
    ],
    lotes: [
      { id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 },
    ],
    animais: [
      { id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' },
    ],
    pesagens: [],
    movimentacoes_animais: [
      { id: 1, data: '2026-01-05', tipo: 'compra', qtd: 2, peso_medio: 400, lote_id: 1 },
      { id: 2, data: '2026-01-10', tipo: 'nascimento', qtd: 1, peso_medio: 50, lote_id: 1 },
      { id: 3, data: '2026-01-12', tipo: 'venda', qtd: 3, peso_medio: 500, lote_id: 1 },
      { id: 4, data: '2026-01-15', tipo: 'morte', qtd: 1, peso_medio: 420, lote_id: 1 },
      { id: 5, data: '2026-01-20', tipo: 'transferencia_entrada', qtd: 2, peso_medio: 380, lote_id: 1 },
      { id: 6, data: '2026-01-21', tipo: 'transferencia_saida', qtd: 1, peso_medio: 390, lote_id: 1 },
      { id: 7, data: '2026-01-22', tipo: 'abate', qtd: 1, peso_medio: 520, lote_id: 1 },
    ],
    movimentacoes_financeiras: [
      { id: 11, data: '2026-01-12', tipo: 'receita', valor: 10000, lote_id: 1 },
      { id: 12, data: '2026-01-22', tipo: 'receita', valor: 3000, lote_id: 1 },
      { id: 13, data: '2026-01-06', tipo: 'despesa', valor: 4000, lote_id: 1 },
      { id: 14, data: '2026-01-18', tipo: 'despesa', valor: 1000, lote_id: 1 },
    ],
  };
}

test('indicadores estrategicos: UA e capacidade vs demanda', () => {
  const result = computeIndicadoresEstrategicos(makeDb(), '2026-01-01', '2026-01-31');
  assert.equal(result.unidadeAnimal.uaTotalFazenda, 10);
  assert.equal(result.pastagem.capacidadeTotalUa, 150);
  assert.equal(result.pastagem.saldoUa, 140);
  assert.equal(result.pastagem.statusLotacao, 'dentro_da_capacidade');
});

test('indicadores estrategicos: evolucao de rebanho formula base', () => {
  const result = computeIndicadoresEstrategicos(makeDb(), '2026-01-01', '2026-01-31');
  const r = result.evolucao.resumo;
  assert.equal(
    r.estoque_inicial + r.compras + r.nascimentos + r.transferencias_entrada - r.vendas - r.mortes - r.transferencias_saida,
    r.estoque_final
  );
});

test('indicadores estrategicos: tecnicos (desfrute, abate, crescimento)', () => {
  const result = computeIndicadoresEstrategicos(makeDb(), '2026-01-01', '2026-01-31');
  assert.equal(Number.isFinite(result.tecnicos.desfrutePct), true);
  assert.equal(Number.isFinite(result.tecnicos.taxaAbatePct), true);
  assert.equal(Number.isFinite(result.tecnicos.taxaCrescimentoPct), true);
});

test('indicadores estrategicos: economicos (margens)', () => {
  const result = computeIndicadoresEstrategicos(makeDb(), '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 13000);
  assert.equal(result.economicos.custosTotais, 5000);
  assert.equal(result.economicos.margemBruta, 8000);
  assert.equal(Number.isFinite(result.economicos.margemPorHa), true);
  assert.equal(Number.isFinite(result.economicos.margemPorCabeca), true);
});

