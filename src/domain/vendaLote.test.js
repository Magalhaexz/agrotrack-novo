import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularVendasDoLote,
  calcularBaseResultadoLote,
  deduplicarLancamentos,
} from './vendaLote.js';
import { calcularResultadoLote, calcularReceitaLote, calcularCustoLote } from './calculos.js';
import { getResumoLote } from './resumoLote.js';

// Sprint 4/7 — venda e resultado econômico dos lotes.
//
// Cenário base (o mesmo usado para medir as divergências na matriz):
// 20 cabeças compradas a 300 kg por R$ 60.000, mais R$ 12.000 de custeio.
// Rendimento de carcaça 52%. Venda parcial: 8 cabeças a 450 kg por R$ 43.200.
// Venda total: mais 12 cabeças a 460 kg por R$ 66.240.

const REND = 52;

function cenario({ vendaTotal = false, semCustos = false, semVenda = false, status = 'ativo' } = {}) {
  const vendas = [];
  const receitas = [];
  let qtdRestante = 20;

  if (!semVenda) {
    vendas.push({ id: 1, lote_id: 1, tipo: 'venda', qtd: 8, peso_medio: 450, valor_total: 43200, data: '2026-06-10' });
    receitas.push({ id: 10, lote_id: 1, tipo: 'receita', categoria: 'venda_animal', valor: 43200, data: '2026-06-10', status: 'realizado' });
    qtdRestante = 12;
  }
  if (vendaTotal) {
    vendas.push({ id: 2, lote_id: 1, tipo: 'venda', qtd: 12, peso_medio: 460, valor_total: 66240, data: '2026-06-20' });
    receitas.push({ id: 11, lote_id: 1, tipo: 'receita', categoria: 'venda_animal', valor: 66240, data: '2026-06-20', status: 'realizado' });
    qtdRestante = 0;
  }

  const despesas = semCustos ? [] : [
    { id: 1, lote_id: 1, tipo: 'despesa', categoria: 'compra_animal', valor: 60000, data: '2026-01-01', status: 'realizado' },
    { id: 2, lote_id: 1, tipo: 'despesa', categoria: 'outros', valor: 12000, data: '2026-03-01', status: 'realizado' },
  ];

  return {
    lotes: [{
      id: 1, nome: 'Lote A', faz_id: 1, qtd: qtdRestante, p_ini: 300, p_at: 450,
      entrada: '2026-01-01', status, rendimento_carcaca: REND, preco_arroba: 300,
    }],
    animais: [{ id: 1, lote_id: 1, qtd: qtdRestante, p_ini: 300, p_at: 450, data_entrada: '2026-01-01' }],
    movimentacoes_animais: vendas,
    movimentacoes_financeiras: [...despesas, ...receitas],
    custos: [],
    pesagens: [],
    fazendas: [{ id: 1, nome: 'F', area_pastagem_ha: 100 }],
  };
}

const perto = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

// ── 1. Venda parcial ────────────────────────────────────────────────────────

test('venda parcial considera somente a quantidade vendida', () => {
  const v = calcularVendasDoLote(cenario(), 1);
  assert.equal(v.cabecasVendidas, 8, 'só as 8 vendidas, não as 20 do lote');
  assert.equal(v.pesoVivoVendidoKg, 3600, '8 × 450');
  assert.equal(v.valorBruto, 43200);
  assert.equal(v.houveVenda, true);
});

test('venda parcial: o rebanho remanescente não entra em nenhum total de venda', () => {
  const base = calcularBaseResultadoLote(cenario(), 1);
  assert.equal(base.cabecasRemanescentes, 12);
  assert.equal(base.cabecasVendidas, 8);
  assert.equal(base.cabecasBase, 20, 'base = o que o lote carregou');
  assert.equal(base.vendaTotal, false);
});

// ── 2. Venda total ──────────────────────────────────────────────────────────

test('venda total: zera o rebanho e marca o lote como totalmente vendido', () => {
  const base = calcularBaseResultadoLote(cenario({ vendaTotal: true }), 1);
  assert.equal(base.cabecasRemanescentes, 0);
  assert.equal(base.cabecasVendidas, 20);
  assert.equal(base.cabecasBase, 20);
  assert.equal(base.vendaTotal, true);
});

