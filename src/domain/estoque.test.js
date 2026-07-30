import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEM_FAZENDA,
  obterSaldoItemEstoque,
  obterCustoUnitarioItem,
  calcularValorItemEstoque,
  calcularCustoMedioPonderado,
  validarEntradaEstoque,
  validarSaidaEstoque,
  consolidarEstoquePorFazenda,
  calcularValorTotalEstoque,
  deduplicarMovimentacoesEstoque,
  calcularConsumoDoLote,
  calcularConsumoPorCabeca,
  listarProdutosSemSaldo,
} from './estoque.js';
import { registrarEntradaEstoque, registrarSaidaEstoque } from '../services/movimentacoes.js';
import { obterSaldoAtualItemEstoque } from './estoqueSanidade.js';
import { prepararSaidaEstoque } from './telegram/acoesEstoque.js';

// Sprint 5/7 — Estoque e Consumo.
// Cenário das medições da matriz: sal mineral comprado 100 kg a R$ 2,00 e
// depois 100 kg a R$ 4,00. Dinheiro gasto: R$ 600,00. Custo médio: R$ 3,00.

const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

function dbEstoque({ quantidade_atual = 0, valor_unitario = 0, fazenda_id = 1 } = {}) {
  return {
    estoque: [{
      id: 1, produto: 'Sal mineral', unidade: 'kg', fazenda_id,
      quantidade_atual, quantidade: quantidade_atual, valor_unitario,
    }],
    movimentacoes_estoque: [],
    movimentacoes_financeiras: [],
    lotes: [{ id: 1, nome: 'Lote A', faz_id: 1, qtd: 20 }],
    animais: [],
  };
}

const semPersistir = [{}, { persist: false }];

// ── Entrada ─────────────────────────────────────────────────────────────────

test('entrada soma ao saldo e mantém as duas colunas de quantidade em sincronia', () => {
  const db = registrarEntradaEstoque(dbEstoque(), {
    itemId: 1, qtd: 100, custo: 2, data: '2026-01-01',
  }, ...semPersistir);
  const item = db.estoque[0];
  assert.equal(item.quantidade_atual, 100);
  assert.equal(item.quantidade, 100, 'o espelho legado não pode divergir da coluna real');
  assert.equal(item.valor_unitario, 2);
});

test('entrada cria movimentação e despesa de compra', () => {
  const db = registrarEntradaEstoque(dbEstoque(), {
    itemId: 1, qtd: 100, custo: 2, data: '2026-01-01',
  }, ...semPersistir);
  assert.equal(db.movimentacoes_estoque.length, 1);
  assert.equal(db.movimentacoes_estoque[0].tipo, 'entrada');
  assert.equal(db.movimentacoes_estoque[0].valor_total, 200);
  assert.equal(db.movimentacoes_financeiras[0].valor, 200);
});

// ── Entrada: custo ausente × custo zero explícito ───────────────────────────

test('entrada com custo AUSENTE é rejeitada — não pode derrubar a média em silêncio', () => {
  const db = dbEstoque({ quantidade_atual: 100, valor_unitario: 4 });
  for (const custoAusente of [undefined, null, '', '   ']) {
    assert.throws(
      () => registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: custoAusente, data: '2026-02-01' }, ...semPersistir),
      /Informe o custo unitário da entrada/,
      `custo ${JSON.stringify(custoAusente)} deveria ser rejeitado`
    );
  }
  assert.equal(db.estoque[0].valor_unitario, 4, 'média intocada');
  assert.equal(db.estoque[0].quantidade_atual, 100, 'saldo intocado');
});

test('entrada com custo ZERO explícito é aceita e baixa a média', () => {
  const db = registrarEntradaEstoque(
    dbEstoque({ quantidade_atual: 100, valor_unitario: 4 }),
    { itemId: 1, qtd: 100, custo: 0, data: '2026-02-01' },
    ...semPersistir
  );
  assert.equal(db.estoque[0].quantidade_atual, 200);
  assert.equal(db.estoque[0].valor_unitario, 2, 'doação/brinde realmente baixa a média');
});

