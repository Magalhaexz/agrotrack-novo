import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRelatorioLote,
  buildRelatorioPesagens,
  buildRelatorioFinanceiro,
  buildRelatorioPastagens,
  buildResumoGeralFazenda,
  buscarPastagemNome,
} from '../src/domain/relatorios.js';
import { makeBaseDb } from './fixtures.js';

test('buscarPastagemNome encontra o pasto certo quando o id é uuid (Sprint 34)', () => {
  const db = {
    pastagens: [
      { id: '43dfeb75-fba1-4f99-8ba5-fe3814416b26', nome: 'Pasto 1' },
      { id: '90b3c952-4ed9-4250-bb8b-220176e7b00b', nome: 'Pasto 2' },
    ],
  };
  assert.equal(buscarPastagemNome(db, '90b3c952-4ed9-4250-bb8b-220176e7b00b'), 'Pasto 2');
  assert.equal(buscarPastagemNome(db, '43dfeb75-fba1-4f99-8ba5-fe3814416b26'), 'Pasto 1');
});

test('buscarPastagemNome retorna null sem pastagemId ou sem match', () => {
  const db = { pastagens: [{ id: 'abc', nome: 'Pasto X' }] };
  assert.equal(buscarPastagemNome(db, null), null);
  assert.equal(buscarPastagemNome(db, 'nao-existe'), null);
});

test('buildRelatorioLote retorna dados completos quando o lote existe', () => {
  const db = makeBaseDb();
  db.fazendas[0].nome = 'Fazenda Santa Clara';
  db.lotes[0].fazenda_id = 1;
  const relatorio = buildRelatorioLote(db, 10);

  assert.equal(relatorio.encontrado, true);
  assert.equal(relatorio.fazendaNome, 'Fazenda Santa Clara');
  assert.equal(Number.isFinite(relatorio.lucroTotal), true);
  assert.equal(Array.isArray(relatorio.ultimasPesagens), true);
});

test('buildRelatorioLote inclui decisão de venda e simulação (Sprint 32)', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 10);

  assert.equal(relatorio.precoArroba, 270);
  assert.ok(relatorio.decisaoVenda);
  assert.ok(relatorio.decisaoVenda.statusLabel);
  assert.ok(relatorio.decisaoVenda.mensagem);
  assert.ok(relatorio.simulacaoVenda);
  assert.equal(typeof relatorio.simulacaoVenda.diferenca, 'number');
  assert.match(relatorio.simulacaoVenda.aviso, /Simulação estimada/);
});

test('buildRelatorioLote não gera simulação de venda quando faltam dados financeiros', () => {
  const db = makeBaseDb();
  db.movimentacoes_financeiras = [];
  db.custos = [];
  const relatorio = buildRelatorioLote(db, 10);

  assert.equal(relatorio.decisaoVenda.status, 'dados_insuficientes');
  assert.equal(relatorio.simulacaoVenda, null);
});

test('buildRelatorioLote traz manejoResultado com status "sem registro" quando não há sanidade/suplementação (Sprint 33)', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 10);

  assert.ok(relatorio.manejoResultado);
  assert.equal(relatorio.manejoResultado.encontrado, true);
  assert.equal(relatorio.manejoResultado.sanidade.status, 'sem_registro');
  assert.equal(relatorio.manejoResultado.suplementacao.status, 'sem_registro');
  assert.deepEqual(relatorio.sinaisComplementaresVenda, []);
});

test('buildRelatorioLote integra sanidade e suplementação reais do lote (Sprint 33)', () => {
  const db = makeBaseDb();
  const hoje = new Date().toISOString().slice(0, 10);
  db.sanitario = [{ lote_id: 10, data_aplic: hoje, tipo: 'vacina' }];
  db.consumo_suplementacao = [{ lote_id: 10, custo_total: 500, quantidade_total: 100, data: hoje }];
  const relatorio = buildRelatorioLote(db, 10);

  assert.equal(relatorio.manejoResultado.sanidade.status, 'em_dia');
  assert.equal(relatorio.manejoResultado.suplementacao.temRegistro, true);
  assert.equal(relatorio.manejoResultado.suplementacao.custoSuplementoTotal, 500);
  assert.ok(relatorio.manejoResultado.insights.length > 0);
});

test('buildRelatorioLote retorna encontrado=false para lote inexistente', () => {
  const db = makeBaseDb();
  const relatorio = buildRelatorioLote(db, 999);
  assert.equal(relatorio.encontrado, false);
  assert.equal(relatorio.lote, null);
});

test('buildRelatorioLote não quebra quando o lote não tem pesagens', () => {
  const db = makeBaseDb();
  db.pesagens = [];
  const relatorio = buildRelatorioLote(db, 10);
  assert.equal(relatorio.encontrado, true);
  assert.deepEqual(relatorio.ultimasPesagens, []);
});

test('buildRelatorioLote não quebra quando não há lançamentos financeiros', () => {
  const db = makeBaseDb();
  db.movimentacoes_financeiras = [];
  db.custos = [];
  const relatorio = buildRelatorioLote(db, 10);
  assert.equal(relatorio.encontrado, true);
  assert.equal(relatorio.custoTotal, 0);
  assert.equal(relatorio.receitaTotal, 0);
});

