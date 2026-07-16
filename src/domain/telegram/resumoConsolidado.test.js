import test from 'node:test';
import assert from 'node:assert/strict';
import { construirResumoConsolidadoFazendas, formatarResumoConsolidadoFazendas } from './resumoConsolidado.js';

function dbConta() {
  return {
    fazendas: [{ id: 1, nome: 'Fazenda Um' }, { id: 2, nome: 'Fazenda Dois' }],
    lotes: [
      { id: 10, nome: 'Recria', faz_id: 1, status: 'ativo', qtd: 30 },
      { id: 11, nome: 'Confinamento', faz_id: 1, status: 'encerrado', qtd: 5 },
      { id: 20, nome: 'Engorda', faz_id: 2, status: 'ativo', qtd: 12 },
    ],
    animais: [],
    estoque: [{ id: 1, fazenda_id: 1, produto: 'Sal' }],
    movimentacoes_financeiras: [
      { id: 1, fazenda_id: 1, tipo: 'despesa', valor: 200 },
      { id: 2, fazenda_id: 1, tipo: 'receita', valor: 500 },
      { id: 3, fazenda_id: 2, tipo: 'despesa', valor: 50 },
    ],
    alertas_tratativas: [],
  };
}

test('agrega lotes ativos, cabeças e financeiro por fazenda, sem misturar contas', () => {
  const resumos = construirResumoConsolidadoFazendas(dbConta());
  assert.equal(resumos.length, 2);

  const um = resumos.find((r) => r.nome === 'Fazenda Um');
  assert.equal(um.totalLotes, 1); // só o ativo — o encerrado não conta
  assert.equal(um.totalCabecas, 30);
  assert.equal(um.totalItensEstoque, 1);
  assert.equal(um.custos, 200);
  assert.equal(um.receitas, 500);

  const dois = resumos.find((r) => r.nome === 'Fazenda Dois');
  assert.equal(dois.totalLotes, 1);
  assert.equal(dois.totalCabecas, 12);
  assert.equal(dois.totalItensEstoque, 0);
  assert.equal(dois.custos, 50);
  assert.equal(dois.receitas, 0);
});

test('formata texto com uma seção por fazenda', () => {
  const texto = formatarResumoConsolidadoFazendas(dbConta());
  assert.match(texto, /Fazenda Um/);
  assert.match(texto, /Fazenda Dois/);
  assert.match(texto, /Lotes: 1/);
  assert.match(texto, /Cabeças: 30/);
  assert.match(texto, /R\$ 200,00/);
});

test('sem fazendas cadastradas devolve mensagem vazia amigável', () => {
  assert.equal(formatarResumoConsolidadoFazendas({ fazendas: [] }), 'Nenhuma fazenda cadastrada.');
  assert.deepEqual(construirResumoConsolidadoFazendas({ fazendas: [] }), []);
});
