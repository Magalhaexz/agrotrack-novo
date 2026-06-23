import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularArrobasEstimadas,
  calcularCustoPorArroba,
  calcularPontoEquilibrioArroba,
  simularVendaHoje,
  simularManterLote,
  compararVenderOuManter,
  classificarDecisaoVenda,
  gerarInsightVenda,
  montarDadosDecisaoVenda,
  STATUS_DECISAO,
} from './decisaoVenda.js';

test('calcularArrobasEstimadas usa qtd x peso x rendimento / 15', () => {
  // 10 cabeças, 480kg, 52% rendimento -> (10 * 480 * 0.52) / 15 = 166.4
  const arrobas = calcularArrobasEstimadas({ qtdCabecas: 10, peso: 480, rendimentoCarcaca: 52 });
  assert.ok(Math.abs(arrobas - 166.4) < 0.01);
});

test('calcularArrobasEstimadas não quebra com dados nulos', () => {
  assert.equal(calcularArrobasEstimadas(), 0);
  assert.equal(calcularArrobasEstimadas({ qtdCabecas: null, peso: undefined }), 0);
});

test('calcularCustoPorArroba divide custo total pelas arrobas', () => {
  assert.equal(calcularCustoPorArroba({ custoTotal: 16640, arrobas: 166.4 }), 100);
});

test('calcularCustoPorArroba retorna 0 sem arrobas (evita divisão por zero)', () => {
  assert.equal(calcularCustoPorArroba({ custoTotal: 1000, arrobas: 0 }), 0);
});

test('calcularPontoEquilibrioArroba é o preço mínimo para não ter prejuízo', () => {
  assert.equal(calcularPontoEquilibrioArroba({ custoTotal: 16640, arrobas: 166.4 }), 100);
});

test('simularVendaHoje calcula receita, custo e lucro a partir de dados', () => {
  const resultado = simularVendaHoje({ arrobas: 166.4, precoArroba: 270, custoTotal: 16640 });
  assert.ok(Math.abs(resultado.receita - 44928) < 0.01);
  assert.equal(resultado.custo, 16640);
  assert.ok(Math.abs(resultado.lucro - 28288) < 0.01);
});

test('simularVendaHoje usa preço padrão quando não informado', () => {
  const resultado = simularVendaHoje({ arrobas: 100, custoTotal: 10000 });
  assert.equal(resultado.precoArroba, 270);
});

test('simularManterLote projeta peso, custo adicional e lucro com GMD e custo diário', () => {
  const dados = {
    qtdCabecas: 10,
    pesoAtual: 480,
    rendimentoCarcaca: 52,
    custoTotal: 16640,
    precoArroba: 270,
  };
  const manter = simularManterLote(dados, { diasAdicionais: 30, gmdEsperado: 1.2, custoDiarioPorCabeca: 8 });

  assert.equal(manter.pesoProjetado, 480 + 1.2 * 30);
  assert.equal(manter.custoAdicional, 8 * 10 * 30);
  assert.ok(manter.arrobasProjetadas > calcularArrobasEstimadas({ qtdCabecas: 10, peso: 480, rendimentoCarcaca: 52 }));
  assert.equal(manter.custoProjetado, 16640 + 2400);
});

test('simularManterLote com 0 dias adicionais não muda peso nem custo', () => {
  const dados = { qtdCabecas: 10, pesoAtual: 480, rendimentoCarcaca: 52, custoTotal: 16640, precoArroba: 270 };
  const manter = simularManterLote(dados, { diasAdicionais: 0, gmdEsperado: 1.2, custoDiarioPorCabeca: 8 });
  assert.equal(manter.pesoProjetado, 480);
  assert.equal(manter.custoAdicional, 0);
});

test('compararVenderOuManter calcula a diferença entre os dois cenários e recomenda o maior lucro', () => {
  const dados = { qtdCabecas: 10, pesoAtual: 480, rendimentoCarcaca: 52, custoTotal: 16640, arrobas: 166.4, precoArroba: 270 };
  const comparacao = compararVenderOuManter(dados, { diasAdicionais: 30, gmdEsperado: 1.2, custoDiarioPorCabeca: 8 });

  assert.equal(comparacao.diferenca, comparacao.manter.lucroProjetado - comparacao.vendaHoje.lucro);
  assert.ok(['manter', 'vender', 'indiferente'].includes(comparacao.recomendacao));
  assert.match(comparacao.aviso, /Simulação estimada/);
});

