import { isAnimalAtivo, safeDivide, toNonNegativeNumber, toNumber } from './calcHelpers.js';
import { deveEntrarNoResultadoLote } from './financeiroStatus.js';
import { calcularArrobasPesoVivo, calcularCustoPorArrobaCarcaca, calcularLucroPorArrobaCarcaca } from './arroba.js';
import { calcularBaseResultadoLote, calcularVendasDoLote, deduplicarLancamentos } from './vendaLote.js';

/**
 * Verifica se um item pertence a um lote específico.
 * @param {object} item - O item a ser verificado (deve ter uma propriedade lote_id).
 * @param {number|string} loteId - O ID do lote.
 * @returns {boolean} True se o item pertence ao lote, false caso contrário.
 */
function pertenceAoLote(item, loteId) {
  return toNumber(item?.lote_id) === toNumber(loteId);
}

/**
 * Calcula os custos totais e categorizados para um lote específico.
 *
 * M3 — fonte oficial: `movimentacoes_financeiras` é o livro-caixa/DRE oficial.
 * `custos` é a tabela operacional de custo do lote. Um custo lançado na CustosPage
 * também vira uma movimentação (`origem='custo'`); esta função usa as movimentações
 * como base e só adiciona custos legados que NÃO estão espelhados no livro-caixa
 * (ver `custosLegadosNaoRepresentados`), evitando contagem em dobro.
 *
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 * @returns {{custoAnimais: number, custoEstoque: number, custoOutros: number, custoTotal: number}} Os custos do lote.
 */
export function calcularCustoLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];
  const custos = Array.isArray(db?.custos) ? db.custos : [];

  // Mesmo dedup por `id` da receita: despesa duplicada por reload/sync inflava
  // o custo acumulado e, por tabela, derrubava lucro, margem e custo/@.
  const despesasLote = deduplicarLancamentos(movimentosFinanceiros).filter(
    (mov) => mov.tipo === 'despesa' && pertenceAoLote(mov, loteId) && deveEntrarNoResultadoLote(mov)
  );

  const despesasCustosMap = new Map();
  despesasLote.forEach((mov) => {
    if (mov?.origem === 'custo' && mov?.origem_id != null) {
      despesasCustosMap.set(Number(mov.origem_id), true);
    }
  });

  // Otimização: calcular todas as categorias de custo em uma única passagem
  const baseCustos = despesasLote.reduce(
    (acc, mov) => {
      const valor = toNumber(mov.valor);
      if (mov.categoria === 'compra_animal') {
        acc.custoAnimais += valor;
      } else if (mov.categoria === 'compra_estoque') {
        acc.custoEstoque += valor;
      } else {
        acc.custoOutros += valor;
      }
      return acc;
    },
    { custoAnimais: 0, custoEstoque: 0, custoOutros: 0 }
  );

  const custosLegadosNaoRepresentados = custos.filter((custo) => {
    if (!pertenceAoLote(custo, loteId)) return false;
    if (custo?.id == null) return true;
    return !despesasCustosMap.has(Number(custo.id));
  });

  custosLegadosNaoRepresentados.forEach((custo) => {
    baseCustos.custoOutros += toNumber(custo?.val);
  });

  return {
    custoAnimais: baseCustos.custoAnimais,
    custoEstoque: baseCustos.custoEstoque,
    custoOutros: baseCustos.custoOutros,
    custoTotal: baseCustos.custoAnimais + baseCustos.custoEstoque + baseCustos.custoOutros,
  };
}

/**
 * Calcula as receitas totais e categorizadas para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 * @returns {{receitaVendas: number, receitaOutros: number, receitaTotal: number}} As receitas do lote.
 */
export function calcularReceitaLote(db, loteId) {
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  // Sprint 4: dedup por `id` antes de somar. Um reload ou uma sincronização que
  // reanexe uma linha já presente em memória dobrava a receita do lote — e a
  // receita dobrada aparecia em Resultados, Financeiro e Relatórios de uma vez.
  const receitasLote = deduplicarLancamentos(movimentosFinanceiros).filter(
    (mov) => mov.tipo === 'receita' && pertenceAoLote(mov, loteId) && deveEntrarNoResultadoLote(mov)
  );

  // Otimização: calcular todas as categorias de receita em uma única passagem
  const { receitaVendas, receitaOutros } = receitasLote.reduce(
    (acc, mov) => {
      const valor = toNumber(mov.valor);
      if (mov.categoria === 'venda_animal') {
        acc.receitaVendas += valor;
      } else {
        acc.receitaOutros += valor;
      }
      return acc;
    },
    { receitaVendas: 0, receitaOutros: 0 }
  );

  return {
    receitaVendas,
    receitaOutros,
    receitaTotal: receitaVendas + receitaOutros,
  };
}

