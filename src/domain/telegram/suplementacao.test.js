import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararPlanejamentoSuplementacao, prepararConsumoSuplementacao } from './suplementacao.js';

function db() {
  return {
    lotes: [
      { id: 1, nome: 'Recria', status: 'ativo', qtd: 30, p_at: 380, supl_meta_dias: 30 },
      { id: 2, nome: 'Encerrado', status: 'encerrado' },
    ],
    estoque: [{ id: 50, produto: 'Sal Proteinado', quantidade_atual: 200, valor_unitario: 3 }],
  };
}

test('planejamento não baixa estoque, só atualiza o lote', () => {
  const r = prepararPlanejamentoSuplementacao(db(), { lote: 'Recria', produto: 'Ração', quantidade_por_cabeca: 2, periodo_dias: 30 });
  assert.equal(r.ok, true);
  assert.equal(r.writes.length, 1);
  assert.equal(r.writes[0].tabela, 'lotes');
  assert.equal(r.writes[0].patch.supl_nome, 'Ração');
  assert.equal(r.writes[0].patch.consumo_por_cabeca_dia, 2);
  assert.equal(r.writes[0].patch.supl_meta_dias, 30);
});

test('planejamento usa supl_meta_dias do lote quando período não é informado', () => {
  const r = prepararPlanejamentoSuplementacao(db(), { lote: 'Recria', produto: 'Ração', quantidade_por_cabeca: 2 });
  assert.equal(r.writes[0].patch.supl_meta_dias, 30);
});

test('planejamento rejeita produto vazio, quantidade inválida e lote inexistente/bloqueado', () => {
  assert.equal(prepararPlanejamentoSuplementacao(db(), { lote: 'Recria', produto: '', quantidade_por_cabeca: 2 }).erro, 'PRODUTO_VAZIO');
  assert.equal(prepararPlanejamentoSuplementacao(db(), { lote: 'Recria', produto: 'X', quantidade_por_cabeca: 0 }).erro, 'QUANTIDADE_INVALIDA');
  assert.equal(prepararPlanejamentoSuplementacao(db(), { lote: 'Inexistente', produto: 'X', quantidade_por_cabeca: 2 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararPlanejamentoSuplementacao(db(), { lote: 'Encerrado', produto: 'X', quantidade_por_cabeca: 2 }).erro, 'LOTE_NAO_ENCONTRADO');
});

test('consumo realizado baixa estoque e gera despesa', () => {
  const r = prepararConsumoSuplementacao(db(), { lote: 'Recria', produto: 'Sal', quantidade: 80, data: '2026-07-15' }, { fazendaId: 1 });
  assert.equal(r.ok, true);
  const consumo = r.writes.find((w) => w.tabela === 'consumo_suplementacao');
  assert.equal(consumo.registro.lote_id, 1);
  assert.equal(consumo.registro.quantidade_total, 80);
  assert.equal(consumo.registro.qtd_total, 80);
  assert.equal(consumo.registro.custo_total, 240);
  assert.equal(consumo.registro.fazenda_id, 1);
  const estoqueUpdate = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(estoqueUpdate.patch.quantidade_atual, 120);
  const financeiro = r.writes.find((w) => w.tabela === 'movimentacoes_financeiras');
  assert.equal(financeiro.registro.tipo, 'despesa');
  assert.equal(financeiro.registro.categoria, 'nutricao');
  assert.equal(financeiro.registro.valor, 240);
});

test('consumo rejeita saldo insuficiente', () => {
  const r = prepararConsumoSuplementacao(db(), { lote: 'Recria', produto: 'Sal', quantidade: 999 });
  assert.equal(r.erro, 'SALDO_INSUFICIENTE');
});

test('consumo rejeita produto/lote inexistente e quantidade inválida', () => {
  assert.equal(prepararConsumoSuplementacao(db(), { lote: 'Recria', produto: 'Inexistente', quantidade: 10 }).erro, 'ITEM_NAO_ENCONTRADO');
  assert.equal(prepararConsumoSuplementacao(db(), { lote: 'Inexistente', produto: 'Sal', quantidade: 10 }).erro, 'LOTE_NAO_ENCONTRADO');
  assert.equal(prepararConsumoSuplementacao(db(), { lote: 'Recria', produto: 'Sal', quantidade: 0 }).erro, 'QUANTIDADE_INVALIDA');
});
