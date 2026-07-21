// ─────────────────────────────────────────────────────────────────────────────
// ESTOQUE E CONSUMO — FONTE ÚNICA (Sprint 5/7).
//
// Três problemas medidos na auditoria:
//
// 1. "CUSTO MÉDIO" NUNCA FOI MÉDIA. `registrarEntradaEstoque` gravava
//    `valor_unitario = custo da ÚLTIMA compra`. Medido: 100 kg a R$ 2,00 + 100
//    kg a R$ 4,00 → valor_unitario R$ 4,00, estoque avaliado em R$ 800,00
//    contra R$ 600,00 realmente gastos (**+33,3%**). Pior: o consumo lançado no
//    lote herdava esse preço — 50 kg custavam R$ 200,00 em vez de R$ 150,00,
//    inflando o custo do lote e, por tabela, derrubando o lucro.
//
// 2. SALDO LIDO COM PRIORIDADES DIFERENTES. `obterSaldoAtualItemEstoque`
//    testava oito nomes de campo, começando por `saldo`, `saldoAtual` e
//    `saldo_atual` — **nenhum dos três existe na tabela** (verificado no schema
//    de produção). Um objeto em memória que carregasse `saldo` vencia a coluna
//    real. Medido no mesmo item: 55 numa tela, 30 na outra.
//
// 3. ESTOQUE NEGATIVO BLOQUEADO NUM CAMINHO E LIBERADO NO OUTRO. A saída pela
//    tela de Estoque lançava erro; o consumo pela Nutrição perguntava
//    "Deseja continuar com saldo negativo?" e seguia.
//
// REGRA OFICIAL:
//   - saldo    = `quantidade_atual` (coluna real), com `quantidade` de fallback
//                para linhas legadas. Nada de campos inventados.
//   - custo    = `valor_unitario`, mantido como MÉDIA MÓVEL PONDERADA.
//   - valor    = saldo × custo médio, sem arredondar na base.
//   - saída    = nunca pode deixar saldo negativo, em nenhum caminho.
//   - órfãos   = produto sem fazenda aparece em `SEM_FAZENDA`, contado uma vez.
// ─────────────────────────────────────────────────────────────────────────────
import { safeDivide, toNumber } from './calcHelpers.js';

/** Chave usada para agrupar produtos sem fazenda na visão consolidada. */
export const SEM_FAZENDA = 'sem_fazenda';

/** Tipos de movimentação de estoque que retiram saldo. */
export const TIPOS_SAIDA_ESTOQUE = Object.freeze(['consumo', 'tratamento', 'ajuste', 'perda', 'venda']);

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Saldo atual de um item. `quantidade_atual` é a coluna real; `quantidade` é o
 * espelho legado que `operationalPersistence` ainda grava junto.
 *
 * Não força piso em zero: saldo negativo herdado de dados antigos precisa
 * APARECER para poder ser corrigido, não ser escondido como 0.
 */
export function obterSaldoItemEstoque(item) {
  if (!item || typeof item !== 'object') return 0;
  if (item.quantidade_atual !== undefined && item.quantidade_atual !== null && item.quantidade_atual !== '') {
    return toNumber(item.quantidade_atual);
  }
  if (item.quantidade !== undefined && item.quantidade !== null && item.quantidade !== '') {
    return toNumber(item.quantidade);
  }
  return 0;
}

/**
 * Custo unitário do item — média móvel ponderada mantida em `valor_unitario`.
 * `custo_unitario`/`preco_unitario` são colunas espelho legadas.
 */
export function obterCustoUnitarioItem(item) {
  if (!item || typeof item !== 'object') return 0;
  for (const chave of ['valor_unitario', 'custo_unitario', 'preco_unitario']) {
    const valor = item[chave];
    if (valor !== undefined && valor !== null && valor !== '') {
      return toNumber(valor);
    }
  }
  return 0;
}

/** Valor imobilizado num item = saldo × custo médio. Sem arredondar. */
export function calcularValorItemEstoque(item) {
  return obterSaldoItemEstoque(item) * obterCustoUnitarioItem(item);
}