/**
 * Calcula o resultado financeiro completo e indicadores zootécnicos para um lote.
 * lucroPorArroba usa @ carcaça (rendimento_carcaca do lote, padrão 52%) — padrão do mercado.
 * @param {object} db - O objeto do banco de dados.
 * @param {number|string} loteId - O ID do lote.
 */
export function calcularResultadoLote(db, loteId) {
  const custo = calcularCustoLote(db, loteId);
  const receita = calcularReceitaLote(db, loteId);
  const custoTotal = toNumber(custo.custoTotal);
  const receitaTotal = toNumber(receita.receitaTotal);
  const lucroTotal = receitaTotal - custoTotal;

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((l) => toNumber(l.id) === toNumber(loteId)) ?? null;
  // F-04: usa rendimento_carcaca configurado no lote (padrão 52% — zebuínos/Nelore)
  // normalizarRendimentoCarcaca (arroba.js) aceita tanto 52 quanto 0.52.
  const rendimentoCarcaca = lote?.rendimento_carcaca || 52;

  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const animaisLote = animais.filter((item) => pertenceAoLote(item, loteId) && isAnimalAtivo(item));
  const qtdRegistrada = animaisLote.reduce((acc, item) => acc + toNonNegativeNumber(item.qtd), 0);
  const pesoMedioAtual = qtdRegistrada
    ? safeDivide(
        animaisLote.reduce((acc, item) => acc + toNumber(item.p_at) * toNonNegativeNumber(item.qtd), 0),
        qtdRegistrada
      )
    : 0;

  // Sprint 4: a base "por cabeça"/"por arroba" passa a ser o que o lote
  // carregou (remanescente + vendido), e não só o rebanho que sobrou. Num lote
  // 100% vendido o remanescente é zero, e custo/@, lucro/@ e lucro/cabeça
  // viravam 0 mesmo com lucro real. Ver domain/vendaLote.js.
  const base = calcularBaseResultadoLote(db, loteId);
  const vendas = calcularVendasDoLote(db, loteId);
  const qtdCabecas = base.cabecasBase;
  const pesoTotalKg = base.pesoVivoRemanescenteKg + base.pesoVivoVendidoKg;

  const arrobaViva = calcularArrobasPesoVivo(pesoMedioAtual);
  // F-04: arrobas pelo peso de carcaça = peso vivo total × rendimento / 15
  const arrobasCarcaca = base.arrobasCarcacaBase;

  const lucroPorCabeca = safeDivide(lucroTotal, qtdCabecas);
  // Sprint 14: custo/@ e lucro/@ usam a MESMA base (arroba de carcaça) — antes
  // custoPorArroba só existia em resumoLote.js com base de arroba de ganho,
  // divergente do lucroPorArroba daqui (ver docs/DECISAO_CALCULO_ARROBA_HERDON.md).
  const custoPorArroba = calcularCustoPorArrobaCarcaca(custoTotal, pesoTotalKg, rendimentoCarcaca);
  const lucroPorArroba = calcularLucroPorArrobaCarcaca(lucroTotal, pesoTotalKg, rendimentoCarcaca);
  const margemPct = receitaTotal > 0 ? safeDivide(lucroTotal * 100, receitaTotal) : 0;

  return {
    custoTotal,
    receitaTotal,
    lucroTotal,
    margemPct,
    qtdCabecas,
    lucroPorCabeca,
    pesoMedioAtual,
    arrobaViva,
    arrobasCarcaca,
    custoPorArroba,
    lucroPorArroba,

    // Venda realizada — fonte única (domain/vendaLote.js). Exposta aqui para
    // que Resultados, Financeiro e Relatórios leiam os MESMOS números.
    cabecasRemanescentes: base.cabecasRemanescentes,
    cabecasVendidas: base.cabecasVendidas,
    vendaTotal: base.vendaTotal,
    pesoVivoVendidoKg: vendas.pesoVivoVendidoKg,
    arrobasCarcacaVendidas: vendas.arrobasCarcacaVendidas,
    valorBrutoVendas: vendas.valorBruto,
    deducoesVendas: vendas.deducoes,
    valorLiquidoVendas: vendas.valorLiquido,
    precoPorArrobaCarcaca: vendas.precoPorArrobaCarcaca,
  };
}