test('venda total: o resultado por cabeça e por arroba NÃO zera (regressão do bug medido)', () => {
  const r = calcularResultadoLote(cenario({ vendaTotal: true }), 1);
  assert.equal(r.lucroTotal, 37440);
  assert.ok(r.lucroPorCabeca > 0, 'lote vendido com lucro não pode mostrar lucro/cabeça 0');
  assert.ok(r.lucroPorArroba > 0, 'lote vendido com lucro não pode mostrar lucro/@ 0');
  assert.ok(r.custoPorArroba > 0, 'custo/@ não pode zerar quando o lote foi todo vendido');
  assert.ok(perto(r.lucroPorCabeca, 37440 / 20));
});

test('a base por arroba é contínua entre a venda parcial e a total', () => {
  const parcial = calcularResultadoLote(cenario(), 1);
  const total = calcularResultadoLote(cenario({ vendaTotal: true }), 1);
  // Antes: 384,62 → 0,00 (salto e colapso). Agora: 230,77 → 227,73.
  assert.ok(perto(parcial.custoPorArroba, 72000 / 312, 1e-6));
  assert.ok(perto(total.custoPorArroba, 72000 / 316.16, 1e-6));
  assert.ok(Math.abs(parcial.custoPorArroba - total.custoPorArroba) < 10, 'sem salto entre parcial e total');
});

// ── 3. Preço por arroba ─────────────────────────────────────────────────────

test('preço por arroba usa a base de CARCAÇA (padrão de mercado), não peso vivo', () => {
  const v = calcularVendasDoLote(cenario(), 1);
  // 3600 kg vivos × 52% = 1872 kg carcaça ÷ 15 = 124,8 @
  assert.ok(perto(v.arrobasCarcacaVendidas, 124.8, 1e-9));
  assert.ok(perto(v.precoPorArrobaCarcaca, 43200 / 124.8, 1e-9));
  // A leitura em peso vivo continua disponível, mas rotulada e distinta.
  assert.ok(perto(v.arrobasVivasVendidas, 240, 1e-9));
  assert.ok(perto(v.precoPorArrobaViva, 180, 1e-9));
  // A divergência medida entre as duas bases: +92,3%.
  assert.ok(perto(v.arrobasVivasVendidas / v.arrobasCarcacaVendidas, 1 / 0.52, 1e-9));
});

test('preço por arroba é null (não 0) quando não houve venda', () => {
  const v = calcularVendasDoLote(cenario({ semVenda: true }), 1);
  assert.equal(v.precoPorArrobaCarcaca, null, '0 leria como "vendeu de graça"');
  assert.equal(v.precoPorArrobaViva, null);
  assert.equal(v.precoMedioPorCabeca, null);
});

// ── 4. Cálculo de arrobas ───────────────────────────────────────────────────

test('arrobas de carcaça respeitam o rendimento configurado no lote', () => {
  const db = cenario();
  db.lotes[0].rendimento_carcaca = 50;
  const v = calcularVendasDoLote(db, 1);
  assert.ok(perto(v.arrobasCarcacaVendidas, (3600 * 0.5) / 15, 1e-9));
});

test('lote sem rendimento configurado cai no padrão de mercado (52%)', () => {
  const db = cenario();
  delete db.lotes[0].rendimento_carcaca;
  const v = calcularVendasDoLote(db, 1);
  assert.ok(perto(v.arrobasCarcacaVendidas, (3600 * 0.52) / 15, 1e-9));
});

// ── 5. Valor bruto ──────────────────────────────────────────────────────────

test('valor bruto soma o valor_total de todas as vendas do lote', () => {
  const v = calcularVendasDoLote(cenario({ vendaTotal: true }), 1);
  assert.equal(v.valorBruto, 43200 + 66240);
  assert.equal(v.quantidadeVendas, 2);
});