test('custo zero informado como texto "0" também é aceito', () => {
  const db = registrarEntradaEstoque(
    dbEstoque({ quantidade_atual: 100, valor_unitario: 4 }),
    { itemId: 1, qtd: 100, custo: '0', data: '2026-02-01' },
    ...semPersistir
  );
  assert.equal(db.estoque[0].valor_unitario, 2);
});

test('custo não numérico é rejeitado, e não confundido com zero', () => {
  assert.throws(
    () => registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 10, custo: 'abc', data: '2026-02-01' }, ...semPersistir),
    /custo unitário válido/
  );
});

test('validarEntradaEstoque separa ausente, zero explícito, negativo e inválido', () => {
  assert.equal(validarEntradaEstoque({ quantidade: 10, custo: undefined }).ok, false);
  assert.match(validarEntradaEstoque({ quantidade: 10, custo: null }).erro, /digite 0/);

  const zero = validarEntradaEstoque({ quantidade: 10, custo: 0 });
  assert.equal(zero.ok, true);
  assert.equal(zero.custo, 0);

  assert.equal(validarEntradaEstoque({ quantidade: 10, custo: '0,00' }).ok, true);
  assert.equal(validarEntradaEstoque({ quantidade: 10, custo: -1 }).ok, false);
  assert.equal(validarEntradaEstoque({ quantidade: 10, custo: 'xyz' }).ok, false);
  assert.equal(validarEntradaEstoque({ quantidade: 0, custo: 5 }).ok, false);

  const brasileiro = validarEntradaEstoque({ quantidade: 10, custo: '1.234,56' });
  assert.equal(brasileiro.ok, true);
  assert.equal(brasileiro.custo, 1234.56);
});

// ── Custo médio após nova compra ────────────────────────────────────────────

test('custo médio é média MÓVEL PONDERADA, não o preço da última compra', () => {
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' }, ...semPersistir);
  db = registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: 4, data: '2026-02-01' }, ...semPersistir);

  const item = db.estoque[0];
  assert.equal(item.quantidade_atual, 200);
  assert.equal(item.valor_unitario, 3, 'antes gravava 4 (última compra) e inflava tudo em 33,3%');
  assert.equal(calcularValorItemEstoque(item), 600, 'bate com o dinheiro realmente gasto');
});

test('custo médio ponderado respeita quantidades desiguais', () => {
  // 300 kg a R$ 1,00 + 100 kg a R$ 5,00 = R$ 800 / 400 kg = R$ 2,00
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 300, custo: 1, data: '2026-01-01' }, ...semPersistir);
  db = registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: 5, data: '2026-02-01' }, ...semPersistir);
  assert.equal(db.estoque[0].valor_unitario, 2);
});

test('item zerado assume o custo da nova entrada, sem arrastar preço antigo', () => {
  const resultado = calcularCustoMedioPonderado({
    saldoAtual: 0, custoMedioAtual: 99, qtdEntrada: 10, custoEntrada: 7,
  });
  assert.equal(resultado, 7);
});

test('saldo negativo herdado é tratado como zero no cálculo da média', () => {
  const resultado = calcularCustoMedioPonderado({
    saldoAtual: -50, custoMedioAtual: 10, qtdEntrada: 10, custoEntrada: 4,
  });
  assert.equal(resultado, 4);
});

test('entrada sem custo baixa a média — recebeu mercadoria sem custo', () => {
  const resultado = calcularCustoMedioPonderado({
    saldoAtual: 100, custoMedioAtual: 4, qtdEntrada: 100, custoEntrada: 0,
  });
  assert.equal(resultado, 2);
});

test('entrada de quantidade zero não altera a média', () => {
  assert.equal(calcularCustoMedioPonderado({
    saldoAtual: 100, custoMedioAtual: 4, qtdEntrada: 0, custoEntrada: 999,
  }), 4);
});

test('a média não é arredondada na base', () => {
  // 100 a R$ 1,00 + 200 a R$ 2,00 = 500/300 = 1,666...
  const media = calcularCustoMedioPonderado({
    saldoAtual: 100, custoMedioAtual: 1, qtdEntrada: 200, custoEntrada: 2,
  });
  assert.ok(perto(media, 5 / 3));
  assert.notEqual(media, Number(media.toFixed(2)));
});

