import test from 'node:test';
import assert from 'node:assert/strict';
import { computeIndicadoresEstrategicos } from '../src/domain/indicadoresEstrategicos.js';
import { getResumoLote } from '../src/domain/resumoLote.js';
import { computeDRE } from '../src/pages/financeiroDreLogic.js';

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

// ── P1-04: regra financeira oficial (deveEntrarNoResultadoLote + dedup) ──────
// `calculateEconomicos`/`calculateLoteResumo` somavam `movimentacoes_financeiras`
// só por tipo+data — sem excluir previsto/cancelado nem deduplicar lançamentos
// espelhados. Agora usam as mesmas fontes de `resumoLote` (`calcularReceitaLote`/
// `calcularCustoLote`, calculos.js).

function makeDbStatus(movimentacoesExtra) {
  return {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 }],
    lotes: [{ id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 }],
    animais: [{ id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' }],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: movimentacoesExtra,
    custos: [],
  };
}

test('receita realizada entra no resultado', () => {
  const db = makeDbStatus([{ id: 1, data: '2026-01-10', tipo: 'receita', valor: 1000, lote_id: 1, status: 'realizado' }]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 1000);
});

test('receita prevista não entra no resultado', () => {
  const db = makeDbStatus([{ id: 1, data: '2026-01-10', tipo: 'receita', valor: 1000, lote_id: 1, status: 'previsto' }]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 0);
});

test('despesa realizada entra no resultado', () => {
  const db = makeDbStatus([{ id: 1, data: '2026-01-10', tipo: 'despesa', valor: 400, lote_id: 1, status: 'realizado' }]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.custosTotais, 400);
});

test('despesa prevista não entra no resultado', () => {
  const db = makeDbStatus([{ id: 1, data: '2026-01-10', tipo: 'despesa', valor: 400, lote_id: 1, status: 'previsto' }]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.custosTotais, 0);
});

test('lançamento cancelado não entra no resultado', () => {
  const db = makeDbStatus([
    { id: 1, data: '2026-01-10', tipo: 'receita', valor: 1000, lote_id: 1, status: 'cancelado' },
    { id: 2, data: '2026-01-12', tipo: 'despesa', valor: 500, lote_id: 1, status: 'cancelado' },
  ]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 0);
  assert.equal(result.economicos.custosTotais, 0);
});

test('lançamento sem status mantém compatibilidade (trata como realizado)', () => {
  const db = makeDbStatus([{ id: 1, data: '2026-01-10', tipo: 'receita', valor: 1000, lote_id: 1 }]);
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 1000);
});

test('venda/custo espelhado (movimentação origem=custo + registro legado em `custos`) não duplica', () => {
  const db = {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 }],
    lotes: [{ id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 }],
    animais: [{ id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' }],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: [
      { id: 1, data: '2026-01-10', tipo: 'despesa', categoria: 'compra_estoque', valor: 300, lote_id: 1, origem: 'custo', origem_id: 77, status: 'realizado' },
    ],
    // Registro legado do MESMO custo, já espelhado pela movimentação acima —
    // não deve ser somado de novo (mesmo mecanismo de `calcularCustoLote`).
    custos: [{ id: 77, data: '2026-01-10', lote_id: 1, val: 300 }],
  };
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.custosTotais, 300, 'contado uma única vez, não 600');
  assert.equal(result.loteResumo[0].custos_totais, 300);
});

