import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analisarSanidadeLote,
  analisarSuplementacaoLote,
  calcularCustoSuplementacaoPorCabeca,
  calcularCustoSuplementacaoPorArroba,
  relacionarSuplementoEGmd,
  classificarRiscoSanitario,
  classificarEficienciaSuplementacao,
  gerarInsightsManejoResultado,
  gerarSinaisComplementaresVenda,
  montarDadosManejoResultado,
  STATUS_SANIDADE,
  STATUS_SUPLEMENTACAO,
  NIVEL_RISCO,
} from './manejoResultado.js';

function diasAtras(dias) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return data.toISOString().slice(0, 10);
}

// ─── sanidade ───────────────────────────────────────────────────────────────

test('analisarSanidadeLote retorna "sem registro" quando o lote não tem nenhuma ocorrência', () => {
  const resultado = analisarSanidadeLote({ registros: [] });
  assert.equal(resultado.status, STATUS_SANIDADE.SEM_REGISTRO);
  assert.match(resultado.mensagem, /sem registro sanitário/i);
  assert.equal(resultado.ultimaOcorrencia, null);
});

test('analisarSanidadeLote não quebra com dados nulos', () => {
  const resultado = analisarSanidadeLote();
  assert.equal(resultado.status, STATUS_SANIDADE.SEM_REGISTRO);
});

test('analisarSanidadeLote marca "em dia" com manejo recente', () => {
  const resultado = analisarSanidadeLote({ registros: [{ data_aplic: diasAtras(10), tipo: 'vacina' }] });
  assert.equal(resultado.status, STATUS_SANIDADE.EM_DIA);
  assert.equal(resultado.diasDesdeUltimoManejo, 10);
  assert.equal(resultado.tipoMaisRecente, 'vacina');
});

test('analisarSanidadeLote marca "atenção" entre 60 e 120 dias sem manejo', () => {
  const resultado = analisarSanidadeLote({ registros: [{ data_aplic: diasAtras(90), tipo: 'vermifugo' }] });
  assert.equal(resultado.status, STATUS_SANIDADE.ATENCAO);
});

test('analisarSanidadeLote marca "revisar manejo" com manejo muito antigo (sanidade antiga)', () => {
  const resultado = analisarSanidadeLote({ registros: [{ data_aplic: diasAtras(200), tipo: 'vacina' }] });
  assert.equal(resultado.status, STATUS_SANIDADE.REVISAR_MANEJO);
});

test('analisarSanidadeLote marca "revisar manejo" quando há ocorrência crítica recente, mesmo com data recente', () => {
  const resultado = analisarSanidadeLote({ registros: [{ data_aplic: diasAtras(5), tipo: 'mortalidade' }] });
  assert.equal(resultado.status, STATUS_SANIDADE.REVISAR_MANEJO);
  assert.match(resultado.mensagem, /merecem acompanhamento/i);
});

test('analisarSanidadeLote conta ocorrências no período e usa a mais recente', () => {
  const resultado = analisarSanidadeLote({
    registros: [
      { data_aplic: diasAtras(40), tipo: 'vermifugo' },
      { data_aplic: diasAtras(10), tipo: 'vacina' },
      { data_aplic: diasAtras(200), tipo: 'exame' },
    ],
  });
  assert.equal(resultado.tipoMaisRecente, 'vacina');
  assert.equal(resultado.totalOcorrenciasPeriodo, 2);
});

// ─── suplementação ──────────────────────────────────────────────────────────

test('calcularCustoSuplementacaoPorCabeca divide custo por cabeças', () => {
  assert.equal(calcularCustoSuplementacaoPorCabeca({ custoSuplementoTotal: 4320, qtdCabecas: 60 }), 72);
});

test('calcularCustoSuplementacaoPorArroba divide custo pelas arrobas', () => {
  assert.equal(calcularCustoSuplementacaoPorArroba({ custoSuplementoTotal: 4320, arrobas: 234.8 }), 4320 / 234.8);
});