// ── Saída válida ────────────────────────────────────────────────────────────

test('saída válida reduz o saldo e não altera o custo médio', () => {
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' }, ...semPersistir);
  db = registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: 4, data: '2026-02-01' }, ...semPersistir);
  db = registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 50, tipo: 'consumo', data: '2026-03-01' }, ...semPersistir);

  const item = db.estoque[0];
  assert.equal(item.quantidade_atual, 150);
  assert.equal(item.quantidade, 150);
  assert.equal(item.valor_unitario, 3, 'saída não repondera a média');
});

test('o custo do consumo lançado no lote usa a média ponderada', () => {
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' }, ...semPersistir);
  db = registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: 4, data: '2026-02-01' }, ...semPersistir);
  db = registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 50, tipo: 'consumo', data: '2026-03-01' }, ...semPersistir);

  const despesa = db.movimentacoes_financeiras.at(-1);
  assert.equal(despesa.valor, 150, 'antes cobrava R$ 200,00 do lote (50 × preço da última compra)');
  assert.equal(despesa.categoria, 'consumo_estoque');
  assert.equal(despesa.lote_id, 1);
});

// ── Saída acima do saldo / prevenção de negativo ────────────────────────────

test('saída acima do saldo é rejeitada e não altera nada', () => {
  const db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 10, custo: 2, data: '2026-01-01' }, ...semPersistir);
  assert.throws(
    () => registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 11, tipo: 'consumo', data: '2026-03-01' }, ...semPersistir),
    /Saldo insuficiente/
  );
  assert.equal(db.estoque[0].quantidade_atual, 10, 'saldo intocado');
});

test('validarSaidaEstoque é a regra única e nunca deixa saldo negativo', () => {
  const item = { id: 1, quantidade_atual: 10, unidade: 'kg' };
  assert.equal(validarSaidaEstoque(item, 10).ok, true, 'zerar é permitido');
  assert.equal(validarSaidaEstoque(item, 10).saldoFinal, 0);
  assert.equal(validarSaidaEstoque(item, 10.0001).ok, false, 'um passo além do saldo já barra');
  assert.match(validarSaidaEstoque(item, 11).erro, /Saldo insuficiente. Disponível: 10 kg/);
  assert.equal(validarSaidaEstoque(item, 0).ok, false);
  assert.equal(validarSaidaEstoque(item, -5).ok, false);
  assert.equal(validarSaidaEstoque(null, 5).ok, false);
});

test('saída de item sem saldo nenhum é rejeitada', () => {
  assert.equal(validarSaidaEstoque({ id: 1, quantidade_atual: 0 }, 1).ok, false);
});

// ── Ajustes ─────────────────────────────────────────────────────────────────

test('ajuste negativo reduz o saldo sem gerar lançamento financeiro', () => {
  const db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' }, ...semPersistir);
  const depois = registrarSaidaEstoque(db, { itemId: 1, quantidade: 10, tipo: 'ajuste', data: '2026-03-01' }, ...semPersistir);
  assert.equal(depois.estoque[0].quantidade_atual, 90);
  assert.equal(depois.movimentacoes_financeiras.length, 1, 'só a despesa da compra; ajuste não lança');
});

test('ajuste positivo é uma entrada e repondera a média', () => {
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' }, ...semPersistir);
  db = registrarEntradaEstoque(db, { itemId: 1, qtd: 100, custo: 2, data: '2026-02-01' }, ...semPersistir);
  assert.equal(db.estoque[0].quantidade_atual, 200);
  assert.equal(db.estoque[0].valor_unitario, 2, 'mesmo preço mantém a média');
});

test('perda reduz o saldo e não gera receita nem despesa', () => {
  const db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 50, custo: 3, data: '2026-01-01' }, ...semPersistir);
  const depois = registrarSaidaEstoque(db, { itemId: 1, quantidade: 5, tipo: 'perda', data: '2026-03-01' }, ...semPersistir);
  assert.equal(depois.estoque[0].quantidade_atual, 45);
  assert.equal(depois.movimentacoes_financeiras.filter((m) => m.tipo === 'receita').length, 0);
});