test('totais por lote coincidem com resumoLote (getResumoLote)', () => {
  const db = {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 }],
    lotes: [
      { id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 },
      { id: 2, nome: 'Lote B', rendimento_carcaca: 52, p_at: 400 },
    ],
    animais: [
      { id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' },
      { id: 'a2', lote_id: 2, qtd: 5, p_at: 400, status: 'ativo' },
    ],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: [
      { id: 1, data: '2026-01-05', tipo: 'receita', categoria: 'venda_animal', valor: 5000, lote_id: 1, status: 'realizado' },
      { id: 2, data: '2026-01-06', tipo: 'despesa', categoria: 'compra_estoque', valor: 800, lote_id: 1, status: 'realizado' },
      { id: 3, data: '2026-01-07', tipo: 'receita', categoria: 'venda_animal', valor: 3000, lote_id: 2, status: 'realizado' },
      { id: 4, data: '2026-01-08', tipo: 'despesa', categoria: 'compra_estoque', valor: 400, lote_id: 2, status: 'previsto' },
    ],
    custos: [],
  };
  // Período amplo o bastante para cobrir toda a vida dos lançamentos — os
  // totais por período devem bater com o "vida toda" de `resumoLote`.
  const result = computeIndicadoresEstrategicos(db, '2020-01-01', '2030-12-31');
  const resumoLote1 = getResumoLote(db, 1);
  const resumoLote2 = getResumoLote(db, 2);

  const linhaLote1 = result.loteResumo.find((l) => l.lote_id === 1);
  const linhaLote2 = result.loteResumo.find((l) => l.lote_id === 2);
  assert.equal(linhaLote1.receita_total, resumoLote1.receitaTotal);
  assert.equal(linhaLote1.custos_totais, resumoLote1.custoTotal);
  assert.equal(linhaLote2.receita_total, resumoLote2.receitaTotal);
  assert.equal(linhaLote2.custos_totais, resumoLote2.custoTotal);
});

test('totais gerais coincidem com a DRE (computeDRE)', () => {
  const db = {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 }],
    lotes: [{ id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 }],
    animais: [{ id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' }],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: [
      { id: 1, data: '2026-01-05', tipo: 'receita', categoria: 'venda_animal', valor: 5000, lote_id: 1, status: 'realizado' },
      { id: 2, data: '2026-01-06', tipo: 'despesa', categoria: 'compra_estoque', valor: 800, lote_id: 1, status: 'realizado' },
      // Sem lote — receita/despesa "geral" da fazenda.
      { id: 3, data: '2026-01-07', tipo: 'receita', valor: 200, lote_id: null, status: 'realizado' },
      { id: 4, data: '2026-01-08', tipo: 'despesa', valor: 150, lote_id: null, status: 'realizado' },
      // Previsto/cancelado: nem a DRE nem os indicadores devem somar.
      { id: 5, data: '2026-01-09', tipo: 'receita', valor: 9999, lote_id: null, status: 'previsto' },
    ],
    custos: [],
  };
  const result = computeIndicadoresEstrategicos(db, '2020-01-01', '2030-12-31');
  const lotesRows = db.lotes.map((l) => getResumoLote(db, l.id));
  const dre = computeDRE(db, lotesRows);

  assert.equal(result.economicos.receitaTotal, dre.receita);
  assert.equal(result.economicos.custosTotais, dre.despesa);
});

test('dados vazios retornam zeros finitos, sem NaN nem Infinity', () => {
  const db = { pastagens: [], lotes: [], animais: [], pesagens: [], movimentacoes_animais: [], movimentacoes_financeiras: [], custos: [] };
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 0);
  assert.equal(result.economicos.custosTotais, 0);
  assert.equal(result.economicos.margemBruta, 0);
  assert.equal(result.loteResumo.length, 0);
  Object.values(result.economicos).forEach((value) => {
    assert.equal(Number.isNaN(value), false);
    assert.notEqual(value, Infinity);
    assert.notEqual(value, -Infinity);
  });
});

test('filtros por fazenda: lançamento de lote fora do db recortado não vaza para o total geral', () => {
  // `db` já vem recortado por fazenda pelo chamador (mesmo contrato de sempre);
  // um lote_id que não existe em `db.lotes` (ex.: de outra fazenda) não deve
  // ser somado nem no total por lote nem no "geral sem lote".
  const db = {
    pastagens: [{ id: 1, area_ha: 100, capacidade_suporte_ua_ha: 1.5 }],
    lotes: [{ id: 1, nome: 'Lote A', rendimento_carcaca: 52, p_at: 450 }],
    animais: [{ id: 'a1', lote_id: 1, qtd: 10, p_at: 450, status: 'ativo' }],
    pesagens: [],
    movimentacoes_animais: [],
    movimentacoes_financeiras: [
      { id: 1, data: '2026-01-05', tipo: 'receita', valor: 5000, lote_id: 1, status: 'realizado' },
      { id: 2, data: '2026-01-06', tipo: 'receita', valor: 99999, lote_id: 999, status: 'realizado' },
    ],
    custos: [],
  };
  const result = computeIndicadoresEstrategicos(db, '2026-01-01', '2026-01-31');
  assert.equal(result.economicos.receitaTotal, 5000);
});