test('calcularCustoSuplementacaoPorCabeca não quebra sem cabeças (evita divisão por zero)', () => {
  assert.equal(calcularCustoSuplementacaoPorCabeca({ custoSuplementoTotal: 1000, qtdCabecas: 0 }), 0);
});

test('analisarSuplementacaoLote soma custo e quantidade dos registros do lote', () => {
  const resultado = analisarSuplementacaoLote({
    registros: [
      { custo_total: 2000, quantidade_total: 500 },
      { custo_total: 2320, quantidade_total: 600 },
    ],
    qtdCabecas: 60,
    arrobas: 234.8,
    dias: 60,
  });
  assert.equal(resultado.temRegistro, true);
  assert.equal(resultado.custoSuplementoTotal, 4320);
  assert.equal(resultado.quantidadeTotal, 1100);
  assert.equal(resultado.custoPorCabeca, 72);
});

test('analisarSuplementacaoLote não quebra sem registros', () => {
  const resultado = analisarSuplementacaoLote({});
  assert.equal(resultado.temRegistro, false);
  assert.equal(resultado.custoSuplementoTotal, 0);
});

test('classificarEficienciaSuplementacao retorna "sem registro" sem custo de suplemento', () => {
  const resultado = classificarEficienciaSuplementacao({ custoSuplementoTotal: 0 });
  assert.equal(resultado.status, STATUS_SUPLEMENTACAO.SEM_REGISTRO);
});

test('classificarEficienciaSuplementacao retorna dados insuficientes com poucos dias no lote', () => {
  const resultado = classificarEficienciaSuplementacao({ custoSuplementoTotal: 1000, dias: 10, arrobas: 100 });
  assert.equal(resultado.status, STATUS_SUPLEMENTACAO.DADOS_INSUFICIENTES);
});

test('classificarEficienciaSuplementacao detecta custo de suplemento alto (>= 40% do custo/@ do lote)', () => {
  const resultado = classificarEficienciaSuplementacao({
    custoSuplementoTotal: 4000, custoPorArroba: 50, custoPorArrobaLote: 100, dias: 60, arrobas: 80, gmdAtual: 1.4, gmdMeta: 1.3,
  });
  assert.equal(resultado.status, STATUS_SUPLEMENTACAO.CUSTO_ALTO);
  assert.match(resultado.mensagem, /pesando no custo por arroba/i);
});

test('classificarEficienciaSuplementacao com GMD positivo classifica desempenho positivo (suplemento + GMD positivo)', () => {
  const resultado = classificarEficienciaSuplementacao({
    custoSuplementoTotal: 1000, custoPorArroba: 10, custoPorArrobaLote: 100, dias: 60, arrobas: 80, gmdAtual: 1.4, gmdMeta: 1.3,
  });
  assert.equal(resultado.status, STATUS_SUPLEMENTACAO.DESEMPENHO_POSITIVO);
});

test('classificarEficienciaSuplementacao recomenda acompanhar GMD quando abaixo da meta sem custo alto', () => {
  const resultado = classificarEficienciaSuplementacao({
    custoSuplementoTotal: 1000, custoPorArroba: 10, custoPorArrobaLote: 100, dias: 60, arrobas: 80, gmdAtual: 0.9, gmdMeta: 1.3,
  });
  assert.equal(resultado.status, STATUS_SUPLEMENTACAO.ACOMPANHAR_GMD);
});

// ─── relação suplemento x GMD ───────────────────────────────────────────────

test('relacionarSuplementoEGmd indica indício positivo com GMD acima da meta', () => {
  const resultado = relacionarSuplementoEGmd({ custoSuplementoTotal: 1000, gmdAtual: 1.4, gmdMeta: 1.3, dias: 60 });
  assert.equal(resultado.sinal, 'indicio_positivo');
});