test('abate entra como venda no valor bruto; morte e transferência não', () => {
  const db = cenario({ semVenda: true });
  db.movimentacoes_animais = [
    { id: 1, lote_id: 1, tipo: 'abate', qtd: 2, peso_medio: 400, valor_total: 9000, data: '2026-06-01' },
    { id: 2, lote_id: 1, tipo: 'morte', qtd: 1, peso_medio: 400, valor_total: 0, data: '2026-06-02' },
    { id: 3, lote_id: 1, tipo: 'transferencia_saida', qtd: 3, peso_medio: 400, valor_total: 0, data: '2026-06-03' },
  ];
  const v = calcularVendasDoLote(db, 1);
  assert.equal(v.cabecasVendidas, 2, 'só o abate conta como venda');
  assert.equal(v.valorBruto, 9000);
});

// ── 6/7. Descontos, frete e valor líquido ───────────────────────────────────

test('deduções são zero e o líquido é igual ao bruto — não há campos de frete/comissão no fluxo real', () => {
  const v = calcularVendasDoLote(cenario(), 1);
  assert.equal(v.deducoes, 0);
  assert.equal(v.valorLiquido, v.valorBruto);
  assert.equal(v.valorLiquido, 43200);
});

test('o preço por arroba é calculado sobre o valor LÍQUIDO, para já respeitar deduções futuras', () => {
  const v = calcularVendasDoLote(cenario(), 1);
  assert.ok(perto(v.precoPorArrobaCarcaca, v.valorLiquido / v.arrobasCarcacaVendidas, 1e-9));
});

// ── 8. Custo acumulado ──────────────────────────────────────────────────────

test('custo acumulado é do lote inteiro e não muda ao vender parte dele', () => {
  const parcial = calcularCustoLote(cenario(), 1);
  const total = calcularCustoLote(cenario({ vendaTotal: true }), 1);
  assert.equal(parcial.custoTotal, 72000);
  assert.equal(total.custoTotal, 72000, 'vender não reduz o custo já incorrido');
  assert.equal(parcial.custoAnimais, 60000);
});

// ── 9. Lucro e prejuízo ─────────────────────────────────────────────────────

test('venda parcial ainda em prejuízo: pagou por 20, recebeu por 8', () => {
  const r = calcularResultadoLote(cenario(), 1);
  assert.equal(r.receitaTotal, 43200);
  assert.equal(r.custoTotal, 72000);
  assert.equal(r.lucroTotal, -28800);
  assert.ok(r.lucroPorCabeca < 0);
  assert.ok(r.lucroPorArroba < 0);
});

test('venda total vira lucro quando a receita supera o custo acumulado', () => {
  const r = calcularResultadoLote(cenario({ vendaTotal: true }), 1);
  assert.equal(r.receitaTotal, 109440);
  assert.equal(r.lucroTotal, 37440);
  assert.ok(perto(r.margemPct, (37440 / 109440) * 100, 1e-9));
});

// ── 10/11. Margem por cabeça e por arroba ───────────────────────────────────

test('margem por cabeça usa a base do lote (remanescente + vendido), igual em todas as telas', () => {
  const db = cenario();
  const financeiro = calcularResultadoLote(db, 1);
  const resumo = getResumoLote(db, 1);
  assert.ok(perto(financeiro.lucroPorCabeca, -28800 / 20, 1e-9));
  assert.equal(resumo.lucroPorCabeca, financeiro.lucroPorCabeca, 'Resultados e Financeiro não podem divergir');
  assert.equal(resumo.custoPorCabeca, financeiro.custoTotal / 20);
});

test('margem por arroba usa a MESMA base do custo por arroba (comparáveis entre si)', () => {
  const r = calcularResultadoLote(cenario(), 1);
  assert.ok(perto(r.lucroPorArroba, r.lucroTotal / r.arrobasCarcaca, 1e-9));
  assert.ok(perto(r.custoPorArroba, r.custoTotal / r.arrobasCarcaca, 1e-9));
  // lucro/@ = preço/@ realizado − custo/@ só fecha quando tudo foi vendido;
  // aqui o importante é que as duas métricas dividam pelo mesmo denominador.
  assert.ok(perto(r.custoPorArroba + r.lucroPorArroba, r.receitaTotal / r.arrobasCarcaca, 1e-9));
});

// ── 12. Lote sem custos ─────────────────────────────────────────────────────