/**
 * Média móvel ponderada após uma entrada — a fórmula que faltava.
 *
 *   novo = (saldo × custoAtual + qtdEntrada × custoEntrada) ÷ (saldo + qtdEntrada)
 *
 * Casos de borda deliberados:
 *  - saldo 0 (item novo ou zerado): o custo passa a ser o da entrada, sem
 *    arrastar preço antigo de um estoque que não existe mais;
 *  - saldo negativo herdado: trata como 0 para não gerar média sem sentido;
 *  - entrada sem custo informado (0): o saldo aumenta e a média CAI, o que é
 *    correto — recebeu mercadoria sem custo (doação, acerto, brinde).
 */
export function calcularCustoMedioPonderado({ saldoAtual, custoMedioAtual, qtdEntrada, custoEntrada }) {
  const saldo = Math.max(toNumber(saldoAtual), 0);
  const custoAtual = toNumber(custoMedioAtual);
  const qtd = toNumber(qtdEntrada);
  const custoNovo = toNumber(custoEntrada);

  if (qtd <= 0) return custoAtual;
  if (saldo <= 0) return custoNovo;

  return safeDivide(saldo * custoAtual + qtd * custoNovo, saldo + qtd, custoNovo);
}

/**
 * Valida uma saída de estoque ANTES de gravar. Fonte única da regra
 * "nenhuma saída pode deixar saldo negativo" — vale para a tela de Estoque, o
 * consumo da Nutrição, a baixa da Sanidade e o bot.
 *
 * @returns {{ok: boolean, erro: string|null, saldoAtual: number, saldoFinal: number}}
 */
export function validarSaidaEstoque(item, quantidade) {
  const saldoAtual = obterSaldoItemEstoque(item);
  const qtd = toNumber(quantidade);

  if (!item) {
    return { ok: false, erro: 'Item de estoque não encontrado.', saldoAtual: 0, saldoFinal: 0 };
  }
  if (!Number.isFinite(qtd) || qtd <= 0) {
    return { ok: false, erro: 'Informe uma quantidade válida.', saldoAtual, saldoFinal: saldoAtual };
  }
  if (qtd > saldoAtual) {
    const unidade = String(item?.unidade || item?.unidade_medida || '').trim();
    return {
      ok: false,
      erro: `Saldo insuficiente. Disponível: ${saldoAtual}${unidade ? ` ${unidade}` : ''}`,
      saldoAtual,
      saldoFinal: saldoAtual,
    };
  }
  return { ok: true, erro: null, saldoAtual, saldoFinal: saldoAtual - qtd };
}

/**
 * Consolidação por fazenda. Produto sem `fazenda_id` vai para `SEM_FAZENDA` —
 * separado e contado UMA vez, nunca somado a uma fazenda nem descartado.
 *
 * Invariante garantida (a mesma de `rebanhoPorFazenda`):
 *   `total === soma(porFazenda) + semFazenda`
 */
export function consolidarEstoquePorFazenda(db, { apenasComSaldo = false } = {}) {
  const porFazenda = new Map();
  let semFazenda = { quantidade: 0, valor: 0, itens: 0 };

  arr(db?.estoque).forEach((item) => {
    const saldo = obterSaldoItemEstoque(item);
    if (apenasComSaldo && saldo === 0) return;

    const valor = calcularValorItemEstoque(item);
    const fazendaId = item?.fazenda_id;
    const orfao = fazendaId === null || fazendaId === undefined || fazendaId === ''
      || Number.isNaN(Number(fazendaId));

    if (orfao) {
      semFazenda = {
        quantidade: semFazenda.quantidade + saldo,
        valor: semFazenda.valor + valor,
        itens: semFazenda.itens + 1,
      };
      return;
    }

    const chave = Number(fazendaId);
    const atual = porFazenda.get(chave) || { quantidade: 0, valor: 0, itens: 0 };
    porFazenda.set(chave, {
      quantidade: atual.quantidade + saldo,
      valor: atual.valor + valor,
      itens: atual.itens + 1,
    });
  });

  const totaisFazendas = [...porFazenda.values()].reduce(
    (acc, f) => ({
      quantidade: acc.quantidade + f.quantidade,
      valor: acc.valor + f.valor,
      itens: acc.itens + f.itens,
    }),
    { quantidade: 0, valor: 0, itens: 0 }
  );

  return {
    porFazenda,
    semFazenda,
    total: {
      quantidade: totaisFazendas.quantidade + semFazenda.quantidade,
      valor: totaisFazendas.valor + semFazenda.valor,
      itens: totaisFazendas.itens + semFazenda.itens,
    },
  };
}

