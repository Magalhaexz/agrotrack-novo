import {
  calcularDiasNoLote,
  daysBetween,
  isAnimalAtivo,
  safeDivide,
  toDateKey,
  toNonNegativeNumber,
  toNumber,
} from '../domain/calcHelpers.js';
import { calcularCustoLote } from '../domain/calculos.js';
import { calcularArrobasProduzidas } from '../domain/indicadores.js';

/**
 * Formata um número para exibição com um número específico de casas decimais, usando o locale pt-BR.
 * Retorna '-' para valores indefinidos, nulos ou não numéricos.
 * @param {number} value - O número a ser formatado.
 * @param {number} [digits=1] - O número de casas decimais.
 * @returns {string} O número formatado ou '—'.
 */
export const formatNumber = (value, digits = 1) => {
  const normalized = Number(value);
  if (value === undefined || value === null || !Number.isFinite(normalized)) return '-';
  return normalized.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/**
 * Formata um número como moeda brasileira (R$), com 2 casas decimais.
 * Retorna '-' para valores indefinidos, nulos ou não numéricos.
 * @param {number} value - O valor monetário a ser formatado.
 * @returns {string} O valor formatado como moeda ou '—'.
 */
export const formatCurrency = (value) => {
  const normalized = Number(value);
  if (value === undefined || value === null || !Number.isFinite(normalized)) return '-';
  return `R$ ${normalized.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Formata uma string de data (YYYY-MM-DD) para o formato brasileiro (DD/MM/YYYY).
 * Retorna '-' para valores nulos ou vazios.
 * @param {string} value - A string de data.
 * @returns {string} A data formatada ou '—'.
 */
export const formatDate = (value) => {
  const dateKey = toDateKey(value);
  if (!dateKey) return '-';
  const [y, m, d] = dateKey.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Calcula a diferença em dias entre uma data alvo e a data atual.
 * Retorna 999 para strings de data nulas ou vazias.
 * @param {string} dateStr - A string de data alvo (YYYY-MM-DD).
 * @returns {number} A diferença em dias.
 */
export const daysDiff = (dateStr) => {
  const target = toDateKey(dateStr);
  if (!target) return 999;
  const today = new Date().toISOString().slice(0, 10);
  return daysBetween(today, target);
};

// Compatibilidade com import legado
export const calcularDias = daysDiff;


/**
 * Calcula indicadores produtivos/zootécnicos de um lote (animais, peso, GMD, arrobas, dias).
 * Expõe também uma PROJEÇÃO financeira (`receitaProjetada`/`margemProjetada`) baseada no
 * peso atual x preço-alvo da arroba — útil apenas para alertas/estimativas.
 * IMPORTANTE: a projeção NÃO é a fonte financeira oficial. Para custo/receita/lucro/margem
 * realizados (a partir de vendas e custos reais), use sempre `getResumoLote`.
 * @param {object} db - O objeto do banco de dados.
 * @param {string|number} loteId - O ID do lote.
 * @returns {object} Indicadores produtivos do lote + projeção financeira estimada.
 */
/**
 * Peso médio atual de um lote seguindo a pesagem de LOTE válida mais recente
 * (bug 3.3/3.4/3.5): fonte ÚNICA do peso atual para todas as telas. Sem pesagem
 * posterior à entrada, cai para `fallback` (peso médio dos animais = entrada).
 * Espelha a regra de PesagensPage.resolveLatestPesagem (tipo 'lote', maior data,
 * desempate por id) para não haver dois cálculos divergentes.
 */
export function pesoMedioAtualDoLote(db, loteId, fallback = 0) {
  const pesagens = Array.isArray(db?.pesagens) ? db.pesagens : [];
  const doLote = pesagens
    .filter((p) => toNumber(p?.lote_id) === toNumber(loteId)
      && p?.tipo !== 'animal' && p?.origem !== 'animal'
      && Number.isFinite(Number(p?.peso_medio))
      && toDateKey(p?.data))
    .map((p) => ({ data: toDateKey(p.data), peso: Number(p.peso_medio), id: toNumber(p.id) }))
    .sort((a, b) => (a.data !== b.data ? b.data.localeCompare(a.data) : b.id - a.id));
  return doLote.length > 0 ? doLote[0].peso : fallback;
}

export const calcLote = (db, loteId, referenceDate = new Date().toISOString().slice(0, 10)) => {
  // Garante que as coleções são arrays para evitar erros
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const custos = Array.isArray(db?.custos) ? db.custos : [];

  const lote = lotes.find((item) => toNumber(item.id) === toNumber(loteId));

  // Se o lote não for encontrado, retorna valores padrão ou lança um erro
  if (!lote) {
    console.warn(`Lote com ID ${loteId} não encontrado.`);
    return {
      lote: null,
      totalAnimais: 0,
      totalCustos: 0,
      dias: 0,
      costByCategory: {},
      gmdMacho: 0,
      gmdFemea: 0,
      gmdMedio: 0,
      qtdMachos: 0,
      qtdFemeas: 0,
      custoPorArroba: 0,
      custoPorCabeca: 0,
      pesoInicialMedio: 0,
      pesoAtualMedio: 0,
      arrobasProduzidas: 0,
      arrobasCarcaca: 0,
      receitaProjetada: 0,
      margemProjetada: 0,
      consumoSuplementoDia: 0,
      diasEstoque: 0,
      custoSuplementoCabDia: 0,
    };
  }

  const animaisDoLote = animais.filter(
    (item) => toNumber(item.lote_id) === toNumber(loteId) && isAnimalAtivo(item)
  );
  const custosDoLote = custos.filter((item) => toNumber(item.lote_id) === toNumber(loteId));

  const totalAnimais = animaisDoLote.reduce((sum, item) => sum + toNonNegativeNumber(item.qtd), 0);
  const totalCustos = custosDoLote.reduce((sum, item) => sum + toNumber(item.val), 0);
  const machos = animaisDoLote.filter((item) => item.sexo === 'macho');
  const femeas = animaisDoLote.filter((item) => item.sexo === 'fêmea');

  const costByCategory = {
    alimentacao: custosDoLote.filter((item) => item.cat === 'alimentação').reduce((sum, item) => sum + toNumber(item.val), 0),
    sanitario: custosDoLote.filter((item) => item.cat === 'sanitário').reduce((sum, item) => sum + toNumber(item.val), 0),
    outros: custosDoLote.filter((item) => item.cat === 'outros').reduce((sum, item) => sum + toNumber(item.val), 0),
  };

  // Calcula o GMD (Ganho Médio Diário) para uma lista de animais.
  // F-03: usa dias dinâmicos a partir de data_entrada do animal ou entrada do lote;
  // cai para item.dias apenas quando nenhuma data estiver disponível.
  const calcGmd = (list) => {
    const quantity = list.reduce((sum, item) => sum + toNumber(item.qtd), 0);
    if (!quantity) return 0;
    const totalGainPerDay = list.reduce((sum, item) => {
      const gain = toNumber(item.p_at) - toNumber(item.p_ini);
      const dataEntrada = item.data_entrada || lote.entrada;
      const days = dataEntrada
        ? Math.max(calcularDiasNoLote(dataEntrada, referenceDate), 1)
        : Math.max(toNumber(item.dias), 1);
      return sum + (gain / days) * toNumber(item.qtd);
    }, 0);
    return totalGainPerDay / quantity;
  };

  // F-07: usa calcularArrobasProduzidas (indicadores.js) em vez de fórmula inline duplicada
  const arrobasProduzidas = animaisDoLote.reduce(
    (sum, item) => sum + calcularArrobasProduzidas(toNumber(item.p_ini), toNumber(item.p_at), toNonNegativeNumber(item.qtd)),
    0
  );
  // F-03: dias médio ponderado calculado dinamicamente pelas datas reais
  const dias = totalAnimais
    ? safeDivide(
        animaisDoLote.reduce((sum, item) => {
          const dataEntrada = item.data_entrada || lote.entrada;
          const daysAnimal = dataEntrada
            ? calcularDiasNoLote(dataEntrada, referenceDate)
            : toNumber(item.dias);
          return sum + daysAnimal * toNonNegativeNumber(item.qtd);
        }, 0),
        totalAnimais
      )
    : 0;

  const pesoInicialMedio = totalAnimais
    ? animaisDoLote.reduce((sum, item) => sum + toNumber(item.p_ini) * toNumber(item.qtd), 0) / totalAnimais
    : 0;
  // Peso de entrada / dos animais (fallback), depois a pesagem mais recente.
  const pesoAtualDeAnimais = totalAnimais
    ? animaisDoLote.reduce((sum, item) => sum + toNumber(item.p_at) * toNumber(item.qtd), 0) / totalAnimais
    : 0;
  // 3.3/3.4/3.5: peso atual segue a pesagem de lote válida mais recente; sem ela,
  // usa o peso dos animais. Uma fonte única para Lotes, Detalhes, Dashboard etc.
  const pesoAtualMedio = pesoMedioAtualDoLote(db, loteId, pesoAtualDeAnimais);

  const rendimentoCarcaca = toNumber(lote.rendimento_carcaca || 52) / 100;
  const precoArroba = toNumber(lote.preco_arroba || 270);
  const arrobasCarcaca = (totalAnimais * pesoAtualMedio * rendimentoCarcaca) / 15;
  // Projeção (NÃO oficial): receita/margem estimadas pelo peso atual x preço-alvo da arroba.
  // O resultado financeiro realizado vem de getResumoLote/calcularResultadoLote.
  const investimento = toNumber(lote.investimento || 0);
  const receitaProjetada = arrobasCarcaca * precoArroba;
  const margemProjetada = receitaProjetada - (totalCustos + investimento);

  const percentualPv = toNumber(lote.supl_pv_pct || 0);
  const consumoSuplementoDia = totalAnimais * (pesoAtualMedio * percentualPv / 100);
  const diasEstoque = consumoSuplementoDia > 0 ? toNumber(lote.supl_estoque_kg || 0) / consumoSuplementoDia : 999;
  const custoSuplementoCabDia = (toNumber(lote.supl_rkg || 0) * (pesoAtualMedio * percentualPv / 100)) / 100;
  const gmdMedio = calcGmd(animaisDoLote);

  return {
    lote,
    totalAnimais,
    totalCustos,
    dias,
    costByCategory,
    gmdMacho: calcGmd(machos),
    gmdFemea: calcGmd(femeas),
    gmdMedio,
    qtdMachos: machos.reduce((sum, item) => sum + toNumber(item.qtd), 0),
    qtdFemeas: femeas.reduce((sum, item) => sum + toNumber(item.qtd), 0),
    custoPorArroba: arrobasProduzidas ? totalCustos / arrobasProduzidas : 0,
    custoPorCabeca: totalAnimais ? totalCustos / totalAnimais : 0,
    pesoInicialMedio,
    pesoAtualMedio,
    arrobasProduzidas,
    arrobasCarcaca,
    // Projeção estimada (não oficial) — use getResumoLote para o financeiro realizado:
    receitaProjetada,
    margemProjetada,
    consumoSuplementoDia,
    diasEstoque,
    custoSuplementoCabDia,
  };
};

/**
 * Calcula e retorna uma lista de alertas com base nos dados do banco de dados.
 * @param {object} db - O objeto do banco de dados.
 * @returns {Array<object>} Uma lista de objetos de alerta.
 */
export const computeAlerts = (db) => {
  const alerts = [];

  // Garante que as coleções são arrays para evitar erros
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const sanitario = Array.isArray(db?.sanitario) ? db.sanitario : [];

  // Cria um Map para lookup eficiente de lotes
  const lotesMap = new Map(lotes.map(item => [toNumber(item.id), item]));

  lotes.forEach((lote) => {
    const indicators = calcLote(db, lote.id);

    // Alerta: GMD abaixo da meta
    if (indicators.totalAnimais > 0 && lote.gmd_meta && indicators.gmdMedio < toNumber(lote.gmd_meta) * 0.9) {
      alerts.push({
        level: 'crit',
        title: `GMD abaixo da meta — ${lote.nome}`,
        description: `Atual: ${formatNumber(indicators.gmdMedio, 3)} kg/dia · Meta: ${formatNumber(toNumber(lote.gmd_meta), 3)} kg/dia`,
      });
    }

    // Alerta: Suplemento crítico (menos de 7 dias de estoque)
    if (indicators.diasEstoque < 7) {
      alerts.push({
        level: 'crit',
        title: `Suplemento crítico — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias`,
      });
    }
    // Alerta: Suplemento baixo (abaixo da meta de dias)
    else if (indicators.diasEstoque < toNumber(lote.supl_meta_dias)) {
      alerts.push({
        level: 'warn',
        title: `Suplemento baixo — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias · Meta: ${toNumber(lote.supl_meta_dias)} dias`,
      });
    }

    // Alerta: Lote próximo do abate (saída em até 15 dias)
    const daysToExit = daysDiff(lote.saida);
    if (daysToExit >= 0 && daysToExit <= 15) {
      alerts.push({
        level: 'warn',
        title: `Lote próximo do abate — ${lote.nome}`,
        description: `Saída prevista em ${daysToExit} dias (${formatDate(lote.saida)})`,
      });
    }

    // Alerta: Margem projetada negativa — usa custo real de movimentacoes_financeiras
    // para que o alerta seja consistente com o painel financeiro do lote.
    if (indicators.totalAnimais > 0) {
      const custoReal = calcularCustoLote(db, lote.id).custoTotal;
      const margemProjetadaReal = indicators.receitaProjetada - custoReal;
      if (margemProjetadaReal < 0) {
        alerts.push({
          level: 'crit',
          title: `Margem projetada negativa — ${lote.nome}`,
          description: `Prejuízo estimado de ${formatCurrency(Math.abs(margemProjetadaReal))}`,
        });
      }
    }
  });

  sanitario.forEach((item) => {
    const lote = lotesMap.get(toNumber(item.lote_id));
    const days = daysDiff(item.proxima);
    const loteNome = lote ? lote.nome : 'Lote';

    // Alerta: Manejo sanitário atrasado
    if (days < 0) {
      alerts.push({
        level: 'crit',
        title: `Manejo atrasado — ${item.desc || 'Manejo'} · ${loteNome}`,
        description: `Previsto para ${formatDate(item.proxima)} (${Math.abs(days)} dias atrás)`,
      });
    }
    // Alerta: Manejo sanitário próximo (em até 7 dias)
    else if (days <= 7) {
      alerts.push({
        level: 'warn',
        title: `Manejo em ${days} dias — ${item.desc || 'Manejo'} · ${loteNome}`,
        description: `Previsto para ${formatDate(item.proxima)}`,
      });
    }
  });

  return alerts;
};