// ── Saldo: fonte única ──────────────────────────────────────────────────────

test('saldo segue quantidade_atual e ignora campos que não existem na tabela', () => {
  // `saldo` não é coluna de `estoque` (verificado no schema de produção).
  const item = { id: 9, quantidade_atual: 30, quantidade: 80, saldo: 55 };
  assert.equal(obterSaldoItemEstoque(item), 30, 'antes um objeto com `saldo` devolvia 55 na Sanidade');
  assert.equal(obterSaldoAtualItemEstoque(item), 30, 'Sanidade e Estoque agora concordam');
});

test('linha legada só com `quantidade` usa esse valor', () => {
  assert.equal(obterSaldoItemEstoque({ id: 1, quantidade: 42 }), 42);
});

test('saldo negativo herdado aparece como negativo, não é escondido como zero', () => {
  assert.equal(obterSaldoItemEstoque({ id: 1, quantidade_atual: -7 }), -7);
});

test('custo unitário prefere valor_unitario e aceita espelhos legados', () => {
  assert.equal(obterCustoUnitarioItem({ valor_unitario: 3, custo_unitario: 9 }), 3);
  assert.equal(obterCustoUnitarioItem({ custo_unitario: 9 }), 9);
  assert.equal(obterCustoUnitarioItem({ preco_unitario: 5 }), 5);
  assert.equal(obterCustoUnitarioItem({}), 0);
});

// ── Estoque zero ────────────────────────────────────────────────────────────

test('estoque zero permanece zero e não vira dado ausente', () => {
  const db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 10, custo: 2, data: '2026-01-01' }, ...semPersistir);
  const zerado = registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 10, tipo: 'consumo', data: '2026-03-01' }, ...semPersistir);
  assert.equal(zerado.estoque[0].quantidade_atual, 0);
  assert.equal(obterSaldoItemEstoque(zerado.estoque[0]), 0);
  assert.equal(zerado.estoque[0].valor_unitario, 2, 'zerar não apaga o custo histórico');
  assert.equal(calcularValorItemEstoque(zerado.estoque[0]), 0);
});

test('listarProdutosSemSaldo encontra exatamente os itens zerados', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 0, fazenda_id: 1 },
    { id: 2, quantidade_atual: 5, fazenda_id: 1 },
    { id: 3, quantidade_atual: 0, fazenda_id: null },
  ] };
  assert.deepEqual(listarProdutosSemSaldo(db).map((i) => i.id), [1, 3]);
  assert.deepEqual(listarProdutosSemSaldo(db, 1).map((i) => i.id), [1]);
  assert.deepEqual(listarProdutosSemSaldo(db, SEM_FAZENDA).map((i) => i.id), [3]);
});

// ── Valor total do estoque ──────────────────────────────────────────────────

test('valor total do estoque soma saldo × custo médio de cada item', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 10, valor_unitario: 3, fazenda_id: 1 },
    { id: 2, quantidade_atual: 20, valor_unitario: 5, fazenda_id: 2 },
  ] };
  assert.equal(calcularValorTotalEstoque(db), 10 * 3 + 20 * 5);
});

test('valor total não arredonda na base', () => {
  const db = { estoque: [{ id: 1, quantidade_atual: 3, valor_unitario: 1 / 3, fazenda_id: 1 }] };
  assert.ok(perto(calcularValorTotalEstoque(db), 1));
});

// ── Produto sem fazenda e consolidação ──────────────────────────────────────

test('produto sem fazenda vai para SEM_FAZENDA, sem sumir nem duplicar', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 10, valor_unitario: 3, fazenda_id: 1 },
    { id: 2, quantidade_atual: 20, valor_unitario: 5, fazenda_id: 2 },
    { id: 3, quantidade_atual: 7, valor_unitario: 2, fazenda_id: null },
  ] };
  const c = consolidarEstoquePorFazenda(db);

  assert.equal(c.porFazenda.get(1).quantidade, 10);
  assert.equal(c.porFazenda.get(2).quantidade, 20);
  assert.equal(c.semFazenda.quantidade, 7, 'antes as 7 unidades sumiam do detalhamento por fazenda');
  assert.equal(c.total.quantidade, 37);
});