test('relacionarSuplementoEGmd retorna sem_dados quando faltam pesagens (dias insuficientes)', () => {
  const resultado = relacionarSuplementoEGmd({ custoSuplementoTotal: 1000, gmdAtual: 1.4, gmdMeta: 1.3, dias: 5 });
  assert.equal(resultado.sinal, 'sem_dados');
});

// ─── risco sanitário ────────────────────────────────────────────────────────

test('classificarRiscoSanitario retorna risco alto quando sanidade precisa revisar manejo', () => {
  const resultado = classificarRiscoSanitario({ statusSanidade: STATUS_SANIDADE.REVISAR_MANEJO });
  assert.equal(resultado.nivel, NIVEL_RISCO.ALTO);
});

test('classificarRiscoSanitario retorna risco baixo quando sanidade em dia e GMD ok', () => {
  const resultado = classificarRiscoSanitario({ statusSanidade: STATUS_SANIDADE.EM_DIA, gmdAtual: 1.4, gmdMeta: 1.3 });
  assert.equal(resultado.nivel, NIVEL_RISCO.BAIXO);
});

// ─── insights e sinais de venda ─────────────────────────────────────────────

test('gerarInsightsManejoResultado combina mensagens de sanidade, suplementação e risco', () => {
  const insights = gerarInsightsManejoResultado({
    sanidade: { status: STATUS_SANIDADE.REVISAR_MANEJO, mensagem: 'msg sanidade' },
    suplementacao: { mensagem: 'msg suplemento' },
    relacaoGmd: { mensagem: 'msg gmd' },
    risco: { nivel: NIVEL_RISCO.ALTO, mensagem: 'msg risco' },
  });
  assert.deepEqual(insights, ['msg sanidade', 'msg suplemento', 'msg gmd', 'msg risco']);
});

test('gerarSinaisComplementaresVenda alerta custo alto e manejo a revisar sem mudar a classificação de venda', () => {
  const sinais = gerarSinaisComplementaresVenda({
    suplementacao: { status: STATUS_SUPLEMENTACAO.CUSTO_ALTO },
    sanidade: { status: STATUS_SANIDADE.REVISAR_MANEJO },
  });
  assert.equal(sinais.length, 2);
  assert.match(sinais[0], /custo por arroba/i);
  assert.match(sinais[1], /antes da venda/i);
});

test('gerarSinaisComplementaresVenda retorna lista vazia quando não há nada a avisar', () => {
  assert.deepEqual(gerarSinaisComplementaresVenda({ suplementacao: { status: STATUS_SUPLEMENTACAO.SEM_REGISTRO }, sanidade: { status: STATUS_SANIDADE.EM_DIA } }), []);
});

// ─── integração (montarDadosManejoResultado) ────────────────────────────────

test('montarDadosManejoResultado não quebra com lote inexistente', () => {
  const db = { lotes: [], sanitario: [], consumo_suplementacao: [] };
  const dados = montarDadosManejoResultado(db, 999);
  assert.equal(dados.encontrado, false);
  assert.equal(dados.sanidade.status, STATUS_SANIDADE.SEM_REGISTRO);
});

test('montarDadosManejoResultado integra sanidade e suplementação a partir do db (relatório com dados completos)', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote 1', status: 'ativo', gmd_meta: 1.3 }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 480, data_entrada: diasAtras(60) }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'compra_animal', lote_id: 1, valor: 5000 },
      { id: 2, tipo: 'receita', categoria: 'venda_animal', lote_id: 1, valor: 30000 },
    ],
    sanitario: [{ lote_id: 1, data_aplic: diasAtras(10), tipo: 'vacina' }],
    consumo_suplementacao: [{ lote_id: 1, custo_total: 1000, quantidade_total: 300, data: diasAtras(5) }],
  };
  const dados = montarDadosManejoResultado(db, 1);
  assert.equal(dados.encontrado, true);
  assert.equal(dados.sanidade.status, STATUS_SANIDADE.EM_DIA);
  assert.equal(dados.suplementacao.temRegistro, true);
  assert.ok(dados.insights.length > 0);
});