test('lote sem custos: lucro é a receita inteira e o custo/@ é zero de verdade', () => {
  const r = calcularResultadoLote(cenario({ semCustos: true }), 1);
  assert.equal(r.custoTotal, 0);
  assert.equal(r.receitaTotal, 43200);
  assert.equal(r.lucroTotal, 43200);
  assert.equal(r.custoPorArroba, 0, 'zero aqui é o custo real, não dado ausente');
  assert.ok(r.lucroPorArroba > 0);
});

// ── 13. Lote sem venda ──────────────────────────────────────────────────────

test('lote sem venda: nenhuma receita, nenhuma arroba vendida, preço/@ ausente', () => {
  const db = cenario({ semVenda: true });
  const v = calcularVendasDoLote(db, 1);
  const r = calcularResultadoLote(db, 1);
  assert.equal(v.houveVenda, false);
  assert.equal(v.cabecasVendidas, 0);
  assert.equal(v.arrobasCarcacaVendidas, 0);
  assert.equal(v.precoPorArrobaCarcaca, null);
  assert.equal(r.receitaTotal, 0);
  assert.equal(r.lucroTotal, -72000, 'lote em formação: só custo, ainda sem receita');
});

test('lote sem venda ainda tem base por arroba (o rebanho remanescente)', () => {
  const base = calcularBaseResultadoLote(cenario({ semVenda: true }), 1);
  assert.equal(base.cabecasBase, 20);
  assert.ok(base.arrobasCarcacaBase > 0, 'o lote existe, então tem denominador');
  assert.equal(base.vendaTotal, false, 'sem venda não é venda total');
});

// ── 14. Lote encerrado ──────────────────────────────────────────────────────

test('lote encerrado continua com seu resultado no histórico', () => {
  const db = cenario({ vendaTotal: true, status: 'encerrado' });
  const r = calcularResultadoLote(db, 1);
  assert.equal(r.lucroTotal, 37440, 'encerrar não apaga o resultado realizado');
  assert.equal(r.cabecasVendidas, 20);
  assert.ok(r.custoPorArroba > 0);
});

test('lote encerrado sai do rebanho ativo mas mantém as cabeças vendidas no histórico', () => {
  const db = cenario({ vendaTotal: true, status: 'encerrado' });
  const base = calcularBaseResultadoLote(db, 1);
  assert.equal(base.cabecasRemanescentes, 0);
  assert.equal(base.cabecasVendidas, 20, 'o histórico de venda permanece');
});

// ── 15. Venda com valores decimais ──────────────────────────────────────────

test('valores decimais não são arredondados na base do cálculo', () => {
  const db = cenario({ semVenda: true });
  db.lotes[0].qtd = 3;
  db.animais[0].qtd = 3;
  db.movimentacoes_animais = [
    { id: 1, lote_id: 1, tipo: 'venda', qtd: 7, peso_medio: 483.33, valor_total: 12345.67, data: '2026-06-10' },
  ];
  const v = calcularVendasDoLote(db, 1);
  assert.ok(perto(v.pesoVivoVendidoKg, 7 * 483.33, 1e-9));
  assert.ok(perto(v.arrobasCarcacaVendidas, (7 * 483.33 * 0.52) / 15, 1e-9));
  assert.ok(perto(v.precoPorArrobaCarcaca, 12345.67 / ((7 * 483.33 * 0.52) / 15), 1e-9));
  // O valor exato precisa sobreviver: nada de 2 casas na base.
  assert.notEqual(v.arrobasCarcacaVendidas, Number(v.arrobasCarcacaVendidas.toFixed(2)));
});

// ── 16. Prevenção de receita duplicada ──────────────────────────────────────

test('deduplicarLancamentos remove repetidas e preserva linhas ainda sem id', () => {
  const linhas = [{ id: 1, v: 'a' }, { id: 1, v: 'b' }, { id: 2, v: 'c' }, { v: 'd' }, { v: 'e' }];
  const saida = deduplicarLancamentos(linhas);
  assert.equal(saida.length, 4);
  assert.equal(saida.filter((l) => l.id === 1).length, 1, 'só a primeira ocorrência do id 1');
  assert.equal(saida.filter((l) => l.id === undefined).length, 2, 'sem id nunca é descartado');
});