test('invariante: total = soma(porFazenda) + semFazenda', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 10, valor_unitario: 3, fazenda_id: 1 },
    { id: 2, quantidade_atual: 20, valor_unitario: 5, fazenda_id: 2 },
    { id: 3, quantidade_atual: 7, valor_unitario: 2, fazenda_id: null },
    { id: 4, quantidade_atual: 1, valor_unitario: 1, fazenda_id: undefined },
  ] };
  const c = consolidarEstoquePorFazenda(db);
  const somaFazendas = [...c.porFazenda.values()].reduce((a, f) => a + f.quantidade, 0);
  const somaValores = [...c.porFazenda.values()].reduce((a, f) => a + f.valor, 0);

  assert.equal(c.total.quantidade, somaFazendas + c.semFazenda.quantidade);
  assert.equal(c.total.valor, somaValores + c.semFazenda.valor);
  assert.equal(c.semFazenda.itens, 2, 'null e undefined são ambos órfãos');
});

test('múltiplas fazendas: cada uma vê só o seu, e o consolidado vê tudo', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 10, valor_unitario: 3, fazenda_id: 1 },
    { id: 2, quantidade_atual: 20, valor_unitario: 5, fazenda_id: 2 },
    { id: 3, quantidade_atual: 7, valor_unitario: 2, fazenda_id: null },
  ] };
  assert.equal(calcularValorTotalEstoque(db, 1), 30);
  assert.equal(calcularValorTotalEstoque(db, 2), 100);
  assert.equal(calcularValorTotalEstoque(db, SEM_FAZENDA), 14);
  assert.equal(calcularValorTotalEstoque(db), 144, 'consolidado inclui o órfão uma vez');
});

test('consolidado pode omitir itens zerados sem perder os demais', () => {
  const db = { estoque: [
    { id: 1, quantidade_atual: 0, valor_unitario: 3, fazenda_id: 1 },
    { id: 2, quantidade_atual: 20, valor_unitario: 5, fazenda_id: 1 },
  ] };
  assert.equal(consolidarEstoquePorFazenda(db).total.itens, 2);
  assert.equal(consolidarEstoquePorFazenda(db, { apenasComSaldo: true }).total.itens, 1);
});

// ── Baixa duplicada ─────────────────────────────────────────────────────────

test('uma saída gera uma baixa: movimentação repetida não conta duas vezes', () => {
  const movimento = { id: 5, item_estoque_id: 1, lote_id: 1, tipo: 'consumo', quantidade: 50, valor_total: 150, data: '2026-03-01' };
  const db = { movimentacoes_estoque: [movimento, { ...movimento }] };
  const consumo = calcularConsumoDoLote(db, 1);
  assert.equal(consumo.movimentos, 1);
  assert.equal(consumo.quantidadeTotal, 50, 'a repetição não dobra a baixa');
  assert.equal(consumo.custoTotal, 150);
});

test('movimentações distintas com o mesmo id não são descartadas', () => {
  // Ids locais já colidiram com a sequence do banco neste projeto.
  const db = { movimentacoes_estoque: [
    { id: 5, item_estoque_id: 1, lote_id: 1, tipo: 'consumo', quantidade: 50, valor_total: 150, data: '2026-03-01' },
    { id: 5, item_estoque_id: 2, lote_id: 1, tipo: 'consumo', quantidade: 30, valor_total: 90, data: '2026-03-02' },
  ] };
  const consumo = calcularConsumoDoLote(db, 1);
  assert.equal(consumo.movimentos, 2, 'baixas reais diferentes precisam sobreviver');
  assert.equal(consumo.quantidadeTotal, 80);
});

