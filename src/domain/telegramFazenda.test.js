import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararAlertasEscopados, enriquecerAlertasComFazenda } from './telegramFazenda.js';

const dbConta = {
  fazendas: [{ id: 1, nome: 'Boa Vista' }, { id: 2, nome: 'Santa Fé' }],
  lotes: [
    { id: 10, nome: 'L1', faz_id: 1 },
    { id: 20, nome: 'L2', faz_id: 2 },
  ],
  // demais tabelas mínimas para filtrarDbPorFazenda não quebrar
  custos: [], pesagens: [], sanitario: [], estoque: [], pastagens: [],
  movimentacoes_financeiras: [], tarefas: [], animais: [], movimentacoes_estoque: [],
  movimentacoes_animais: [], rotinas: [], cenarios: [], alertas_tratativas: [],
  eventos_operacionais: [], consumo_suplementacao: [],
};

test('conexão vinculada a uma fazenda recorta o db e não identifica (single-farm)', () => {
  const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, 1);
  assert.equal(identificarFazenda, false);
  assert.equal(db.lotes.length, 1);
  assert.equal(db.lotes[0].id, 10);
});

test('conta multi-fazenda sem recorte fixo pede identificação', () => {
  const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, null);
  assert.equal(identificarFazenda, true);
  assert.equal(db.lotes.length, 2); // não filtra, mostra tudo
});

test('conta de uma fazenda só não pede identificação', () => {
  const umaFazenda = { ...dbConta, fazendas: [{ id: 1, nome: 'Única' }] };
  const { identificarFazenda } = prepararAlertasEscopados(umaFazenda, null);
  assert.equal(identificarFazenda, false);
});

test('enriquecer marca fazendaNome a partir do lote do alerta', () => {
  const alertas = [
    { id: 'a1', titulo: 'GMD baixo', loteId: 10 },
    { id: 'a2', titulo: 'Carência vencendo', loteId: 20 },
    { id: 'a3', titulo: 'Conta vencida', loteId: null },
  ];
  const enriquecidos = enriquecerAlertasComFazenda(alertas, dbConta, true);
  assert.equal(enriquecidos[0].fazendaNome, 'Boa Vista');
  assert.equal(enriquecidos[1].fazendaNome, 'Santa Fé');
  assert.equal(enriquecidos[2].fazendaNome, null); // alerta sem lote não recebe fazenda
});

test('enriquecer não altera alertas quando identificar=false', () => {
  const alertas = [{ id: 'a1', titulo: 'X', loteId: 10 }];
  const out = enriquecerAlertasComFazenda(alertas, dbConta, false);
  assert.equal(out[0].fazendaNome, undefined);
});

test('recorte por fazenda não vaza lote da outra fazenda', () => {
  const { db } = prepararAlertasEscopados(dbConta, 2);
  assert.equal(db.lotes.every((l) => Number(l.faz_id) === 2), true);
});
