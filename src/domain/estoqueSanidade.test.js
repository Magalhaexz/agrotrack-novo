import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterSaldoAtualItemEstoque,
  calcularBaixaSanitaria,
  validarBaixaEstoqueSanidade,
  montarMovimentacaoEstoqueSanidade,
  aplicarBaixaAoSaldo,
  MOTIVO_BLOQUEIO,
  MOTIVO_NAO_BAIXA,
} from './estoqueSanidade.js';

// ── obterSaldoAtualItemEstoque ──────────────────────────────────────────────

test('obterSaldoAtualItemEstoque prioriza quantidade_atual sobre quantidade', () => {
  assert.equal(obterSaldoAtualItemEstoque({ quantidade_atual: 10, quantidade: 99 }), 10);
});

test('obterSaldoAtualItemEstoque cai para quantidade quando quantidade_atual ausente', () => {
  assert.equal(obterSaldoAtualItemEstoque({ quantidade: 7 }), 7);
});

test('obterSaldoAtualItemEstoque retorna 0 para item nulo/vazio', () => {
  assert.equal(obterSaldoAtualItemEstoque(null), 0);
  assert.equal(obterSaldoAtualItemEstoque({}), 0);
});

// ── calcularBaixaSanitaria ───────────────────────────────────────────────────

test('calcularBaixaSanitaria: aplicação nova com saldo suficiente', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 5, quantidadeAnterior: 0, saldoAtual: 20 });
  assert.equal(r.quantidadeBaixar, 5);
  assert.equal(r.saldoProjetado, 15);
  assert.equal(r.podeBaixar, true);
  assert.equal(r.motivoBloqueio, null);
  assert.equal(r.ajusteNecessario, false);
});

test('calcularBaixaSanitaria: saldo insuficiente bloqueia sem alterar saldo projetado', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 30, quantidadeAnterior: 0, saldoAtual: 20 });
  assert.equal(r.podeBaixar, false);
  assert.equal(r.motivoBloqueio, MOTIVO_BLOQUEIO.SALDO_INSUFICIENTE);
  assert.equal(r.saldoProjetado, 20); // não aplica a baixa quando bloqueado
});

test('calcularBaixaSanitaria: saldo zero bloqueia qualquer consumo novo', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 1, quantidadeAnterior: 0, saldoAtual: 0 });
  assert.equal(r.podeBaixar, false);
  assert.equal(r.motivoBloqueio, MOTIVO_BLOQUEIO.SALDO_INSUFICIENTE);
});

test('calcularBaixaSanitaria: edição aumentando quantidade baixa só a diferença', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 5, quantidadeAnterior: 2, saldoAtual: 20 });
  assert.equal(r.quantidadeBaixar, 3);
  assert.equal(r.saldoProjetado, 17);
});

test('calcularBaixaSanitaria: edição reduzindo quantidade devolve a diferença e nunca bloqueia', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 2, quantidadeAnterior: 5, saldoAtual: 3 });
  assert.equal(r.quantidadeBaixar, -3);
  assert.equal(r.saldoProjetado, 6);
  assert.equal(r.podeBaixar, true);
  assert.equal(r.ajusteNecessario, true);
});

test('calcularBaixaSanitaria: edição sem mudar quantidade não movimenta estoque', () => {
  const r = calcularBaixaSanitaria({ quantidadeAplicada: 4, quantidadeAnterior: 4, saldoAtual: 10 });
  assert.equal(r.quantidadeBaixar, 0);
  assert.equal(r.saldoProjetado, 10);
  assert.equal(r.ajusteNecessario, false);
});

test('calcularBaixaSanitaria: quantidade/rendimento inválidos ou nulos nunca quebram nem geram NaN/Infinity', () => {
  const casos = [
    { quantidadeAplicada: null, quantidadeAnterior: undefined, saldoAtual: 'abc' },
    { quantidadeAplicada: -5, quantidadeAnterior: -2, saldoAtual: -10 },
    { quantidadeAplicada: NaN, quantidadeAnterior: NaN, saldoAtual: NaN },
    {},
  ];
  casos.forEach((caso) => {
    const r = calcularBaixaSanitaria(caso);
    assert.ok(Number.isFinite(r.quantidadeBaixar));
    assert.ok(Number.isFinite(r.saldoProjetado));
  });
});

// ── validarBaixaEstoqueSanidade ──────────────────────────────────────────────