test('deduplicarMovimentacoesEstoque preserva linhas ainda sem id', () => {
  const saida = deduplicarMovimentacoesEstoque([{ tipo: 'consumo' }, { tipo: 'consumo' }]);
  assert.equal(saida.length, 2);
});

// ── Consumo por lote e por cabeça ───────────────────────────────────────────

test('consumo do lote soma consumo e tratamento, e ignora ajuste e perda', () => {
  const db = { movimentacoes_estoque: [
    { id: 1, lote_id: 1, tipo: 'consumo', quantidade: 50, valor_total: 150, data: '2026-03-01' },
    { id: 2, lote_id: 1, tipo: 'tratamento', quantidade: 5, valor_total: 90, data: '2026-03-02' },
    { id: 3, lote_id: 1, tipo: 'ajuste', quantidade: 8, valor_total: 24, data: '2026-03-03' },
    { id: 4, lote_id: 1, tipo: 'perda', quantidade: 2, valor_total: 6, data: '2026-03-04' },
    { id: 5, lote_id: 2, tipo: 'consumo', quantidade: 99, valor_total: 300, data: '2026-03-05' },
  ] };
  const consumo = calcularConsumoDoLote(db, 1);
  assert.equal(consumo.quantidadeTotal, 55);
  assert.equal(consumo.custoTotal, 240);
});

test('consumo vinculado ao lote entra no custo do lote uma única vez', () => {
  let db = registrarEntradaEstoque(dbEstoque(), { itemId: 1, qtd: 100, custo: 3, data: '2026-01-01' }, ...semPersistir);
  db = registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 20, tipo: 'consumo', data: '2026-03-01' }, ...semPersistir);

  const despesasDoConsumo = db.movimentacoes_financeiras.filter((m) => m.categoria === 'consumo_estoque');
  assert.equal(despesasDoConsumo.length, 1, 'uma saída, um lançamento de custo');
  assert.equal(despesasDoConsumo[0].valor, 60);
  assert.equal(calcularConsumoDoLote(db, 1).custoTotal, 60);
});

test('consumo por cabeça divide pelo rebanho informado', () => {
  const db = { movimentacoes_estoque: [
    { id: 1, lote_id: 1, tipo: 'consumo', quantidade: 100, valor_total: 300, data: '2026-03-01' },
  ] };
  const porCabeca = calcularConsumoPorCabeca(db, 1, 20);
  assert.equal(porCabeca.quantidadePorCabeca, 5);
  assert.equal(porCabeca.custoPorCabeca, 15);
});

test('consumo por cabeça é null (não 0) quando não há cabeças', () => {
  const db = { movimentacoes_estoque: [
    { id: 1, lote_id: 1, tipo: 'consumo', quantidade: 100, valor_total: 300, data: '2026-03-01' },
  ] };
  const porCabeca = calcularConsumoPorCabeca(db, 1, 0);
  assert.equal(porCabeca.quantidadePorCabeca, null, 'dividir por zero não é "consumo zero"');
  assert.equal(porCabeca.custoPorCabeca, null);
  assert.equal(porCabeca.quantidadeTotal, 100, 'o total continua conhecido');
});

test('lote sem consumo devolve zeros, não null', () => {
  const consumo = calcularConsumoDoLote({ movimentacoes_estoque: [] }, 1);
  assert.equal(consumo.quantidadeTotal, 0);
  assert.equal(consumo.custoTotal, 0);
  assert.equal(consumo.movimentos, 0);
});

// ── Telegram lê o mesmo saldo que o app web ─────────────────────────────────

function dbTelegram(item) {
  return { estoque: [item], lotes: [{ id: 1, nome: 'Lote A', status: 'ativo' }] };
}

test('Telegram usa a fonte canônica de saldo — campo inexistente não vence mais a coluna real', () => {
  // `saldo` não é coluna de `estoque`. Antes o bot lia
  // `quantidade_atual ?? quantidade`, o que já ignorava `saldo`, mas era uma
  // leitura paralela; agora é a mesma função do app web.
  const item = { id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 30, quantidade: 80, saldo: 55 };
  const r = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 10 });
  assert.equal(r.ok, true);
  assert.equal(obterSaldoItemEstoque(item), 30);
  const patchEstoque = r.writes.find((w) => w.tabela === 'estoque');
  assert.equal(patchEstoque.patch.quantidade_atual, 20, '30 − 10, pelo saldo canônico');
});

