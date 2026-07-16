import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularQuantidadeTotalEstoque,
  calcularCustoTotalProduto,
  calcularCustoPorUnidadeControle,
  calcularResumoProdutoNutricional,
  calcularCustoConsumo,
  formatarRotuloEmbalagem,
  rotuloCustoPorEmbalagem,
  resolverCustoPorEmbalagemParaEdicao,
} from './custoProdutoNutricional.js';

// Caso 1: 3 sacos de 50kg a R$50/saco -> 150kg, R$150 total, R$1/kg.
// Este é o cenário do bug original: o cálculo antigo dava R$7.500
// (150kg x R$50) em vez de R$150 (3 sacos x R$50).
test('caso 1: 3 sacos de 50kg a R$50/saco', () => {
  const r = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: 3,
    conteudoPorEmbalagem: 50,
    custoPorEmbalagem: 50,
  });
  assert.equal(r.quantidadeTotalEstoque, 150);
  assert.equal(r.custoTotal, 150);
  assert.equal(r.custoPorUnidadeControle, 1);
});

// Caso 2: 10 sacos de 30kg a R$120/saco -> 300kg, R$1.200, R$4/kg.
test('caso 2: 10 sacos de 30kg a R$120/saco', () => {
  const r = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: 10,
    conteudoPorEmbalagem: 30,
    custoPorEmbalagem: 120,
  });
  assert.equal(r.quantidadeTotalEstoque, 300);
  assert.equal(r.custoTotal, 1200);
  assert.equal(r.custoPorUnidadeControle, 4);
});

// Caso 3: 5 unidades (conteúdo 1 unidade cada) a R$25/unidade -> 5, R$125, R$25/unidade.
test('caso 3: 5 unidades a R$25/unidade', () => {
  const r = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: 5,
    conteudoPorEmbalagem: 1,
    custoPorEmbalagem: 25,
  });
  assert.equal(r.quantidadeTotalEstoque, 5);
  assert.equal(r.custoTotal, 125);
  assert.equal(r.custoPorUnidadeControle, 25);
});

// Caso 4: consumo de 20kg do produto do caso 1 (R$1/kg) -> custo R$20, saldo 130kg.
test('caso 4: consumo de 20kg do produto do caso 1', () => {
  const produto = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: 3,
    conteudoPorEmbalagem: 50,
    custoPorEmbalagem: 50,
  });
  const custoConsumo = calcularCustoConsumo({
    quantidadeConsumida: 20,
    custoPorUnidadeControle: produto.custoPorUnidadeControle,
  });
  const saldo = produto.quantidadeTotalEstoque - 20;

  assert.equal(custoConsumo, 20);
  assert.notEqual(custoConsumo, 1000); // não pode repetir o bug antigo (20 x R$50)
  assert.equal(saldo, 130);
});

// Caso 5: edição de produto já normalizado — o custo por embalagem salvo em
// metadata reaparece direto no campo (não é re-derivado de valor_unitario),
// e recalcular com os mesmos dados não altera os totais.
test('caso 5: edição de produto já normalizado', () => {
  const itemNormalizado = {
    valor_unitario: 1, // custo por unidade de controle (kg), já normalizado
    metadata: {
      modulo: 'nutricao',
      tipo_embalagem: 'saco',
      quantidade_embalagens: 3,
      conteudo_por_embalagem: 50,
      unidade_conteudo: 'kg',
      custo_por_embalagem: 50,
      custo_total: 150,
    },
  };

  const custoPorEmbalagem = resolverCustoPorEmbalagemParaEdicao(itemNormalizado);
  assert.equal(custoPorEmbalagem, 50);

  const recalculado = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: itemNormalizado.metadata.quantidade_embalagens,
    conteudoPorEmbalagem: itemNormalizado.metadata.conteudo_por_embalagem,
    custoPorEmbalagem,
  });
  assert.equal(recalculado.quantidadeTotalEstoque, 150);
  assert.equal(recalculado.custoTotal, 150);
  assert.equal(recalculado.custoPorUnidadeControle, 1);
});

