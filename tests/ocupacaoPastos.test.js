import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularOcupacaoPasto,
  calcularOcupacaoPastos,
  classificarLotacaoPasto,
  listarLotesSemPasto,
  obterLabelStatusLotacao,
} from '../src/domain/ocupacaoPastos.js';

test('pasto vazio (sem lote ativo) é classificado como vazio, mesmo sem área/capacidade', () => {
  const pasto = { id: 1, nome: 'Pasto 1' };
  const ocupacao = calcularOcupacaoPasto(pasto, [], []);
  assert.equal(ocupacao.status, 'vazio');
  assert.equal(ocupacao.quantidadeLotes, 0);
  assert.equal(ocupacao.cabecasEstimadas, 0);
});

test('pasto com lote ativo mas sem área/capacidade é "sem dados suficientes"', () => {
  const pasto = { id: 1, nome: 'Pasto 1' };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 20 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'sem_dados');
  assert.equal(ocupacao.cabecasEstimadas, 20);
});

test('pasto sem área mas com capacidade_suporte_ua_ha ainda é "sem dados suficientes"', () => {
  const pasto = { id: 1, nome: 'Pasto 1', capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 20 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'sem_dados');
});

test('pasto sem capacidade mas com área ainda é "sem dados suficientes"', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 20 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'sem_dados');
});

test('pasto com 1 lote ativo dentro da capacidade é classificado como ok', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 5 }];
  const animais = [{ id: 100, lote_id: 10, qtd: 5, p_at: 300 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);

  assert.equal(ocupacao.status, 'ok');
  assert.equal(ocupacao.quantidadeLotes, 1);
  assert.equal(ocupacao.cabecasEstimadas, 5);
  assert.equal(ocupacao.pesoMedioEstimado, 300);
  assert.equal(ocupacao.pesoTotalEstimado, 1500);
});

test('pasto com múltiplos lotes soma cabeças e UA de todos', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 5 };
  const lotes = [
    { id: 10, status: 'ativo', pastagem_id: 1, qtd: 5 },
    { id: 20, status: 'ativo', pastagem_id: 1, qtd: 3 },
  ];
  const animais = [
    { id: 100, lote_id: 10, qtd: 5, p_at: 300 },
    { id: 200, lote_id: 20, qtd: 3, p_at: 400 },
  ];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);

  assert.equal(ocupacao.quantidadeLotes, 2);
  assert.equal(ocupacao.cabecasEstimadas, 8);
  assert.equal(ocupacao.pesoTotalEstimado, 5 * 300 + 3 * 400);
});

test('lote inativo não entra na ocupação do pasto', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'encerrado', pastagem_id: 1, qtd: 999 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'vazio');
  assert.equal(ocupacao.cabecasEstimadas, 0);
});

test('lote em outro pasto não entra na ocupação', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 2, qtd: 50 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'vazio');
});

test('classificarLotacaoPasto: até 80% é ok, 80-100% é atenção, acima de 100% é acima da capacidade', () => {
  const base = { quantidadeLotes: 1, areaHa: 10, capacidadeUaHa: 1 };
  assert.equal(classificarLotacaoPasto({ ...base, percentualOcupacao: 0.79 }), 'ok');
  assert.equal(classificarLotacaoPasto({ ...base, percentualOcupacao: 0.8 }), 'atencao');
  assert.equal(classificarLotacaoPasto({ ...base, percentualOcupacao: 0.99 }), 'atencao');
  assert.equal(classificarLotacaoPasto({ ...base, percentualOcupacao: 1.01 }), 'acima_capacidade');
});

test('listarLotesSemPasto retorna apenas lotes ativos sem pastagem_id', () => {
  const db = {
    lotes: [
      { id: 1, status: 'ativo', pastagem_id: null },
      { id: 2, status: 'ativo', pastagem_id: 5 },
      { id: 3, status: 'encerrado', pastagem_id: null },
    ],
  };
  assert.deepEqual(listarLotesSemPasto(db).map((l) => l.id), [1]);
});

test('calcularOcupacaoPastos não quebra com db vazio/nulo', () => {
  assert.deepEqual(calcularOcupacaoPastos(), []);
  assert.deepEqual(calcularOcupacaoPastos({}), []);
  assert.deepEqual(calcularOcupacaoPastos({ pastagens: null, lotes: null, animais: null }), []);
});

test('calcularOcupacaoPastos não quebra com lote sem qtd/peso', () => {
  const db = {
    pastagens: [{ id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 }],
    lotes: [{ id: 10, status: 'ativo', pastagem_id: 1 }],
    animais: [{ id: 100, lote_id: 10 }],
  };
  const [ocupacao] = calcularOcupacaoPastos(db);
  assert.equal(Number.isFinite(ocupacao.cabecasEstimadas), true);
  assert.equal(Number.isFinite(ocupacao.pesoMedioEstimado), true);
  assert.equal(Number.isFinite(ocupacao.pesoTotalEstimado), true);
});

test('calcularOcupacaoPastos filtra por fazenda', () => {
  const db = {
    pastagens: [
      { id: 1, fazenda_id: 1, nome: 'Pasto A' },
      { id: 2, fazenda_id: 2, nome: 'Pasto B' },
    ],
    lotes: [],
    animais: [],
  };
  const resultado = calcularOcupacaoPastos(db, { fazendaId: 1 });
  assert.deepEqual(resultado.map((p) => p.id), [1]);
});

test('obterLabelStatusLotacao retorna texto em português para cada status', () => {
  assert.equal(obterLabelStatusLotacao('vazio'), 'Vazio');
  assert.equal(obterLabelStatusLotacao('ok'), 'Ok');
  assert.equal(obterLabelStatusLotacao('atencao'), 'Atenção');
  assert.equal(obterLabelStatusLotacao('acima_capacidade'), 'Acima da capacidade');
  assert.equal(obterLabelStatusLotacao('sem_dados'), 'Sem dados suficientes');
  assert.equal(obterLabelStatusLotacao('status-desconhecido'), 'Sem dados suficientes');
});
