import { gerarNovoId } from '../utils/id';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { registrarAuditoria } from './auditoria';
function toNumber(value) {
  return Number(value || 0);
}


function obterResumoLote(db, loteId) {
  const animais = Array.isArray(db?.animais) ? db.animais : [];
  const registrosLote = animais.filter((item) => Number(item.lote_id) === Number(loteId));
  const qtdAtual = registrosLote.reduce((acc, item) => acc + toNumber(item.qtd), 0);
  const pesoMedioAtual = qtdAtual
    ? registrosLote.reduce(
        (acc, item) => acc + toNumber(item.p_at) * toNumber(item.qtd),
        0
      ) / qtdAtual
    : 0;

  return { qtdAtual, pesoMedioAtual };
}

function atualizarLoteComResumo(lote, qtdAtual, pesoMedioAtual) {
  return {
    ...lote,
    qtd: qtdAtual,
    p_at: pesoMedioAtual,
  };
}

export function registrarEntradaAnimal(
  db,
  { loteId, qtd, pesoMedio, valorTotal, data, fornecedor, obs },
  userContext = {}
) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const loteExiste = lotes.some((item) => Number(item.id) === Number(loteId));
  if (!loteExiste) return db;

  const quantidade = toNumber(qtd);
  const peso = toNumber(pesoMedio);
  const valor = toNumber(valorTotal);
  if (quantidade <= 0 || peso <= 0 || valor < 0) return db;

  const movimentosAnimais = Array.isArray(db?.movimentacoes_animais)
    ? db.movimentacoes_animais
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const { qtdAtual, pesoMedioAtual } = obterResumoLote(db, loteId);
  const novaQtd = qtdAtual + quantidade;
  const novoPesoMedio = novaQtd
    ? (qtdAtual * pesoMedioAtual + quantidade * peso) / novaQtd
    : 0;

  const novoMovAnimalId = gerarNovoId(movimentosAnimais);
  const novoMovFinanceiroId = gerarNovoId(movimentosFinanceiros);

  const baseAtualizada = {
    ...db,
    movimentacoes_animais: [
      ...movimentosAnimais,
      {
        id: novoMovAnimalId,
        lote_id: Number(loteId),
        tipo: 'compra',
        qtd: quantidade,
        peso_medio: peso,
        valor_total: valor,
        custo_por_cabeca: quantidade > 0 ? valor / quantidade : 0,
        data,
        comprador_fornecedor: fornecedor || '',
        obs: obs || '',
      },
    ],
    lotes: lotes.map((lote) =>
      Number(lote.id) === Number(loteId)
        ? atualizarLoteComResumo(lote, novaQtd, novoPesoMedio)
        : lote
    ),
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      {
        id: novoMovFinanceiroId,
        tipo: 'despesa',
        categoria: 'compra_animal',
        lote_id: Number(loteId),
        valor,
        data,
        descricao: `Compra de ${quantidade} animal(is)`,
        origem_tipo: 'movimentacao_animal',
        origem_id: novoMovAnimalId,
      },
    ],
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'entrada_animal',
    entidade: 'movimentacoes_animais',
    entidade_id: novoMovAnimalId,
    descricao: `Entrada de ${quantidade} animal(is) no lote ${Number(loteId)}`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: 'alta',
  });
}

export function registrarSaidaAnimal(
  db,
  { loteId, qtd, pesoMedio, valorTotal, data, comprador, tipo, obs },
  userContext = {}
) {
  const tiposValidos = Object.keys(TIPOS_SAIDA_ANIMAL);
  if (!tiposValidos.includes(tipo)) return db;

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const loteExiste = lotes.some((item) => Number(item.id) === Number(loteId));
  if (!loteExiste) return db;

  const quantidade = toNumber(qtd);
  const peso = toNumber(pesoMedio);
  const valor = toNumber(valorTotal);
  if (quantidade <= 0 || peso <= 0 || valor < 0) return db;

  const movimentosAnimais = Array.isArray(db?.movimentacoes_animais)
    ? db.movimentacoes_animais
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const { qtdAtual, pesoMedioAtual } = obterResumoLote(db, loteId);
  if (qtdAtual < quantidade) return db;

  const novaQtd = qtdAtual - quantidade;
  const novoPesoMedio =
    novaQtd > 0 ? ((qtdAtual * pesoMedioAtual) - (quantidade * peso)) / novaQtd : 0;

  const novoMovAnimalId = gerarNovoId(movimentosAnimais);
  const novoMovFinanceiroId = gerarNovoId(movimentosFinanceiros);

  const movimentacoesFinanceirasAtualizadas =
    tipo === 'venda'
      ? [
          ...movimentosFinanceiros,
          {
            id: novoMovFinanceiroId,
            tipo: 'receita',
            categoria: 'venda_animal',
            lote_id: Number(loteId),
            valor,
            data,
            descricao: `Venda de ${quantidade} animal(is)`,
            origem_tipo: 'movimentacao_animal',
            origem_id: novoMovAnimalId,
          },
        ]
      : movimentosFinanceiros;

  const baseAtualizada = {
    ...db,
    movimentacoes_animais: [
      ...movimentosAnimais,
      {
        id: novoMovAnimalId,
        lote_id: Number(loteId),
        tipo,
        qtd: quantidade,
        peso_medio: peso,
        valor_total: valor,
        custo_por_cabeca: quantidade > 0 ? valor / quantidade : 0,
        data,
        comprador_fornecedor: comprador || '',
        obs: obs || '',
      },
    ],
    lotes: lotes.map((lote) => {
      if (Number(lote.id) !== Number(loteId)) return lote;

      const loteAtualizado = atualizarLoteComResumo(lote, novaQtd, novoPesoMedio);
      if (novaQtd > 0) return loteAtualizado;

      return {
        ...loteAtualizado,
        status: 'encerrado',
        data_encerramento: data || loteAtualizado.data_encerramento || null,
      };
    }),
    movimentacoes_financeiras: movimentacoesFinanceirasAtualizadas,
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'saida_animal',
    entidade: 'movimentacoes_animais',
    entidade_id: novoMovAnimalId,
    descricao: `Saída (${tipo}) de ${quantidade} animal(is) do lote ${Number(loteId)}`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: tipo === 'venda' ? 'alta' : 'media',
  });
}