/**
 * Valor total do estoque. Com `fazendaId`, restringe à fazenda; `SEM_FAZENDA`
 * devolve só os órfãos; sem argumento, é o consolidado (cada item uma vez).
 */
export function calcularValorTotalEstoque(db, fazendaId = null) {
  const { porFazenda, semFazenda, total } = consolidarEstoquePorFazenda(db);
  if (fazendaId === null || fazendaId === undefined) return total.valor;
  if (fazendaId === SEM_FAZENDA) return semFazenda.valor;
  return (porFazenda.get(Number(fazendaId)) || { valor: 0 }).valor;
}

/**
 * Remove a MESMA movimentação repetida — mesma disciplina de
 * `domain/vendaLote.js::deduplicarLancamentos`: uma saída deve gerar UMA baixa,
 * e um reload/sync que reanexe a linha não pode contar duas.
 *
 * A chave não é só o `id` (ids locais já colidiram com a sequence do banco
 * neste projeto); linhas sem `id` nunca são descartadas.
 */
export function deduplicarMovimentacoesEstoque(linhas) {
  const vistos = new Set();
  return arr(linhas).filter((linha) => {
    const id = linha?.id;
    if (id === undefined || id === null || id === '') return true;
    const chave = [
      id, linha?.item_estoque_id, linha?.lote_id, linha?.tipo,
      linha?.quantidade, linha?.valor_total, linha?.data, linha?.origem_id,
    ].map((parte) => String(parte ?? '')).join('|');
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

/**
 * Consumo de estoque vinculado a UM lote, a partir de `movimentacoes_estoque`.
 *
 * Só `consumo` e `tratamento` entram: `ajuste` e `perda` são correções internas
 * do estoque e não representam insumo entregue ao lote (é a mesma regra que
 * `registrarSaidaEstoque` já usa para decidir se lança despesa).
 */
export function calcularConsumoDoLote(db, loteId) {
  const movimentos = deduplicarMovimentacoesEstoque(db?.movimentacoes_estoque)
    .filter((mov) => {
      const tipo = String(mov?.tipo || '').toLowerCase();
      return (tipo === 'consumo' || tipo === 'tratamento')
        && toNumber(mov?.lote_id) === toNumber(loteId);
    });

  const quantidadeTotal = movimentos.reduce((soma, mov) => soma + toNumber(mov?.quantidade), 0);
  const custoTotal = movimentos.reduce((soma, mov) => soma + toNumber(mov?.valor_total), 0);

  return { movimentos: movimentos.length, quantidadeTotal, custoTotal };
}

/**
 * Consumo por cabeça de um lote. `cabecas` vem de quem chama (a fonte canônica
 * é `qtdCabecasDoLote`, em domain/rebanho.js — não duplicada aqui).
 *
 * Devolve `null` (não 0) quando não há cabeças: dividir por zero não é
 * "consumo zero", é dado indisponível.
 */
export function calcularConsumoPorCabeca(db, loteId, cabecas) {
  const { quantidadeTotal, custoTotal } = calcularConsumoDoLote(db, loteId);
  const heads = toNumber(cabecas);
  if (heads <= 0) {
    return { quantidadePorCabeca: null, custoPorCabeca: null, quantidadeTotal, custoTotal };
  }
  return {
    quantidadePorCabeca: quantidadeTotal / heads,
    custoPorCabeca: custoTotal / heads,
    quantidadeTotal,
    custoTotal,
  };
}

/** Produtos com saldo exatamente zero — estado real, distinto de "sem cadastro". */
export function listarProdutosSemSaldo(db, fazendaId = null) {
  return arr(db?.estoque).filter((item) => {
    if (obterSaldoItemEstoque(item) !== 0) return false;
    if (fazendaId === null || fazendaId === undefined) return true;
    if (fazendaId === SEM_FAZENDA) return item?.fazenda_id == null;
    return Number(item?.fazenda_id) === Number(fazendaId);
  });
}
