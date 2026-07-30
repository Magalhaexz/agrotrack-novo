import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularOcupacaoPasto,
  calcularOcupacaoPastos,
  classificarLotacaoPasto,
  listarLotesSemPasto,
  obterLabelStatusLotacao,
} from '../src/domain/ocupacaoPastos.js';
import { calcularUaPorLote } from '../src/domain/unidadeAnimal.js';

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

// ── P1-08: peso/UA usam o mesmo fallback canônico de unidadeAnimal.js ───────

test('animal sem p_at, mas lote com peso atual: pesoMedioEstimado usa o peso do lote (não zera)', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 5, p_at: 380 }];
  // Nenhum registro de animal para o lote — só o próprio lote tem peso.
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);

  assert.equal(ocupacao.pesoMedioEstimado, 380, 'cai para lote.p_at em vez de zerar');
  assert.equal(ocupacao.pesoTotalEstimado, 380 * 5);
  assert.ok(ocupacao.uaEstimada > 0, 'UA não fica zerada por falta de animal.p_at');
});

test('lote sem peso em nenhuma fonte (nem animal, nem lote) fica com peso 0, finito — não inventa valor', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 5 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);

  assert.equal(ocupacao.pesoMedioEstimado, 0);
  assert.equal(ocupacao.pesoTotalEstimado, 0);
  assert.equal(Number.isFinite(ocupacao.pesoMedioEstimado), true);
  assert.equal(Number.isFinite(ocupacao.uaEstimada), true);
});

test('múltiplos animais no mesmo lote: pesoMedioEstimado é a média ponderada por cabeça', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 8 }];
  const animais = [
    { id: 100, lote_id: 10, qtd: 5, p_at: 300 },
    { id: 101, lote_id: 10, qtd: 3, p_at: 400 },
  ];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);

  // (5*300 + 3*400) / 8 = 337,5
  assert.equal(ocupacao.pesoMedioEstimado, (5 * 300 + 3 * 400) / 8);
  assert.equal(ocupacao.pesoTotalEstimado, 5 * 300 + 3 * 400);
});

test('fallback por animal segue a mesma cadeia de unidadeAnimal.js (p_at → peso_vivo_kg → p_ini)', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'ativo', pastagem_id: 1, qtd: 2 }];
  const animais = [
    { id: 100, lote_id: 10, qtd: 1, peso_vivo_kg: 320 }, // sem p_at, tem peso_vivo_kg
    { id: 101, lote_id: 10, qtd: 1, p_ini: 280 }, // sem p_at nem peso_vivo_kg, só p_ini
  ];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);
  assert.equal(ocupacao.pesoMedioEstimado, (320 + 280) / 2);
});

test('lote vendido não entra na ocupação do pasto', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 };
  const lotes = [{ id: 10, status: 'vendido', pastagem_id: 1, qtd: 999 }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, []);
  assert.equal(ocupacao.status, 'vazio');
  assert.equal(ocupacao.cabecasEstimadas, 0);
  assert.equal(ocupacao.uaEstimada, 0);
});

test('uaEstimada da ocupação é EXATAMENTE a soma de calcularUaPorLote (mesma fonte canônica)', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 5 };
  const lotes = [
    { id: 10, status: 'ativo', pastagem_id: 1, qtd: 6 },
    { id: 20, status: 'ativo', pastagem_id: 1, qtd: 4, p_at: 350 }, // sem animal individual
  ];
  const animais = [
    { id: 100, lote_id: 10, qtd: 6, p_at: 310 },
  ];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);

  const uaEsperada = lotes.reduce((soma, l) => soma + calcularUaPorLote(animais, l.id, l), 0);
  assert.equal(ocupacao.uaEstimada, uaEsperada);
  assert.ok(Number.isFinite(ocupacao.percentualOcupacao));
});

test('nenhum resultado é NaN ou Infinity, mesmo com dados incompletos/estranhos', () => {
  const pasto = { id: 1, nome: 'Pasto 1', area_ha: 0, capacidade_suporte_ua_ha: 0 };
  const lotes = [
    { id: 10, status: 'ativo', pastagem_id: 1 }, // sem qtd, sem p_at
    { id: 20, status: 'ativo', pastagem_id: 1, qtd: null, p_at: null },
  ];
  const animais = [{ id: 100, lote_id: 10, qtd: null, p_at: undefined }];
  const ocupacao = calcularOcupacaoPasto(pasto, lotes, animais);

  ['cabecasEstimadas', 'pesoMedioEstimado', 'pesoTotalEstimado', 'uaEstimada'].forEach((campo) => {
    assert.equal(Number.isNaN(ocupacao[campo]), false, campo);
    assert.notEqual(ocupacao[campo], Infinity, campo);
  });
  assert.equal(ocupacao.percentualOcupacao, null);
});

test('obterLabelStatusLotacao retorna texto em português para cada status', () => {
  assert.equal(obterLabelStatusLotacao('vazio'), 'Vazio');
  assert.equal(obterLabelStatusLotacao('ok'), 'Ok');
  assert.equal(obterLabelStatusLotacao('atencao'), 'Atenção');
  assert.equal(obterLabelStatusLotacao('acima_capacidade'), 'Acima da capacidade');
  assert.equal(obterLabelStatusLotacao('sem_dados'), 'Sem dados suficientes');
  assert.equal(obterLabelStatusLotacao('status-desconhecido'), 'Sem dados suficientes');
});