test('Telegram bloqueia saída acima do saldo pelo mesmo saldo do app web', () => {
  const item = { id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 5, quantidade: 500 };
  const r = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 10 });
  assert.equal(r.ok, false);
  assert.equal(r.erro, 'SALDO_INSUFICIENTE');
  assert.equal(r.saldoAtual, 5, 'não pode usar o espelho legado de 500');
});

test('Telegram lê linha legada só com `quantidade`', () => {
  const item = { id: 1, produto: 'Sal', unidade: 'kg', quantidade: 40 };
  const r = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 10 });
  assert.equal(r.ok, true);
  assert.equal(r.writes.find((w) => w.tabela === 'estoque').patch.quantidade_atual, 30);
});

test('Telegram usa o mesmo custo médio do app web para valorizar a baixa', () => {
  const item = { id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 100, valor_unitario: 3, custo_unitario: 99 };
  const r = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 10 });
  assert.equal(r.ok, true);
  const movimento = r.writes.find((w) => w.tabela === 'movimentacoes_estoque');
  assert.equal(movimento.registro.custo_unitario, 3, 'valor_unitario vence o espelho legado');
  assert.equal(movimento.registro.valor_total, 30);
});

test('Telegram mantém `quantidade` em sincronia com `quantidade_atual`', () => {
  const item = { id: 1, produto: 'Sal', unidade: 'kg', quantidade_atual: 100, quantidade: 100, valor_unitario: 2 };
  const r = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 40 });
  const patch = r.writes.find((w) => w.tabela === 'estoque').patch;
  assert.equal(patch.quantidade_atual, 60);
  assert.equal(patch.quantidade, 60, 'atualizar só uma coluna fazia as telas divergirem');
});

// ── Painel Geral × Estoque: mesma regra de domínio (Sprint 6) ──────────────
// DashboardPage.jsx e EstoquePage.jsx passaram a delegar saldo, custo
// unitário e valor total inteiramente para estas funções (antes cada tela
// tinha sua própria leitura de `quantidade_atual`/`preco_unitario`). Os
// quatro cenários abaixo são os mesmos cobrados na auditoria: item parado,
// item com entrada, item com saída e item reabastecido a um custo diferente
// — este último é o caso que gerava a divergência de −33,3% entre as duas
// telas (ver comentário em DashboardPage.jsx).

function dbEstoqueComEspelhoAntigo({ quantidade_atual, valor_unitario, preco_unitario = valor_unitario, fazenda_id = 1 } = {}) {
  return {
    estoque: [{
      id: 1, produto: 'Sal mineral', unidade: 'kg', fazenda_id,
      quantidade_atual, quantidade: quantidade_atual, valor_unitario, preco_unitario,
    }],
    movimentacoes_estoque: [],
    movimentacoes_financeiras: [],
    lotes: [{ id: 1, nome: 'Lote A', faz_id: 1, qtd: 20 }],
    animais: [],
  };
}

test('item sem movimentação: saldo e valor total são consistentes e não geram NaN', () => {
  const db = dbEstoqueComEspelhoAntigo({ quantidade_atual: 0, valor_unitario: 0 });
  const item = db.estoque[0];
  assert.equal(obterSaldoItemEstoque(item), 0);
  assert.equal(calcularValorItemEstoque(item), 0);
  assert.equal(calcularValorTotalEstoque(db), 0);
});

