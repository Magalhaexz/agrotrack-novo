function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAtivo(animal) {
  const status = String(animal?.status || 'ativo').toLowerCase();
  return !['vendido', 'morte', 'descarte', 'transferencia', 'perda', 'inativo'].includes(status);
}

function normalizeTipo(rawTipo) {
  const tipo = String(rawTipo || '').trim().toLowerCase();
  if (tipo === 'transferencia') return 'transferencia_saida';
  return tipo;
}

function getTipoBucket(tipo) {
  if (tipo === 'compra') return 'compras';
  if (tipo === 'nascimento') return 'nascimentos';
  if (tipo === 'transferencia_entrada') return 'transferencias_entrada';
  if (tipo === 'venda') return 'vendas';
  if (tipo === 'morte') return 'mortes';
  if (tipo === 'transferencia_saida') return 'transferencias_saida';
  return null;
}

function getDeltaEstoque(tipo, qtd) {
  if (['compra', 'nascimento', 'transferencia_entrada'].includes(tipo)) return qtd;
  if (['venda', 'morte', 'descarte', 'abate', 'transferencia_saida', 'transferencia', 'perda', 'outro'].includes(tipo)) return -qtd;
  return 0;
}

function formatDateKey(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function computeEvolucaoRebanho(db, periodStart, periodEnd) {
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const movimentos = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const start = formatDateKey(periodStart);
  const end = formatDateKey(periodEnd);

  const estoqueAtual = animais.reduce((sum, animal) => sum + (isAtivo(animal) ? toNumber(animal?.qtd || 1) : 0), 0);

  const resumo = {
    estoque_inicial: 0,
    compras: 0,
    vendas: 0,
    mortes: 0,
    nascimentos: 0,
    transferencias_entrada: 0,
    transferencias_saida: 0,
    estoque_final: 0,
    variacao_inventario: 0,
  };

  const rows = [];
  let netAfterEnd = 0;
  let netWithin = 0;

  movimentos.forEach((mov) => {
    const data = formatDateKey(mov?.data);
    if (!data) return;
    const tipo = normalizeTipo(mov?.tipo);
    const qtd = Math.max(0, toNumber(mov?.qtd));
    if (!qtd) return;

    const delta = getDeltaEstoque(tipo, qtd);
    if (data > end) {
      netAfterEnd += delta;
      return;
    }
    if (data < start) {
      return;
    }

    netWithin += delta;
    const bucket = getTipoBucket(tipo);
    if (bucket) resumo[bucket] += qtd;
    rows.push({
      id: mov?.id || `${data}-${tipo}-${qtd}`,
      data,
      tipo,
      qtd,
      lote_id: mov?.lote_id ?? null,
      obs: mov?.obs || '',
      comprador_fornecedor: mov?.comprador_fornecedor || '',
      delta,
    });
  });

  const estoqueFinal = estoqueAtual - netAfterEnd;
  const estoqueInicial = estoqueFinal - netWithin;
  resumo.estoque_final = estoqueFinal;
  resumo.estoque_inicial = estoqueInicial;
  resumo.variacao_inventario = estoqueFinal - estoqueInicial;

  return {
    resumo,
    movimentosPeriodo: rows.sort((a, b) => String(a.data).localeCompare(String(b.data))),
  };
}