test('buildRelatorioPesagens calcula GMD entre pesagens consecutivas', () => {
  const db = makeBaseDb();
  db.pesagens = [
    { id: 1, lote_id: 10, data: '2026-01-01', peso_medio: 300 },
    { id: 2, lote_id: 10, data: '2026-01-11', peso_medio: 310 },
  ];
  const linhas = buildRelatorioPesagens(db, { loteId: 10 });

  assert.equal(linhas.length, 2);
  const maisRecente = linhas[0];
  assert.equal(maisRecente.variacao, 10);
  assert.equal(maisRecente.gmdEntrePesagens, 1);
});

test('buildRelatorioPesagens retorna lista vazia quando não há pesagens no período', () => {
  const db = makeBaseDb();
  const linhas = buildRelatorioPesagens(db, { loteId: 10, dataInicio: '2099-01-01' });
  assert.deepEqual(linhas, []);
});

test('buildRelatorioFinanceiro resume entrou/saiu/saldo por período', () => {
  const db = makeBaseDb();
  db.movimentacoes_financeiras = [
    { id: 1, tipo: 'receita', categoria: 'venda_animal', lote_id: 10, valor: 1000, status: 'pago', data: '2026-02-01' },
    { id: 2, tipo: 'despesa', categoria: 'compra_estoque', lote_id: 10, valor: 400, status: 'pago', data: '2026-02-02' },
  ];
  const relatorio = buildRelatorioFinanceiro(db, { loteId: 10 });

  assert.equal(relatorio.entrou, 1000);
  assert.equal(relatorio.saiu, 400);
  assert.equal(relatorio.saldo, 600);
  assert.equal(relatorio.maioresCategorias[0].categoria, 'compra_estoque');
});

test('buildRelatorioFinanceiro não quebra sem lançamentos no período', () => {
  const db = makeBaseDb();
  db.movimentacoes_financeiras = [];
  const relatorio = buildRelatorioFinanceiro(db, {});
  assert.equal(relatorio.totalLancamentos, 0);
  assert.equal(relatorio.entrou, 0);
  assert.deepEqual(relatorio.maioresCategorias, []);
});

test('buildRelatorioPastagens resume ocupação com lotes', () => {
  const db = makeBaseDb();
  db.pastagens = [{ id: 1, fazenda_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 }];
  db.lotes[0].pastagem_id = 1;
  db.lotes[0].qtd = 5;
  const relatorio = buildRelatorioPastagens(db, {});

  assert.equal(relatorio.totalPastos, 1);
  assert.equal(relatorio.pastosComLote, 1);
  assert.equal(relatorio.ocupacaoPorPasto[0].cabecasEstimadas, 5);
});

test('buildRelatorioPastagens não quebra sem lotes vinculados', () => {
  const db = makeBaseDb();
  db.pastagens = [{ id: 1, fazenda_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 2 }];
  db.lotes[0].pastagem_id = null;
  const relatorio = buildRelatorioPastagens(db, {});

  assert.equal(relatorio.pastosSemLote, 1);
  assert.equal(relatorio.lotesSemPasto, 1);
  assert.deepEqual(relatorio.lotesSemPastoDetalhe.map((l) => l.id), [10]);
  assert.equal(relatorio.ocupacaoPorPasto[0].status, 'vazio');
});

test('buildRelatorioPastagens expõe status acima_capacidade e percentual de ocupação', () => {
  const db = makeBaseDb();
  db.pastagens = [{ id: 1, fazenda_id: 1, nome: 'Pasto 1', area_ha: 10, capacidade_suporte_ua_ha: 1 }];
  db.lotes[0].pastagem_id = 1;
  db.lotes[0].qtd = 50;
  db.animais = [{ id: 100, lote_id: 10, qtd: 50, p_at: 450 }];
  const relatorio = buildRelatorioPastagens(db, {});

  const [pasto] = relatorio.ocupacaoPorPasto;
  assert.equal(pasto.status, 'acima_capacidade');
  assert.equal(pasto.percentualOcupacao, 5);
  assert.deepEqual(relatorio.pastosAcimaCapacidade.map((p) => p.id), [1]);
});

test('buildRelatorioPastagens classifica pasto sem área/capacidade como sem_dados', () => {
  const db = makeBaseDb();
  db.pastagens = [{ id: 1, fazenda_id: 1, nome: 'Pasto 1' }];
  db.lotes[0].pastagem_id = 1;
  const relatorio = buildRelatorioPastagens(db, {});

  assert.equal(relatorio.ocupacaoPorPasto[0].status, 'sem_dados');
});

test('buildResumoGeralFazenda retorna totais finitos e listas válidas', () => {
  const db = makeBaseDb();
  const resumo = buildResumoGeralFazenda(db);

  assert.equal(resumo.totalFazendas, 1);
  assert.equal(Number.isFinite(resumo.totalCabecas), true);
  assert.equal(Number.isFinite(resumo.lucroTotalFazenda), true);
  assert.equal(Array.isArray(resumo.alertasCriticos), true);
  assert.equal(Array.isArray(resumo.pendencias), true);
});
