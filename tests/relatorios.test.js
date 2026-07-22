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
import { gerarAlertasUnificados, adaptarAlertaParaPainelLegado } from '../src/domain/alertasUnificados.js';
import { aplicarTratativasAosAlertas } from '../src/domain/tratativasAlertas.js';
import { gerarResumoGeralTexto } from '../src/domain/whatsappResumo.js';

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

// ── P1-07: mesma fonte de alertas do Dashboard/Central (Motor Único) ────────

function diasAtras(dias) {
  return new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
}

function diasAFrente(dias) {
  return diasAtras(-dias);
}

/** Um lote qualquer + uma despesa vencida — dispara o alerta crítico
 * 'unificado-financeiro-vencidas' (id fixo, sem depender de dado por-registro). */
function dbComAlertaCritico(overrides = {}) {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda A', owner_user_id: 'user-1' }],
    lotes: [{ id: 10, fazenda_id: 1, nome: 'Lote 10', status: 'ativo', owner_user_id: 'user-1' }],
    animais: [{ id: 100, lote_id: 10, qtd: 10, p_at: 320, owner_user_id: 'user-1' }],
    pesagens: [],
    custos: [],
    movimentacoes_financeiras: [
      { id: 900, tipo: 'despesa', categoria: 'outros', valor: 500, data: diasAtras(10), owner_user_id: 'user-1' },
    ],
    movimentacoes_animais: [],
    alertas_tratativas: [],
    ...overrides,
  };
}

const ALERTA_VENCIDAS_ID = 'unificado-financeiro-vencidas';

test('buildResumoGeralFazenda usa os MESMOS ids de alerta que o Dashboard/Central produziriam para o mesmo banco', () => {
  const db = dbComAlertaCritico();
  const resumo = buildResumoGeralFazenda(db);

  // Mesma composição usada por App.jsx para alimentar Dashboard/Central.
  const esperado = aplicarTratativasAosAlertas(gerarAlertasUnificados(db), db.alertas_tratativas, new Date())
    .filter((a) => a.visivel)
    .map(adaptarAlertaParaPainelLegado)
    .filter((a) => a.nivel === 'critical');

  assert.deepEqual(resumo.alertasCriticos.map((a) => a.id).sort(), esperado.map((a) => a.id).sort());
  assert.ok(resumo.alertasCriticos.some((a) => a.id === ALERTA_VENCIDAS_ID));
});

test('alerta resolvido não aparece nos alertas críticos do relatório', () => {
  const db = dbComAlertaCritico({
    alertas_tratativas: [{ alerta_id: ALERTA_VENCIDAS_ID, status: 'resolvido' }],
  });
  const resumo = buildResumoGeralFazenda(db);
  assert.ok(!resumo.alertasCriticos.some((a) => a.id === ALERTA_VENCIDAS_ID));
});

test('alerta ignorado não aparece nos alertas críticos do relatório', () => {
  const db = dbComAlertaCritico({
    alertas_tratativas: [{ alerta_id: ALERTA_VENCIDAS_ID, status: 'ignorado' }],
  });
  const resumo = buildResumoGeralFazenda(db);
  assert.ok(!resumo.alertasCriticos.some((a) => a.id === ALERTA_VENCIDAS_ID));
});

test('alerta adiado para o futuro não aparece nos alertas críticos do relatório', () => {
  const db = dbComAlertaCritico({
    alertas_tratativas: [{ alerta_id: ALERTA_VENCIDAS_ID, status: 'adiado', adiado_ate: diasAFrente(10) }],
  });
  const resumo = buildResumoGeralFazenda(db);
  assert.ok(!resumo.alertasCriticos.some((a) => a.id === ALERTA_VENCIDAS_ID));
});

test('alerta adiado já vencido volta a aparecer (reabertura automática)', () => {
  const db = dbComAlertaCritico({
    alertas_tratativas: [{ alerta_id: ALERTA_VENCIDAS_ID, status: 'adiado', adiado_ate: diasAtras(1) }],
  });
  const resumo = buildResumoGeralFazenda(db);
  assert.ok(resumo.alertasCriticos.some((a) => a.id === ALERTA_VENCIDAS_ID));
});

test('lote encerrado não entra nos totais ativos', () => {
  const db = dbComAlertaCritico();
  db.lotes[0].status = 'encerrado';
  const resumo = buildResumoGeralFazenda(db);
  assert.equal(resumo.totalLotesAtivos, 0);
  assert.equal(resumo.totalCabecas, 0);
});

test('lote vendido não entra nos totais ativos', () => {
  const db = dbComAlertaCritico();
  db.lotes[0].status = 'vendido';
  const resumo = buildResumoGeralFazenda(db);
  assert.equal(resumo.totalLotesAtivos, 0);
  assert.equal(resumo.totalCabecas, 0);
});

test('quantidade de cabeças usa a fonte canônica (lote.qtd), não a soma bruta de animais', () => {
  const db = dbComAlertaCritico();
  db.lotes[0].qtd = 7; // diverge de propósito da soma de animais (10)
  const resumo = buildResumoGeralFazenda(db);
  assert.equal(resumo.totalCabecas, 7);
});

test('sem lote.qtd definido (lote legado), cai para a soma de animais.qtd — fallback preservado', () => {
  const db = dbComAlertaCritico();
  delete db.lotes[0].qtd;
  const resumo = buildResumoGeralFazenda(db);
  assert.equal(resumo.totalCabecas, 10);
});

test('alertas críticos do relatório nunca têm id duplicado', () => {
  const db = dbComAlertaCritico();
  const resumo = buildResumoGeralFazenda(db);
  const ids = resumo.alertasCriticos.map((a) => a.id);
  assert.equal(ids.length, new Set(ids).size);
});

test('relatório de banco vazio retorna estrutura válida, sem quebrar', () => {
  const resumo = buildResumoGeralFazenda({});
  assert.equal(resumo.totalFazendas, 0);
  assert.equal(resumo.totalPastos, 0);
  assert.equal(resumo.totalLotesAtivos, 0);
  assert.equal(resumo.totalCabecas, 0);
  assert.equal(resumo.pesoMedioGeral, 0);
  assert.equal(resumo.lucroTotalFazenda, 0);
  assert.deepEqual(resumo.alertasCriticos, []);
  assert.ok(Array.isArray(resumo.pendencias));
});

test('exportação (whatsappResumo) continua recebendo o formato esperado do relatório', () => {
  const db = dbComAlertaCritico();
  const resumo = buildResumoGeralFazenda(db);
  const texto = gerarResumoGeralTexto(resumo);
  assert.match(texto, /Resumo Geral da Fazenda/);
  assert.match(texto, /Alertas críticos: 1/);
});
