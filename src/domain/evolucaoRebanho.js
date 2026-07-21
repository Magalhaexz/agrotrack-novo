import { toDateKey, toNonNegativeNumber, toNumber } from './calcHelpers.js';
import { rebanhoAtivo } from './rebanho.js';


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
  if (['abate', 'descarte', 'perda', 'outro'].includes(tipo)) return 'vendas';
  if (tipo === 'morte') return 'mortes';
  if (tipo === 'transferencia_saida') return 'transferencias_saida';
  // Seção 8: Ajuste de lotação (Parte 2) grava movimentacoes_animais tipo
  // 'ajuste' — sem isso, esses eventos eram ignorados (getDeltaEstoque não
  // reconhecia o tipo) e a evolução do rebanho ficava incoerente com
  // lote.qtd sempre que havia um ajuste no período analisado.
  if (tipo === 'ajuste') return 'ajustes';
  return null;
}

function getDeltaEstoque(tipo, qtd) {
  if (['compra', 'nascimento', 'transferencia_entrada'].includes(tipo)) return qtd;
  if (['venda', 'morte', 'descarte', 'abate', 'transferencia_saida', 'transferencia', 'perda', 'outro'].includes(tipo)) return -qtd;
  return 0;
}

export function computeEvolucaoRebanho(db, periodStart, periodEnd) {
  const movimentos = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const startKey = toDateKey(periodStart) || '0000-01-01';
  const endKey = toDateKey(periodEnd) || '9999-12-31';
  const start = startKey <= endKey ? startKey : endKey;
  const end = startKey <= endKey ? endKey : startKey;

  // Fonte única (domain/rebanho.js): soma `lote.qtd` dos lotes ativos. Antes
  // somava `animais[].qtd || 1`, que ignorava o status do lote e contava
  // registro com qtd=0 como 1 — divergindo de Lotes, Pastos e Financeiro.
  const estoqueAtual = rebanhoAtivo(db);

  const resumo = {
    estoque_inicial: 0,
    compras: 0,
    vendas: 0,
    mortes: 0,
    nascimentos: 0,
    transferencias_entrada: 0,
    transferencias_saida: 0,
    ajustes: 0,
    estoque_final: 0,
    variacao_inventario: 0,
  };

  const rows = [];
  let netAfterEnd = 0;
  let netWithin = 0;

  movimentos.forEach((mov) => {
    const data = toDateKey(mov?.data);
    if (!data) return;
    const tipo = normalizeTipo(mov?.tipo);

    // Ajuste de lotação (Seção 2): qtd já é o delta assinado (pode ser
    // negativo) — os demais tipos gravam qtd sempre positiva e o sinal vem
    // do tipo (getDeltaEstoque).
    const ehAjuste = tipo === 'ajuste';
    const qtd = ehAjuste ? Math.abs(toNumber(mov?.qtd)) : toNonNegativeNumber(mov?.qtd);
    if (!qtd) return;

    const delta = ehAjuste ? toNumber(mov?.qtd) : getDeltaEstoque(tipo, qtd);
    if (data > end) {
      netAfterEnd += delta;
      return;
    }
    if (data < start) {
      return;
    }

    netWithin += delta;
    const bucket = getTipoBucket(tipo);
    if (bucket) resumo[bucket] += ehAjuste ? delta : qtd;
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
