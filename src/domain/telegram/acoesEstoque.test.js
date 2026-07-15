import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararSaidaEstoque } from './acoesEstoque.js';

const db = {
  estoque: [
    { id: 1, produto: 'Sal Mineral 90', quantidade_atual: 320, valor_unitario: 5, unidade: 'kg' },
    { id: 2, produto: 'Sal Proteinado', quantidade_atual: 40, valor_unitario: 8, unidade: 'kg' },
  ],
  lotes: [{ id: 7, nome: 'Recria 2026', status: 'ativo' }],
};

test('baixa simples decrementa o saldo e registra a movimentação', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 50 });
  assert.equal(r.ok, true);
  const mov = r.writes.find((w) => w.tabela === 'movimentacoes_estoque');
  const upd = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(mov.registro.tipo, 'consumo');
  assert.equal(mov.registro.quantidade, 50);
  assert.equal(upd.patch.quantidade_atual, 270);
});

test('item ambíguo por nome parcial pede desambiguação', () => {
  const r = prepararSaidaEstoque(db, { item: 'sal', quantidade: 10 });
  assert.equal(r.erro, 'ITEM_AMBIGUO');
  assert.equal(r.candidatos.length, 2);
});

test('item não encontrado', () => {
  const r = prepararSaidaEstoque(db, { item: 'Ivermectina', quantidade: 1 });
  assert.equal(r.erro, 'ITEM_NAO_ENCONTRADO');
});

test('quantidade inválida (zero/negativa) é rejeitada', () => {
  assert.equal(prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 0 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: -5 }).erro, 'QUANTIDADE_INVALIDA');
});

test('impede saldo negativo (saldo insuficiente)', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 9999 });
  assert.equal(r.erro, 'SALDO_INSUFICIENTE');
  assert.equal(r.saldoAtual, 320);
});

test('consumo vinculado a lote gera despesa rastreável', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 10, tipo: 'consumo', lote: 'Recria' });
  const fin = r.writes.find((w) => w.tabela === 'movimentacoes_financeiras');
  assert.ok(fin);
  assert.equal(fin.registro.tipo, 'despesa');
  assert.equal(fin.registro.categoria, 'consumo_estoque');
  assert.equal(fin.registro.lote_id, 7);
  assert.equal(fin.registro.valor, 50);
});

test('venda gera receita rastreável mesmo sem lote', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 10, tipo: 'venda' });
  const fin = r.writes.find((w) => w.tabela === 'movimentacoes_financeiras');
  assert.equal(fin.registro.tipo, 'receita');
  assert.equal(fin.registro.categoria, 'venda_estoque');
});

test('ajuste/perda sem lote não gera lançamento financeiro (fora das regras espelhadas)', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 10, tipo: 'ajuste' });
  assert.equal(r.writes.find((w) => w.tabela === 'movimentacoes_financeiras'), undefined);
});

test('tipo desconhecido cai em consumo (padrão seguro)', () => {
  const r = prepararSaidaEstoque(db, { item: 'Sal Mineral', quantidade: 10, tipo: 'sacanagem' });
  assert.equal(r.writes[0].registro.tipo, 'consumo');
});