test('classificarDecisaoVenda retorna dados insuficientes sem peso/quantidade/custo', () => {
  const resultado = classificarDecisaoVenda({});
  assert.equal(resultado.status, STATUS_DECISAO.DADOS_INSUFICIENTES);
  assert.match(resultado.mensagem, /faltam dados/i);
});

test('classificarDecisaoVenda não quebra com dados nulos', () => {
  const resultado = classificarDecisaoVenda();
  assert.equal(resultado.status, STATUS_DECISAO.DADOS_INSUFICIENTES);
});

test('classificarDecisaoVenda detecta GMD abaixo da meta', () => {
  const resultado = classificarDecisaoVenda({
    qtdCabecas: 10, pesoAtual: 480, arrobas: 166.4, custoTotal: 10000,
    gmdAtual: 0.8, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 60, lucroTotal: 5000, dias: 60,
  });
  assert.equal(resultado.status, STATUS_DECISAO.ABAIXO_META_GMD);
  assert.match(resultado.mensagem, /abaixo da meta/i);
});

test('classificarDecisaoVenda detecta custo alto por arroba', () => {
  const resultado = classificarDecisaoVenda({
    qtdCabecas: 10, pesoAtual: 480, arrobas: 166.4, custoTotal: 40000,
    gmdAtual: 1.4, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 250, lucroTotal: 5000, dias: 60,
  });
  assert.equal(resultado.status, STATUS_DECISAO.CUSTO_ALTO);
  assert.match(resultado.mensagem, /custo por arroba está alto/i);
});

test('classificarDecisaoVenda marca lote pronto para avaliação quando lucro positivo e dias suficientes', () => {
  const resultado = classificarDecisaoVenda({
    qtdCabecas: 10, pesoAtual: 480, arrobas: 166.4, custoTotal: 16640,
    gmdAtual: 1.4, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 100, lucroTotal: 28288, dias: 45,
  });
  assert.equal(resultado.status, STATUS_DECISAO.PRONTO_AVALIAR);
  assert.match(resultado.mensagem, /avaliar venda/i);
});

test('classificarDecisaoVenda recomenda acompanhar quando ainda não passou do mínimo de dias', () => {
  const resultado = classificarDecisaoVenda({
    qtdCabecas: 10, pesoAtual: 350, arrobas: 121.3, custoTotal: 5000,
    gmdAtual: 1.4, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 41, lucroTotal: 1000, dias: 10,
  });
  assert.equal(resultado.status, STATUS_DECISAO.ACOMPANHAR);
});

test('classificarDecisaoVenda nunca recomenda "vender agora" — só avaliar', () => {
  const resultado = classificarDecisaoVenda({
    qtdCabecas: 10, pesoAtual: 480, arrobas: 166.4, custoTotal: 16640,
    gmdAtual: 1.4, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 100, lucroTotal: 28288, dias: 45,
  });
  assert.doesNotMatch(resultado.mensagem, /vender agora|venda imediat/i);
});

test('gerarInsightVenda delega para a mensagem da classificação', () => {
  const dados = { qtdCabecas: 10, pesoAtual: 480, arrobas: 166.4, custoTotal: 16640, gmdAtual: 1.4, gmdMeta: 1.3, precoArroba: 270, custoPorArroba: 100, lucroTotal: 28288, dias: 45 };
  assert.equal(gerarInsightVenda(dados), classificarDecisaoVenda(dados).mensagem);
});

test('montarDadosDecisaoVenda reaproveita getResumoLote e não quebra com lote inexistente', () => {
  const db = { lotes: [], animais: [], movimentacoes_financeiras: [] };
  const dados = montarDadosDecisaoVenda(db, 999);
  assert.equal(dados.encontrado, false);
  assert.equal(classificarDecisaoVenda(dados).status, STATUS_DECISAO.DADOS_INSUFICIENTES);
});

test('montarDadosDecisaoVenda usa preço padrão de R$270 quando o lote não define preco_arroba', () => {
  const db = {
    lotes: [{ id: 1, nome: 'Lote 1', status: 'ativo' }],
    animais: [{ id: 1, lote_id: 1, qtd: 10, p_ini: 300, p_at: 480, data_entrada: '2026-01-01' }],
    movimentacoes_financeiras: [
      { id: 1, tipo: 'despesa', categoria: 'compra_animal', lote_id: 1, valor: 16640 },
    ],
  };
  const dados = montarDadosDecisaoVenda(db, 1);
  assert.equal(dados.precoArroba, 270);
  assert.ok(dados.arrobas > 0);
  assert.ok(dados.custoPorArroba > 0);
});
