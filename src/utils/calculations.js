<<<<<<< HEAD
/**
 * Formata um número para exibição com um número específico de casas decimais, usando o locale pt-BR.
 * Retorna '—' para valores indefinidos, nulos ou não numéricos.
 * @param {number} value - O número a ser formatado.
 * @param {number} [digits=1] - O número de casas decimais.
 * @returns {string} O número formatado ou '—'.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export const formatNumber = (value, digits = 1) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

<<<<<<< HEAD
/**
 * Formata um número como moeda brasileira (R$), com 2 casas decimais.
 * Retorna '—' para valores indefinidos, nulos ou não numéricos.
 * @param {number} value - O valor monetário a ser formatado.
 * @returns {string} O valor formatado como moeda ou '—'.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export const formatCurrency = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

<<<<<<< HEAD
/**
 * Formata uma string de data (YYYY-MM-DD) para o formato brasileiro (DD/MM/YYYY).
 * Retorna '—' para valores nulos ou vazios.
 * @param {string} value - A string de data.
 * @returns {string} A data formatada ou '—'.
 */
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export const formatDate = (value) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

<<<<<<< HEAD
/**
 * Calcula a diferença em dias entre uma data alvo e a data atual.
 * Retorna 999 para strings de data nulas ou vazias.
 * @param {string} dateStr - A string de data alvo (YYYY-MM-DD).
 * @returns {number} A diferença em dias.
 */
export const daysDiff = (dateStr) => {
  if (!dateStr) return 999; // Consider returning null or throwing an error for clearer handling
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Zera a hora para comparação de dias
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0); // Zera a hora para comparação de dias
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Converte um valor para número, tratando valores nulos/indefinidos como 0.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
const toNumber = (value) => Number(value || 0);

/**
 * Calcula diversos indicadores financeiros e de desempenho para um lote específico.
 * @param {object} db - O objeto do banco de dados.
 * @param {string|number} loteId - O ID do lote.
 * @returns {object} Um objeto contendo os indicadores calculados para o lote.
 */
export const calcLote = (db, loteId) => {
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
      receitaTotal: 0,
      receitaPorCabeca: 0,
      investimento: 0,
      custoTotalLote: 0,
      margem: 0,
      margemPct: 0,
      consumoSuplementoDia: 0,
      diasEstoque: 0,
      custoSuplementoCabDia: 0,
    };
  }

  const animaisDoLote = animais.filter((item) => toNumber(item.lote_id) === toNumber(loteId));
  const custosDoLote = custos.filter((item) => toNumber(item.lote_id) === toNumber(loteId));

  const totalAnimais = animaisDoLote.reduce((sum, item) => sum + toNumber(item.qtd), 0);
  const totalCustos = custosDoLote.reduce((sum, item) => sum + toNumber(item.val), 0);
  const machos = animaisDoLote.filter((item) => item.sexo === 'macho');
  const femeas = animaisDoLote.filter((item) => item.sexo === 'fêmea');

  const costByCategory = {
    alimentacao: custosDoLote.filter((item) => item.cat === 'alimentação').reduce((sum, item) => sum + toNumber(item.val), 0),
    sanitario: custosDoLote.filter((item) => item.cat === 'sanitário').reduce((sum, item) => sum + toNumber(item.val), 0),
    outros: custosDoLote.filter((item) => item.cat === 'outros').reduce((sum, item) => sum + toNumber(item.val), 0),
  };

  // Calcula o GMD (Ganho Médio Diário) para uma lista de animais
  const calcGmd = (list) => {
    const quantity = list.reduce((sum, item) => sum + toNumber(item.qtd), 0);
    if (!quantity) return 0;
    // Soma o ganho total de peso dividido pelos dias para cada animal, ponderado pela quantidade
    const totalGainPerDay = list.reduce((sum, item) => {
      const gain = toNumber(item.p_at) - toNumber(item.p_ini);
      const days = Math.max(toNumber(item.dias), 1); // Evita divisão por zero
      return sum + (gain / days) * toNumber(item.qtd);
    }, 0);
    return totalGainPerDay / quantity;
  };

  const gainTotal = animaisDoLote.reduce((sum, item) => sum + (toNumber(item.p_at) - toNumber(item.p_ini)) * toNumber(item.qtd), 0);
  const arrobasProduzidas = gainTotal / 15; // 1 arroba = 15 kg
  const dias = toNumber(animaisDoLote[0]?.dias || 0); // Assume que 'dias' é o mesmo para todos os animais no lote

  const pesoInicialMedio = totalAnimais
    ? animaisDoLote.reduce((sum, item) => sum + toNumber(item.p_ini) * toNumber(item.qtd), 0) / totalAnimais
    : 0;
  const pesoAtualMedio = totalAnimais
    ? animaisDoLote.reduce((sum, item) => sum + toNumber(item.p_at) * toNumber(item.qtd), 0) / totalAnimais
    : 0;

  const rendimentoCarcaca = toNumber(lote.rendimento_carcaca || 52) / 100;
  const precoArroba = toNumber(lote.preco_arroba || 270);
  const arrobasCarcaca = (totalAnimais * pesoAtualMedio * rendimentoCarcaca) / 15;
  const receitaTotal = arrobasCarcaca * precoArroba;
  const receitaPorCabeca = totalAnimais ? receitaTotal / totalAnimais : 0;
  const investimento = toNumber(lote.investimento || 0);