test('validarBaixaEstoqueSanidade: sem produto vinculado nunca baixa estoque', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: null, quantidadeAplicada: 10, saldoAtual: 20 });
  assert.equal(r.deveBaixar, false);
  assert.equal(r.motivo, MOTIVO_NAO_BAIXA.SEM_PRODUTO);
});

test('validarBaixaEstoqueSanidade: produto vinculado sem quantidade não baixa estoque', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: 7, quantidadeAplicada: 0, saldoAtual: 20 });
  assert.equal(r.deveBaixar, false);
  assert.equal(r.motivo, MOTIVO_NAO_BAIXA.SEM_QUANTIDADE);
});

test('validarBaixaEstoqueSanidade: produto e quantidade válidos com saldo suficiente baixa', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: 7, quantidadeAplicada: 5, saldoAtual: 20 });
  assert.equal(r.deveBaixar, true);
  assert.equal(r.podeBaixar, true);
  assert.equal(r.quantidadeBaixar, 5);
});

test('validarBaixaEstoqueSanidade: saldo insuficiente sinaliza bloqueio, não falta de produto/quantidade', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: 7, quantidadeAplicada: 50, saldoAtual: 3 });
  assert.equal(r.deveBaixar, true);
  assert.equal(r.podeBaixar, false);
  assert.equal(r.motivoBloqueio, MOTIVO_BLOQUEIO.SALDO_INSUFICIENTE);
});

test('validarBaixaEstoqueSanidade: edição sem alteração de quantidade não baixa (motivo distinto de "sem produto novo")', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: 7, quantidadeAplicada: 4, quantidadeAnterior: 4, saldoAtual: 10 });
  assert.equal(r.deveBaixar, false);
  assert.equal(r.motivo, MOTIVO_NAO_BAIXA.SEM_ALTERACAO);
});

test('validarBaixaEstoqueSanidade: remover produto (produtoId null) na edição não baixa, mesmo com quantidadeAnterior', () => {
  const r = validarBaixaEstoqueSanidade({ produtoId: null, quantidadeAplicada: 0, quantidadeAnterior: 5, saldoAtual: 10 });
  assert.equal(r.deveBaixar, false);
  assert.equal(r.motivo, MOTIVO_NAO_BAIXA.SEM_PRODUTO);
});

// ── montarMovimentacaoEstoqueSanidade ────────────────────────────────────────

test('montarMovimentacaoEstoqueSanidade: consumo (quantidade positiva) monta tipo consumo com origem sanidade', () => {
  const mov = montarMovimentacaoEstoqueSanidade({ sanitarioId: 42, produtoId: 7, loteId: 3, quantidade: 5, data: '2026-07-08' });
  assert.equal(mov.tipo, 'consumo');
  assert.equal(mov.quantidade, 5);
  assert.equal(mov.item_estoque_id, 7);
  assert.equal(mov.lote_id, 3);
  assert.equal(mov.origem, 'sanidade');
  assert.equal(mov.origem_tipo, 'sanitario');
  assert.equal(mov.origem_id, 42);
});

test('montarMovimentacaoEstoqueSanidade: devolução (quantidade negativa) monta tipo ajuste com magnitude positiva', () => {
  const mov = montarMovimentacaoEstoqueSanidade({ sanitarioId: 42, produtoId: 7, loteId: 3, quantidade: -2, data: '2026-07-08' });
  assert.equal(mov.tipo, 'ajuste');
  assert.equal(mov.quantidade, 2);
  assert.match(mov.obs, /Devolução/);
});

// ── aplicarBaixaAoSaldo ──────────────────────────────────────────────────────

test('aplicarBaixaAoSaldo consome do saldo (quantidadeBaixar positiva)', () => {
  assert.equal(aplicarBaixaAoSaldo(20, 5), 15);
});

test('aplicarBaixaAoSaldo devolve ao saldo (quantidadeBaixar negativa)', () => {
  assert.equal(aplicarBaixaAoSaldo(15, -5), 20);
});

test('aplicarBaixaAoSaldo nunca retorna negativo nem NaN', () => {
  assert.equal(aplicarBaixaAoSaldo(3, 100), 0);
  assert.equal(aplicarBaixaAoSaldo(null, null), 0);
  assert.equal(aplicarBaixaAoSaldo('abc', 'xyz'), 0);
});
