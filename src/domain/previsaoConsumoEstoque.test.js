import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDiasRestantesEstoque,
  calcularConsumoDiarioTotalPorProduto,
  classificarCoberturaEstoque,
  montarResumoCoberturaEstoque,
} from './previsaoConsumoEstoque.js';

test('1000 kg com consumo de 50 kg/dia dura 20 dias', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 1000, consumoDiario: 50 });
  assert.equal(r.diasRestantes, 20);
  assert.equal(r.status, 'ok');
  assert.equal(r.podeCalcular, true);
});

test('estoque zero: 0 dias, status sem_estoque', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 0, consumoDiario: 50 });
  assert.equal(r.diasRestantes, 0);
  assert.equal(r.status, 'sem_estoque');
});

test('estoque negativo tratado como zero', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: -10, consumoDiario: 50 });
  assert.equal(r.diasRestantes, 0);
  assert.equal(r.status, 'sem_estoque');
});

test('consumo zero: não calcula', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 1000, consumoDiario: 0 });
  assert.equal(r.diasRestantes, null);
  assert.equal(r.podeCalcular, false);
  assert.equal(r.status, 'sem_consumo_configurado');
});

test('consumo ausente (undefined): não calcula', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 1000, consumoDiario: undefined });
  assert.equal(r.podeCalcular, false);
  assert.equal(r.status, 'sem_consumo_configurado');
});

test('quantidade null tratada como zero', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: null, consumoDiario: 50 });
  assert.equal(r.diasRestantes, 0);
});

test('consumo null: não calcula', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 1000, consumoDiario: null });
  assert.equal(r.podeCalcular, false);
});

test('nunca retorna NaN ou Infinity', () => {
  const casos = [
    { quantidadeAtual: NaN, consumoDiario: 50 },
    { quantidadeAtual: 1000, consumoDiario: NaN },
    { quantidadeAtual: Infinity, consumoDiario: 50 },
    { quantidadeAtual: 1000, consumoDiario: -5 },
  ];
  casos.forEach((caso) => {
    const r = calcularDiasRestantesEstoque(caso);
    if (r.diasRestantes !== null) {
      assert.ok(Number.isFinite(r.diasRestantes), JSON.stringify(caso));
    }
  });
});

test('status crítico: <= 3 dias', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 30, consumoDiario: 10 });
  assert.equal(r.diasRestantes, 3);
  assert.equal(r.status, 'critico');
});

test('status atenção: <= 7 dias', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 70, consumoDiario: 10 });
  assert.equal(r.diasRestantes, 7);
  assert.equal(r.status, 'atencao');
});

test('status ok: > 7 dias', () => {
  const r = calcularDiasRestantesEstoque({ quantidadeAtual: 80, consumoDiario: 10 });
  assert.equal(r.diasRestantes, 8);
  assert.equal(r.status, 'ok');
});

test('classificarCoberturaEstoque cobre os limites', () => {
  assert.equal(classificarCoberturaEstoque(null), 'sem_consumo_configurado');
  assert.equal(classificarCoberturaEstoque(0), 'sem_estoque');
  assert.equal(classificarCoberturaEstoque(3), 'critico');
  assert.equal(classificarCoberturaEstoque(3.5), 'atencao');
  assert.equal(classificarCoberturaEstoque(7), 'atencao');
  assert.equal(classificarCoberturaEstoque(7.1), 'ok');
});

test('calcularConsumoDiarioTotalPorProduto soma múltiplos lotes consumindo o mesmo produto', () => {
  const lotes = [{ id: 1, qtd: 20 }, { id: 2, qtd: 30 }];
  const consumos = [
    { item_estoque_id: 9, lote_id: 1, modo: 'por_cabeca', consumo_por_cabeca_dia: 2 },
    { item_estoque_id: 9, lote_id: 2, modo: 'por_cabeca', consumo_por_cabeca_dia: 1.5 },
  ];
  const { consumoDiario, lotesConsiderados } = calcularConsumoDiarioTotalPorProduto({ produtoId: 9, lotes, consumos });
  // 20*2 + 30*1.5 = 40 + 45 = 85
  assert.equal(consumoDiario, 85);
  assert.deepEqual(lotesConsiderados.sort(), [1, 2]);
});

test('calcularConsumoDiarioTotalPorProduto ignora modo diferente de por_cabeca', () => {
  const lotes = [{ id: 1, qtd: 20 }];
  const consumos = [{ item_estoque_id: 9, lote_id: 1, modo: 'percentual_peso_vivo', consumo_por_cabeca_dia: 2 }];
  const { consumoDiario } = calcularConsumoDiarioTotalPorProduto({ produtoId: 9, lotes, consumos });
  assert.equal(consumoDiario, null);
});

test('calcularConsumoDiarioTotalPorProduto: produto sem consumo configurado', () => {
  const { consumoDiario, lotesConsiderados } = calcularConsumoDiarioTotalPorProduto({ produtoId: 999, lotes: [], consumos: [] });
  assert.equal(consumoDiario, null);
  assert.deepEqual(lotesConsiderados, []);
});

test('montarResumoCoberturaEstoque gera um item por produto do estoque', () => {
  const estoque = [
    { id: 9, produto: 'Ração', unidade: 'kg', quantidade_atual: 1000, fazenda_id: 1 },
    { id: 10, produto: 'Sal mineral', unidade: 'kg', quantidade_atual: 50, fazenda_id: 1 },
  ];
  const lotes = [{ id: 1, qtd: 20 }];
  const consumos = [{ item_estoque_id: 9, lote_id: 1, modo: 'por_cabeca', consumo_por_cabeca_dia: 2.5 }];

  const resumo = montarResumoCoberturaEstoque({ estoque, consumos, lotes });
  assert.equal(resumo.length, 2);

  const racao = resumo.find((r) => r.produtoId === 9);
  assert.equal(racao.consumoDiarioEstimado, 50); // 20 * 2.5
  assert.equal(racao.diasRestantes, 20); // 1000 / 50
  assert.equal(racao.status, 'ok');

  const sal = resumo.find((r) => r.produtoId === 10);
  assert.equal(sal.consumoDiarioEstimado, null);
  assert.equal(sal.status, 'sem_consumo_configurado');
});