=======
export const daysDiff = (dateStr) => {
  if (!dateStr) return 999;
  const today = new Date();
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
};

export const calcLote = (db, loteId) => {
  const lote = db.lotes.find((item) => item.id === loteId);
  const animais = db.animais.filter((item) => item.lote_id === loteId);
  const custos = db.custos.filter((item) => item.lote_id === loteId);

  const totalAnimais = animais.reduce((sum, item) => sum + item.qtd, 0);
  const totalCustos = custos.reduce((sum, item) => sum + item.val, 0);
  const machos = animais.filter((item) => item.sexo === 'macho');
  const femeas = animais.filter((item) => item.sexo === 'fêmea');

  const costByCategory = {
    alimentacao: custos.filter((item) => item.cat === 'alimentação').reduce((sum, item) => sum + item.val, 0),
    sanitario: custos.filter((item) => item.cat === 'sanitário').reduce((sum, item) => sum + item.val, 0),
    outros: custos.filter((item) => item.cat === 'outros').reduce((sum, item) => sum + item.val, 0),
  };

  const calcGmd = (list) => {
    const quantity = list.reduce((sum, item) => sum + item.qtd, 0);
    if (!quantity) return 0;
    return (
      list.reduce((sum, item) => sum + ((item.p_at - item.p_ini) / Math.max(item.dias, 1)) * item.qtd, 0) /
      quantity
    );
  };

  const gainTotal = animais.reduce((sum, item) => sum + (item.p_at - item.p_ini) * item.qtd, 0);
  const arrobasProduzidas = gainTotal / 15;
  const dias = animais[0]?.dias || 0;
  const pesoInicialMedio = totalAnimais
    ? animais.reduce((sum, item) => sum + item.p_ini * item.qtd, 0) / totalAnimais
    : 0;
  const pesoAtualMedio = totalAnimais
    ? animais.reduce((sum, item) => sum + item.p_at * item.qtd, 0) / totalAnimais
    : 0;

  const rendimentoCarcaca = (lote?.rendimento_carcaca || 52) / 100;
  const precoArroba = lote?.preco_arroba || 270;
  const arrobasCarcaca = totalAnimais * pesoAtualMedio * rendimentoCarcaca / 15;
  const receitaTotal = arrobasCarcaca * precoArroba;
  const receitaPorCabeca = totalAnimais ? receitaTotal / totalAnimais : 0;
  const investimento = lote?.investimento || 0;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const custoTotalLote = totalCustos + investimento;
  const margem = receitaTotal - custoTotalLote;
  const margemPct = receitaTotal ? (margem / receitaTotal) * 100 : 0;

<<<<<<< HEAD
  const percentualPv = toNumber(lote.supl_pv_pct || 0);
  const consumoSuplementoDia = totalAnimais * (pesoAtualMedio * percentualPv / 100);
  const diasEstoque = consumoSuplementoDia > 0 ? toNumber(lote.supl_estoque_kg || 0) / consumoSuplementoDia : 999;
  const custoSuplementoCabDia = (toNumber(lote.supl_rkg || 0) * (pesoAtualMedio * percentualPv / 100)) / 100;
  const gmdMedio = calcGmd(animaisDoLote);
=======
  const percentualPv = lote?.supl_pv_pct || 0;
  const consumoSuplementoDia = totalAnimais * (pesoAtualMedio * percentualPv / 100);
  const diasEstoque = consumoSuplementoDia > 0 ? (lote?.supl_estoque_kg || 0) / consumoSuplementoDia : 999;
  const custoSuplementoCabDia = (lote?.supl_rkg || 0) * (pesoAtualMedio * percentualPv / 100) / 100;
  const gmdMedio = totalAnimais
    ? animais.reduce((sum, item) => sum + ((item.p_at - item.p_ini) / Math.max(item.dias, 1)) * item.qtd, 0) / totalAnimais
    : 0;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  return {
    lote,
    totalAnimais,
    totalCustos,
    dias,
    costByCategory,
    gmdMacho: calcGmd(machos),
    gmdFemea: calcGmd(femeas),
    gmdMedio,
<<<<<<< HEAD
    qtdMachos: machos.reduce((sum, item) => sum + toNumber(item.qtd), 0),
    qtdFemeas: femeas.reduce((sum, item) => sum + toNumber(item.qtd), 0),
=======
    qtdMachos: machos.reduce((sum, item) => sum + item.qtd, 0),
    qtdFemeas: femeas.reduce((sum, item) => sum + item.qtd, 0),
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    custoPorArroba: arrobasProduzidas ? totalCustos / arrobasProduzidas : 0,
    custoPorCabeca: totalAnimais ? totalCustos / totalAnimais : 0,
    pesoInicialMedio,
    pesoAtualMedio,
    arrobasProduzidas,
    arrobasCarcaca,
    receitaTotal,
    receitaPorCabeca,
    investimento,
    custoTotalLote,
    margem,
    margemPct,
    consumoSuplementoDia,
    diasEstoque,
    custoSuplementoCabDia,
  };
};