test('receita não dobra quando a mesma linha reaparece após reload/sincronização', () => {
  const db = cenario();
  const receitaOriginal = calcularReceitaLote(db, 1).receitaTotal;
  // O reload reanexa a mesma linha (mesmo id) já presente em memória.
  db.movimentacoes_financeiras = [...db.movimentacoes_financeiras, { ...db.movimentacoes_financeiras[2] }];
  assert.equal(calcularReceitaLote(db, 1).receitaTotal, receitaOriginal, 'a receita não pode dobrar');
  assert.equal(calcularResultadoLote(db, 1).lucroTotal, -28800);
});

test('custo não dobra quando a mesma despesa reaparece após reload/sincronização', () => {
  const db = cenario();
  const custoOriginal = calcularCustoLote(db, 1).custoTotal;
  db.movimentacoes_financeiras = [...db.movimentacoes_financeiras, { ...db.movimentacoes_financeiras[0] }];
  assert.equal(calcularCustoLote(db, 1).custoTotal, custoOriginal);
});

test('venda repetida na mesma movimentação não dobra peso nem arrobas vendidas', () => {
  const db = cenario();
  db.movimentacoes_animais = [...db.movimentacoes_animais, { ...db.movimentacoes_animais[0] }];
  const v = calcularVendasDoLote(db, 1);
  assert.equal(v.cabecasVendidas, 8);
  assert.equal(v.pesoVivoVendidoKg, 3600);
});

test('morte/perda nunca gera receita no resultado do lote', () => {
  const db = cenario({ semVenda: true });
  db.movimentacoes_animais = [
    { id: 1, lote_id: 1, tipo: 'morte', qtd: 2, peso_medio: 400, valor_total: 0, data: '2026-06-01' },
  ];
  assert.equal(calcularReceitaLote(db, 1).receitaTotal, 0);
  assert.equal(calcularVendasDoLote(db, 1).valorBruto, 0);
  assert.equal(calcularResultadoLote(db, 1).receitaTotal, 0);
});

// ── 17. Consistência entre Financeiro, Resultados e Relatórios ──────────────

test('Financeiro, Resultados e a fonte de venda contam a MESMA receita', () => {
  const db = cenario({ vendaTotal: true });
  const financeiro = calcularReceitaLote(db, 1).receitaTotal;
  const resultado = calcularResultadoLote(db, 1).receitaTotal;
  const resumo = getResumoLote(db, 1).receitaTotal;
  const vendas = calcularVendasDoLote(db, 1).valorBruto;

  assert.equal(financeiro, resultado);
  assert.equal(resultado, resumo);
  assert.equal(vendas, financeiro, 'o valor das movimentações bate com o lançado no financeiro');
});

test('Resultados e Financeiro concordam em lucro, margem, custo/@ e lucro/@', () => {
  const db = cenario({ vendaTotal: true });
  const financeiro = calcularResultadoLote(db, 1);
  const resumo = getResumoLote(db, 1);

  assert.equal(resumo.lucroTotal, financeiro.lucroTotal);
  assert.equal(resumo.margemPct, financeiro.margemPct);
  assert.equal(resumo.custoPorArroba, financeiro.custoPorArroba);
  assert.equal(resumo.lucroPorArroba, financeiro.lucroPorArroba);
  assert.equal(resumo.lucroPorCabeca, financeiro.lucroPorCabeca);
});

test('as arrobas vendidas expostas pelo resultado batem com a fonte única de venda', () => {
  const db = cenario({ vendaTotal: true });
  const r = calcularResultadoLote(db, 1);
  const v = calcularVendasDoLote(db, 1);
  assert.equal(r.arrobasCarcacaVendidas, v.arrobasCarcacaVendidas);
  assert.equal(r.valorLiquidoVendas, v.valorLiquido);
  assert.equal(r.precoPorArrobaCarcaca, v.precoPorArrobaCarcaca);
  assert.equal(r.pesoVivoVendidoKg, v.pesoVivoVendidoKg);
});