test('item com uma entrada: Estoque e Painel Geral calculam o mesmo valor, pelo custo real da compra', () => {
  const db = registrarEntradaEstoque(
    dbEstoqueComEspelhoAntigo({ quantidade_atual: 0, valor_unitario: 0, preco_unitario: 0 }),
    { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' },
    ...semPersistir
  );
  const item = db.estoque[0];
  assert.equal(obterSaldoItemEstoque(item), 100);
  assert.equal(calcularValorItemEstoque(item), 200);
  assert.equal(calcularValorTotalEstoque(db), 200, 'Painel Geral tem que bater com o item individual do Estoque');
});

test('item com saída: saldo cai, mas custo médio e valor total não mudam em nenhuma das duas telas', () => {
  let db = registrarEntradaEstoque(
    dbEstoqueComEspelhoAntigo({ quantidade_atual: 0, valor_unitario: 0, preco_unitario: 0 }),
    { itemId: 1, qtd: 100, custo: 2, data: '2026-01-01' },
    ...semPersistir
  );
  db = registrarSaidaEstoque(db, { itemId: 1, loteId: 1, quantidade: 40, tipo: 'consumo', data: '2026-02-01' }, ...semPersistir);

  const item = db.estoque[0];
  assert.equal(obterSaldoItemEstoque(item), 60);
  assert.equal(obterCustoUnitarioItem(item), 2, 'saída não repondera a média');
  assert.equal(calcularValorItemEstoque(item), 120);
  assert.equal(calcularValorTotalEstoque(db), 120);
});

test('item com reposição por valor diferente: valor total usa a média móvel, não o preco_unitario congelado (bug medido na auditoria)', () => {
  // Cadastro: 100 kg a R$ 2,00 — preco_unitario nasce = valor_unitario = 2 e
  // não é mais tocado pelas entradas seguintes (services/movimentacoes.js só
  // repondera `valor_unitario`).
  const cadastro = dbEstoqueComEspelhoAntigo({ quantidade_atual: 100, valor_unitario: 2, preco_unitario: 2 });
  // Reposição a um custo diferente: +100 kg a R$ 4,00.
  const db = registrarEntradaEstoque(cadastro, { itemId: 1, qtd: 100, custo: 4, data: '2026-02-01' }, ...semPersistir);

  const item = db.estoque[0];
  assert.equal(item.quantidade_atual, 200);
  assert.equal(item.valor_unitario, 3, 'média móvel: (100×2 + 100×4) / 200');
  assert.equal(item.preco_unitario, 2, 'espelho legado não é tocado pela entrada — continua o valor do cadastro');

  const valorReal = calcularValorItemEstoque(item);
  const valorComEspelhoAntigo = obterSaldoItemEstoque(item) * Number(item.preco_unitario || 0);

  assert.equal(valorReal, 600, 'dinheiro realmente gasto: 100×2 + 100×4');
  assert.equal(valorComEspelhoAntigo, 400, 'o valor que o Painel Geral mostrava antes da Sprint 6 — 33,3% a menos');
  assert.equal(calcularValorTotalEstoque(db), 600, 'Painel Geral (calcularValorTotalEstoque) e Estoque (calcularValorItemEstoque) concordam');
});

test('app web e Telegram chegam ao mesmo saldo final para a mesma saída', () => {
  const item = { id: 1, produto: 'Sal', unidade: 'kg', fazenda_id: 1, quantidade_atual: 100, quantidade: 100, valor_unitario: 3 };

  const web = registrarSaidaEstoque(
    { ...dbEstoque({ quantidade_atual: 100, valor_unitario: 3 }) },
    { itemId: 1, loteId: 1, quantidade: 25, tipo: 'consumo', data: '2026-03-01' },
    ...semPersistir
  );
  const bot = prepararSaidaEstoque(dbTelegram(item), { item: 'Sal', quantidade: 25, tipo: 'consumo', lote: 'Lote A' });

  const saldoWeb = obterSaldoItemEstoque(web.estoque[0]);
  const saldoBot = bot.writes.find((w) => w.tabela === 'estoque').patch.quantidade_atual;
  assert.equal(saldoWeb, 75);
  assert.equal(saldoBot, saldoWeb, 'os dois caminhos precisam concordar');

  const custoWeb = web.movimentacoes_financeiras.find((m) => m.categoria === 'consumo_estoque').valor;
  const custoBot = bot.writes.find((w) => w.tabela === 'movimentacoes_financeiras').registro.valor;
  assert.equal(custoWeb, 75);
  assert.equal(custoBot, custoWeb, 'e sobre o mesmo custo médio');
});