<<<<<<< HEAD
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
=======
export const computeAlerts = (db) => {
  const alerts = [];

  db.lotes.forEach((lote) => {
    const indicators = calcLote(db, lote.id);

    if (indicators.totalAnimais > 0 && lote.gmd_meta && indicators.gmdMedio < lote.gmd_meta * 0.9) {
      alerts.push({
        level: 'crit',
        title: `GMD abaixo da meta — ${lote.nome}`,
        description: `Atual: ${formatNumber(indicators.gmdMedio, 3)} kg/dia · Meta: ${formatNumber(lote.gmd_meta, 3)} kg/dia`,
      });
    }

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    if (indicators.diasEstoque < 7) {
      alerts.push({
        level: 'crit',
        title: `Suplemento crítico — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias`,
      });
<<<<<<< HEAD
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
=======
    } else if (indicators.diasEstoque < lote.supl_meta_dias) {
      alerts.push({
        level: 'warn',
        title: `Suplemento baixo — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias · Meta: ${lote.supl_meta_dias} dias`,
      });
    }

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    const daysToExit = daysDiff(lote.saida);
    if (daysToExit >= 0 && daysToExit <= 15) {
      alerts.push({
        level: 'warn',
        title: `Lote próximo do abate — ${lote.nome}`,
        description: `Saída prevista em ${daysToExit} dias (${formatDate(lote.saida)})`,
      });
    }

<<<<<<< HEAD
    // Alerta: Margem negativa
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    if (indicators.totalAnimais > 0 && indicators.margem < 0) {
      alerts.push({
        level: 'crit',
        title: `Margem negativa — ${lote.nome}`,
        description: `Prejuízo estimado de ${formatCurrency(Math.abs(indicators.margem))}`,
      });
    }
  });

<<<<<<< HEAD
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
=======
  db.sanitario.forEach((item) => {
    const lote = db.lotes.find((entry) => entry.id === item.lote_id);
    const days = daysDiff(item.proxima);
    const loteNome = lote ? lote.nome : 'Lote';

    if (days < 0) {
      alerts.push({
        level: 'crit',
        title: `Manejo atrasado — ${item.desc} · ${loteNome}`,
        description: `Previsto para ${formatDate(item.proxima)} (${Math.abs(days)} dias atrás)`,
      });
    } else if (days <= 7) {
      alerts.push({
        level: 'warn',
        title: `Manejo em ${days} dias — ${item.desc} · ${loteNome}`,
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        description: `Previsto para ${formatDate(item.proxima)}`,
      });
    }
  });

  return alerts;
<<<<<<< HEAD
};
=======
};
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
