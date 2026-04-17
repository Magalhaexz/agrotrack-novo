export const formatNumber = (value, digits = 1) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const formatCurrency = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

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
  const custoTotalLote = totalCustos + investimento;
  const margem = receitaTotal - custoTotalLote;
  const margemPct = receitaTotal ? (margem / receitaTotal) * 100 : 0;

  const percentualPv = lote?.supl_pv_pct || 0;
  const consumoSuplementoDia = totalAnimais * (pesoAtualMedio * percentualPv / 100);
  const diasEstoque = consumoSuplementoDia > 0 ? (lote?.supl_estoque_kg || 0) / consumoSuplementoDia : 999;
  const custoSuplementoCabDia = (lote?.supl_rkg || 0) * (pesoAtualMedio * percentualPv / 100) / 100;
  const gmdMedio = totalAnimais
    ? animais.reduce((sum, item) => sum + ((item.p_at - item.p_ini) / Math.max(item.dias, 1)) * item.qtd, 0) / totalAnimais
    : 0;

  return {
    lote,
    totalAnimais,
    totalCustos,
    dias,
    costByCategory,
    gmdMacho: calcGmd(machos),
    gmdFemea: calcGmd(femeas),
    gmdMedio,
    qtdMachos: machos.reduce((sum, item) => sum + item.qtd, 0),
    qtdFemeas: femeas.reduce((sum, item) => sum + item.qtd, 0),
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

    if (indicators.diasEstoque < 7) {
      alerts.push({
        level: 'crit',
        title: `Suplemento crítico — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias`,
      });
    } else if (indicators.diasEstoque < lote.supl_meta_dias) {
      alerts.push({
        level: 'warn',
        title: `Suplemento baixo — ${lote.nome}`,
        description: `Estoque para ${formatNumber(indicators.diasEstoque, 0)} dias · Meta: ${lote.supl_meta_dias} dias`,
      });
    }

    const daysToExit = daysDiff(lote.saida);
    if (daysToExit >= 0 && daysToExit <= 15) {
      alerts.push({
        level: 'warn',
        title: `Lote próximo do abate — ${lote.nome}`,
        description: `Saída prevista em ${daysToExit} dias (${formatDate(lote.saida)})`,
      });
    }

    if (indicators.totalAnimais > 0 && indicators.margem < 0) {
      alerts.push({
        level: 'crit',
        title: `Margem negativa — ${lote.nome}`,
        description: `Prejuízo estimado de ${formatCurrency(Math.abs(indicators.margem))}`,
      });
    }
  });

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
        description: `Previsto para ${formatDate(item.proxima)}`,
      });
    }
  });

  return alerts;
};