export function registrarEntradaEstoque(
  db,
  { itemId, quantidade, custoUnit, data, fornecedor, obs },
  userContext = {}
) {
  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  if (!item) return db;

  const qtd = toNumber(quantidade);
  const custo = toNumber(custoUnit);
  if (qtd <= 0 || custo <= 0) return db;

  const valorTotal = qtd * custo;

  const movimentosEstoque = Array.isArray(db?.movimentacoes_estoque)
    ? db.movimentacoes_estoque
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const novoMovEstoqueId = gerarNovoId(movimentosEstoque);
  const novoMovFinanceiroId = gerarNovoId(movimentosFinanceiros);

  const baseAtualizada = {
    ...db,
    movimentacoes_estoque: [
      ...movimentosEstoque,
      {
        id: novoMovEstoqueId,
        item_estoque_id: Number(itemId),
        lote_id: '',
        tipo: 'entrada',
        quantidade: qtd,
        custo_unit: custo,
        valor_total: valorTotal,
        data,
        obs: [fornecedor ? `Fornecedor: ${fornecedor}` : '', obs || '']
          .filter(Boolean)
          .join(' • '),
      },
    ],
    estoque: estoque.map((entry) =>
      Number(entry.id) === Number(itemId)
        ? {
            ...entry,
            quantidade_atual: toNumber(entry.quantidade_atual) + qtd,
            valor_unitario: custo,
          }
        : entry
    ),
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      {
        id: novoMovFinanceiroId,
        tipo: 'despesa',
        categoria: 'compra_estoque',
        lote_id: '',
        valor: valorTotal,
        data,
        descricao: `Entrada de estoque: ${item.produto || 'Item'}`,
        origem_tipo: 'movimentacao_estoque',
        origem_id: novoMovEstoqueId,
      },
    ],
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'entrada_estoque',
    entidade: 'movimentacoes_estoque',
    entidade_id: novoMovEstoqueId,
    descricao: `Entrada de estoque do item ${item.produto || 'Item'} (${qtd})`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: 'media',
  });
}

export function registrarSaidaEstoque(
  db,
  { itemId, loteId, quantidade, tipo = 'consumo', data, obs },
  userContext = {}
) {
  const tiposValidos = ['consumo', 'ajuste', 'perda'];
  if (!tiposValidos.includes(tipo)) return db;

  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  if (!item) return db;

  const qtd = toNumber(quantidade);
  if (qtd <= 0) return db;

  const saldoAtual = toNumber(item.quantidade_atual);
  if (saldoAtual - qtd < 0) {
    return db;
  }

  const movimentosEstoque = Array.isArray(db?.movimentacoes_estoque)
    ? db.movimentacoes_estoque
    : [];
  const novoMovEstoqueId = gerarNovoId(movimentosEstoque);
  const custoUnit = toNumber(item.valor_unitario);

  const baseAtualizada = {
    ...db,
    movimentacoes_estoque: [
      ...movimentosEstoque,
      {
        id: novoMovEstoqueId,
        item_estoque_id: Number(itemId),
        lote_id: loteId ? Number(loteId) : '',
        tipo,
        quantidade: qtd,
        custo_unit: custoUnit,
        valor_total: qtd * custoUnit,
        data,
        obs: obs || '',
      },
    ],
    estoque: estoque.map((entry) =>
      Number(entry.id) === Number(itemId)
        ? { ...entry, quantidade_atual: saldoAtual - qtd }
        : entry
    ),
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'saida_estoque',
    entidade: 'movimentacoes_estoque',
    entidade_id: novoMovEstoqueId,
    descricao: `Saída (${tipo}) de estoque do item ${item.produto || 'Item'} (${qtd})`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: tipo === 'perda' ? 'alta' : 'media',
  });
}