// Caso 6: compatibilidade com registro nutricional legado (formulário antigo
// gravava o custo por embalagem direto em valor_unitario, sem metadata
// dedicada). O valor antigo deve aparecer como custo por embalagem no
// formulário; ao salvar de novo, passa a ser normalizado.
test('caso 6: compatibilidade com registro nutricional legado', () => {
  const itemLegado = {
    valor_unitario: 50, // valor antigo: era o custo por saco, salvo como se fosse "unitário"
    metadata: {
      modulo: 'nutricao',
      tipo_embalagem: 'saco',
      conteudo_por_embalagem: 50,
      unidade_conteudo: 'kg',
      // sem custo_por_embalagem: marcador de registro do formulário antigo
    },
  };

  const custoPorEmbalagemResolvido = resolverCustoPorEmbalagemParaEdicao(itemLegado);
  assert.equal(custoPorEmbalagemResolvido, 50);

  // Ao salvar novamente (3 sacos, mesma proporção do exemplo do bug):
  const normalizado = calcularResumoProdutoNutricional({
    quantidadeEmbalagens: 3,
    conteudoPorEmbalagem: itemLegado.metadata.conteudo_por_embalagem,
    custoPorEmbalagem: custoPorEmbalagemResolvido,
  });
  assert.equal(normalizado.custoTotal, 150);
  assert.equal(normalizado.custoPorUnidadeControle, 1); // novo valor_unitario

  const metadataNormalizada = {
    ...itemLegado.metadata,
    custo_por_embalagem: custoPorEmbalagemResolvido,
    custo_total: normalizado.custoTotal,
  };
  assert.equal(metadataNormalizada.custo_por_embalagem, 50);
  assert.equal(metadataNormalizada.custo_total, 150);
});

test('não assume custo por embalagem em item sem os marcadores do formulário nutricional', () => {
  const itemGenerico = { valor_unitario: 50, metadata: {} };
  assert.equal(resolverCustoPorEmbalagemParaEdicao(itemGenerico), 0);

  const itemSemTipoEmbalagem = { valor_unitario: 50, metadata: { modulo: 'nutricao' } };
  assert.equal(resolverCustoPorEmbalagemParaEdicao(itemSemTipoEmbalagem), 0);
});

test('calcularQuantidadeTotalEstoque, calcularCustoTotalProduto e calcularCustoPorUnidadeControle isoladas', () => {
  assert.equal(calcularQuantidadeTotalEstoque({ quantidadeEmbalagens: 3, conteudoPorEmbalagem: 50 }), 150);
  assert.equal(calcularCustoTotalProduto({ quantidadeEmbalagens: 3, custoPorEmbalagem: 50 }), 150);
  assert.equal(calcularCustoPorUnidadeControle({ quantidadeTotalEstoque: 150, custoTotal: 150 }), 1);
  assert.equal(calcularCustoPorUnidadeControle({ quantidadeTotalEstoque: 0, custoTotal: 150 }), 0);
});

test('formatarRotuloEmbalagem: singular e plural', () => {
  assert.equal(formatarRotuloEmbalagem('saco', 1), 'saco');
  assert.equal(formatarRotuloEmbalagem('saco', 3), 'sacos');
  assert.equal(formatarRotuloEmbalagem('unidade', 1), 'unidade');
  assert.equal(formatarRotuloEmbalagem('unidade', 2), 'unidades');
  assert.equal(formatarRotuloEmbalagem('bag', 2), 'bags');
  assert.equal(formatarRotuloEmbalagem('outro', 2), 'outros');
});

test('rotuloCustoPorEmbalagem: rótulo dinâmico por tipo', () => {
  assert.equal(rotuloCustoPorEmbalagem('saco'), 'Custo por saco (R$)');
  assert.equal(rotuloCustoPorEmbalagem('bag'), 'Custo por bag (R$)');
  assert.equal(rotuloCustoPorEmbalagem('unidade'), 'Custo por unidade (R$)');
  assert.equal(rotuloCustoPorEmbalagem('tonelada'), 'Custo por tonelada (R$)');
  assert.equal(rotuloCustoPorEmbalagem('outro'), 'Custo por embalagem (R$)');
});
