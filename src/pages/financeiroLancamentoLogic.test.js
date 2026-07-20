import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverFazendaIdLancamento, isLancamentoManual, getOrigemLabel, podeEstornar, possuiEstornoRegistrado, construirLancamentoEstorno } from './financeiroLancamentoLogic.js';

test('usa a fazenda do lote quando um lote é escolhido, mesmo em modo consolidado', () => {
  const loteEscolhido = { id: 5, faz_id: 42 };
  const fazendaSelecionada = { id: null, todas: true };
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido, fazendaSelecionada }), 42);
});

test('cai para a fazenda ativa quando não há lote escolhido', () => {
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido: null, fazendaSelecionada: { id: 7 } }), 7);
});

test('devolve null (bloqueia) sem lote e em modo consolidado', () => {
  assert.equal(resolverFazendaIdLancamento({ loteEscolhido: null, fazendaSelecionada: { id: null, todas: true } }), null);
});

test('devolve null sem lote e sem fazenda selecionada', () => {
  assert.equal(resolverFazendaIdLancamento({}), null);
});

// ── isLancamentoManual / getOrigemLabel (Onda A — UX-FN1) ───────────────────

test('isLancamentoManual: lançamento criado pelo usuário (sem origem_tipo nem origem) é manual', () => {
  assert.equal(isLancamentoManual({ id: 1, tipo: 'despesa', categoria: 'Frete' }), true);
});

test('isLancamentoManual: lançamento com origem_tipo (movimentacoes.js/consumoSuplementacao) não é manual', () => {
  assert.equal(isLancamentoManual({ id: 1, origem_tipo: 'movimentacao_animal', origem_id: 5 }), false);
});

test('isLancamentoManual: lançamento com origem (convenção antiga do CustosPage) não é manual', () => {
  assert.equal(isLancamentoManual({ id: 1, origem: 'custo', origem_id: 5 }), false);
});

test('getOrigemLabel: null para lançamento manual', () => {
  assert.equal(getOrigemLabel({ id: 1 }), null);
});

test('getOrigemLabel: rótulo amigável para origem_tipo conhecido', () => {
  assert.equal(getOrigemLabel({ origem_tipo: 'movimentacao_animal' }), 'Venda/saída de animal');
  assert.equal(getOrigemLabel({ origem: 'custo' }), 'Custo operacional');
  assert.equal(getOrigemLabel({ origem_tipo: 'estorno' }), 'Estorno');
});

test('getOrigemLabel: cai para o valor bruto quando a origem não está mapeada', () => {
  assert.equal(getOrigemLabel({ origem_tipo: 'algo_novo' }), 'algo_novo');
});

// ── podeEstornar / construirLancamentoEstorno (Onda A — UX-FN1) ─────────────

test('podeEstornar: lançamento nunca estornado pode ser estornado', () => {
  assert.equal(podeEstornar({ id: 1, valor: 100 }), true);
});

test('podeEstornar: lançamento já estornado bloqueia um segundo estorno', () => {
  assert.equal(podeEstornar({ id: 1, valor: 100, estornado_em: '2026-07-20T10:00:00.000Z' }), false);
});

test('construirLancamentoEstorno: exige motivo (lança erro sem motivo)', () => {
  const item = { id: 10, tipo: 'receita', categoria: 'Venda Animal', valor: 3000, lote_id: 5 };
  assert.throws(() => construirLancamentoEstorno(item, ''), /motivo/i);
  assert.throws(() => construirLancamentoEstorno(item, '   '), /motivo/i);
});

test('construirLancamentoEstorno: inverte o tipo (receita→despesa) preservando o valor, para neutralizar no DRE', () => {
  const item = { id: 10, tipo: 'receita', categoria: 'Venda Animal', valor: 3000, lote_id: 5 };
  const estorno = construirLancamentoEstorno(item, 'venda cancelada', { dataHoje: '2026-07-20' });
  assert.equal(estorno.tipo, 'despesa');
  assert.equal(estorno.valor, 3000);
});

test('construirLancamentoEstorno: despesa vira receita no estorno', () => {
  const item = { id: 11, tipo: 'despesa', categoria: 'Frete', valor: 500 };
  const estorno = construirLancamentoEstorno(item, 'frete cobrado a mais', { dataHoje: '2026-07-20' });
  assert.equal(estorno.tipo, 'receita');
});

test('construirLancamentoEstorno: vincula ao original via origem_tipo/origem_id e guarda o motivo na observação', () => {
  const item = { id: 10, tipo: 'receita', categoria: 'Venda Animal', valor: 3000, lote_id: 5, fazenda_id: 2 };
  const estorno = construirLancamentoEstorno(item, 'venda cancelada pelo comprador', { dataHoje: '2026-07-20' });
  assert.equal(estorno.origem_tipo, 'estorno');
  assert.equal(estorno.origem_id, 10);
  assert.match(estorno.observacao, /venda cancelada pelo comprador/);
  assert.match(estorno.observacao, /#10/);
});

test('construirLancamentoEstorno: herda lote_id e fazenda_id do lançamento original', () => {
  const item = { id: 10, tipo: 'receita', categoria: 'Venda Animal', valor: 3000, lote_id: 5, fazenda_id: 2 };
  const estorno = construirLancamentoEstorno(item, 'motivo qualquer', { dataHoje: '2026-07-20' });
  assert.equal(estorno.lote_id, 5);
  assert.equal(estorno.fazenda_id, 2);
});

test('construirLancamentoEstorno: usa a data de hoje informada, não a data do lançamento original', () => {
  const item = { id: 10, tipo: 'receita', categoria: 'Venda Animal', valor: 3000, data: '2026-06-01' };
  const estorno = construirLancamentoEstorno(item, 'motivo', { dataHoje: '2026-07-20' });
  assert.equal(estorno.data, '2026-07-20');
  assert.equal(estorno.data_competencia, '2026-07-20');
});

// ── possuiEstornoRegistrado (2ª trava contra estorno duplicado) ─────────────

test('possuiEstornoRegistrado: falso quando não existe nenhum lançamento de estorno vinculado', () => {
  const movimentacoes = [{ id: 1, tipo: 'receita' }, { id: 2, tipo: 'despesa' }];
  assert.equal(possuiEstornoRegistrado(movimentacoes, 1), false);
});

test('possuiEstornoRegistrado: verdadeiro quando já existe origem_tipo=estorno apontando para o id', () => {
  const movimentacoes = [
    { id: 1, tipo: 'receita' },
    { id: 2, tipo: 'despesa', origem_tipo: 'estorno', origem_id: 1 },
  ];
  assert.equal(possuiEstornoRegistrado(movimentacoes, 1), true);
});

test('possuiEstornoRegistrado: não confunde estorno de OUTRO lançamento', () => {
  const movimentacoes = [
    { id: 1, tipo: 'receita' },
    { id: 2, tipo: 'despesa', origem_tipo: 'estorno', origem_id: 99 },
  ];
  assert.equal(possuiEstornoRegistrado(movimentacoes, 1), false);
});

test('possuiEstornoRegistrado: tolerante a lista vazia/nula', () => {
  assert.equal(possuiEstornoRegistrado([], 1), false);
  assert.equal(possuiEstornoRegistrado(null, 1), false);
});
