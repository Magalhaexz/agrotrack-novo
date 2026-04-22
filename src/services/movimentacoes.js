import { gerarNovoId } from '../utils/id';
import { TIPOS_SAIDA_ANIMAL } from '../utils/constantes';
import { registrarAuditoria } from './auditoria';

/**
 * Converte um valor para número, tratando nulos/indefinidos como 0.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  return Number(value || 0);
}

/**
 * Obtém o resumo de quantidade e peso médio atual de um lote.
 * @param {object} db - O objeto do banco de dados.
 * @param {number} loteId - O ID do lote.
 * @returns {{qtdAtual: number, pesoMedioAtual: number}} O resumo do lote.
 */
function obterResumoLote(db, loteId) {
  // Assume que db.animais contém os registros de animais por lote,
  // e que a quantidade e peso_atual de cada registro representam um grupo de animais.
  // Se db.animais for uma lista de animais individuais, a lógica precisaria ser ajustada.
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

/**
 * Atualiza um objeto de lote com nova quantidade e peso médio.
 * @param {object} lote - O objeto do lote original.
 * @param {number} qtdAtual - A nova quantidade de animais.
 * @param {number} pesoMedioAtual - O novo peso médio dos animais.
 * @returns {object} Um novo objeto de lote atualizado.
 */
function atualizarLoteComResumo(lote, qtdAtual, pesoMedioAtual) {
  return {
    ...lote,
    qtd: qtdAtual,
    p_at: pesoMedioAtual,
  };
}

/**
 * Registra a entrada de animais em um lote.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} dados - Dados da entrada: { loteId, qtd, pesoMedio, valorTotal, data, fornecedor, obs }.
 * @param {object} [userContext={}] - Contexto do usuário para auditoria.
 * @returns {object} Um novo objeto de banco de dados com a entrada registrada.
 */
export function registrarEntradaAnimal(
  db,
  { loteId, qtd, pesoMedio, valorTotal, data, fornecedor, obs },
  userContext = {}
) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const loteExiste = lotes.some((item) => Number(item.id) === Number(loteId));
  if (!loteExiste) {
    console.warn(`Lote com ID ${loteId} não encontrado para entrada de animais.`);
    return db; // Retorna o DB original se o lote não existe
  }

  const quantidade = toNumber(qtd);
  const peso = toNumber(pesoMedio);
  const valor = toNumber(valorTotal);

  if (quantidade <= 0 || peso <= 0 || valor < 0) {
    console.warn('Dados de entrada de animais inválidos (quantidade, peso ou valor).');
    return db; // Retorna o DB original se os dados são inválidos
  }

  const movimentosAnimais = Array.isArray(db?.movimentacoes_animais)
    ? db.movimentacoes_animais
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  // Obtém o resumo atual do lote para calcular o novo peso médio ponderado
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
        tipo: 'compra', // Tipo de movimentação de animal
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
        descricao: `Compra de ${quantidade} animal(is) para o lote ${loteId}`,
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
    criticidade: 'media',
  });
}

/**
 * Registra a saída de animais de um lote.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} dados - Dados da saída: { loteId, qtd, pesoMedio, valorTotal, data, tipoSaida, comprador, obs }.
 * @param {object} [userContext={}] - Contexto do usuário para auditoria.
 * @returns {object} Um novo objeto de banco de dados com a saída registrada.
 * @throws {Error} Se a quantidade de saída excede a quantidade atual no lote.
 */
export function registrarSaidaAnimal(
  db,
  { loteId, qtd, pesoMedio, valorTotal, data, tipoSaida, comprador, obs },
  userContext = {}
) {
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((item) => Number(item.id) === Number(loteId));
  if (!lote) {
    console.warn(`Lote com ID ${loteId} não encontrado para saída de animais.`);
    return db;
  }

  const quantidade = toNumber(qtd);
  const peso = toNumber(pesoMedio);
  const valor = toNumber(valorTotal);

  if (quantidade <= 0 || peso <= 0) {
    console.warn('Dados de saída de animais inválidos (quantidade ou peso).');
    return db;
  }

  const movimentosAnimais = Array.isArray(db?.movimentacoes_animais)
    ? db.movimentacoes_animais
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const { qtdAtual, pesoMedioAtual } = obterResumoLote(db, loteId);
  if (quantidade > qtdAtual) {
    throw new Error(
      `Quantidade de saída (${quantidade}) excede a quantidade atual no lote (${qtdAtual}).`
    );
  }

  const novaQtd = qtdAtual - quantidade;
  // Recalcula o peso médio. Se a nova quantidade for 0, o peso médio também é 0.
  const novoPesoMedio = novaQtd
    ? (qtdAtual * pesoMedioAtual - quantidade * peso) / novaQtd
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
        tipo: tipoSaida,
        qtd: quantidade,
        peso_medio: peso,
        valor_total: valor,
        // Para saída, custo_por_cabeca pode ser o preço de venda ou o custo de abate/descarte
        custo_por_cabeca: quantidade > 0 ? valor / quantidade : 0,
        data,
        comprador_fornecedor: comprador || '',
        obs: obs || '',
      },
    ],
    lotes: lotes.map((l) =>
      Number(l.id) === Number(loteId)
        ? atualizarLoteComResumo(l, novaQtd, novoPesoMedio)
        : l
    ),
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      // Adiciona movimentação financeira apenas se for uma venda
      ...(tipoSaida === TIPOS_SAIDA_ANIMAL.VENDA
        ? [
            {
              id: novoMovFinanceiroId,
              tipo: 'receita',
              categoria: 'venda_animal',
              lote_id: Number(loteId),
              valor,
              data,
              descricao: `Venda de ${quantidade} animal(is) do lote ${loteId}`,
              origem_tipo: 'movimentacao_animal',
              origem_id: novoMovAnimalId,
            },
          ]
        : []),
    ],
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'saida_animal',
    entidade: 'movimentacoes_animais',
    entidade_id: novoMovAnimalId,
    descricao: `Saída (${tipoSaida}) de ${quantidade} animal(is) do lote ${Number(loteId)}`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade:
      tipoSaida === TIPOS_SAIDA_ANIMAL.MORTE ||
      tipoSaida === TIPOS_SAIDA_ANIMAL.DESCARTE
        ? 'alta'
        : 'media',
  });
}

/**
 * Registra a entrada de itens no estoque.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} dados - Dados da entrada: { itemId, qtd, custo, data, fornecedor, obs }.
 * @param {object} [userContext={}] - Contexto do usuário para auditoria.
 * @returns {object} Um novo objeto de banco de dados com a entrada registrada.
 */
export function registrarEntradaEstoque(
  db,
  { itemId, qtd, custo, data, fornecedor, obs },
  userContext = {}
) {
  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  if (!item) {
    console.warn(`Item de estoque com ID ${itemId} não encontrado para entrada.`);
    return db;
  }

  const quantidade = toNumber(qtd);
  const custoUnitario = toNumber(custo);

  if (quantidade <= 0 || custoUnitario < 0) {
    console.warn('Dados de entrada de estoque inválidos (quantidade ou custo).');
    return db;
  }

  const movimentosEstoque = Array.isArray(db?.movimentacoes_estoque)
    ? db.movimentacoes_estoque
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const novoMovEstoqueId = gerarNovoId(movimentosEstoque);
  const novoMovFinanceiroId = gerarNovoId(movimentosFinanceiros);
  const valorTotal = quantidade * custoUnitario;

  const baseAtualizada = {
    ...db,
    movimentacoes_estoque: [
      ...movimentosEstoque,
      {
        id: novoMovEstoqueId,
        item_estoque_id: Number(itemId),
        lote_id: null, // Entrada de estoque geralmente não tem lote associado diretamente
        tipo: 'entrada',
        quantidade: quantidade,
        custo_unit: custoUnitario,
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
            quantidade_atual: toNumber(entry.quantidade_atual) + quantidade,
            // Atualiza o valor unitário com o custo da última entrada.
            // Para um sistema mais robusto, considerar custo médio ponderado.
            valor_unitario: custoUnitario,
          }
        : entry
    ),
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      {
        id: novoMovFinanceiroId,
        tipo: 'despesa',
        categoria: 'compra_estoque',
        lote_id: null, // Entrada de estoque geralmente não tem lote associado diretamente
        valor: valorTotal,
        data,
        descricao: `Entrada de estoque: ${item.produto || 'Item'} (${quantidade})`,
        origem_tipo: 'movimentacao_estoque',
        origem_id: novoMovEstoqueId,
      },
    ],
  };

  return registrarAuditoria(baseAtualizada, {
    acao: 'entrada_estoque',
    entidade: 'movimentacoes_estoque',
    entidade_id: novoMovEstoqueId,
    descricao: `Entrada de estoque do item ${item.produto || 'Item'} (${quantidade})`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: 'media',
  });
}

/**
 * Registra a saída de itens do estoque.
 *
 * @param {object} db - O objeto do banco de dados atual.
 * @param {object} dados - Dados da saída: { itemId, loteId, quantidade, tipo = 'consumo', data, obs }.
 * @param {object} [userContext={}] - Contexto do usuário para auditoria.
 * @returns {object} Um novo objeto de banco de dados com a saída registrada.
 * @throws {Error} Se a quantidade de saída excede o saldo disponível.
 */
export function registrarSaidaEstoque(
  db,
  { itemId, loteId, quantidade, tipo = 'consumo', data, obs },
  userContext = {}
) {
  const tiposValidos = ['consumo', 'ajuste', 'perda', 'venda']; // Adicionado 'venda' como tipo válido
  if (!tiposValidos.includes(tipo)) {
    console.warn(`Tipo de saída de estoque inválido: ${tipo}.`);
    return db;
  }

  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  if (!item) {
    console.warn(`Item de estoque com ID ${itemId} não encontrado para saída.`);
    return db;
  }

  const qtd = toNumber(quantidade);
  if (qtd <= 0) {
    console.warn('Quantidade de saída de estoque inválida (deve ser maior que zero).');
    return db;
  }

  const saldoAtual = toNumber(item.quantidade_atual);
  if (qtd > saldoAtual) {
    throw new Error(
      `Saldo insuficiente. Disponível: ${saldoAtual} ${item?.unidade || ''}`.trim()
    );
  }

  const movimentosEstoque = Array.isArray(db?.movimentacoes_estoque)
    ? db.movimentacoes_estoque
    : [];
  const movimentosFinanceiros = Array.isArray(db?.movimentacoes_financeiras)
    ? db.movimentacoes_financeiras
    : [];

  const novoMovEstoqueId = gerarNovoId(movimentosEstoque);
  const custoUnit = toNumber(item.valor_unitario); // Custo unitário do item no estoque
  const valorTotalSaida = qtd * custoUnit;

  const baseAtualizada = {
    ...db,
    movimentacoes_estoque: [
      ...movimentosEstoque,
      {
        id: novoMovEstoqueId,
        item_estoque_id: Number(itemId),
        lote_id: loteId ? Number(loteId) : null, // Lote associado, se houver
        tipo,
        quantidade: qtd,
        custo_unit: custoUnit,
        valor_total: valorTotalSaida,
        data,
        obs: obs || '',
      },
    ],
    estoque: estoque.map((entry) =>
      Number(entry.id) === Number(itemId)
        ? { ...entry, quantidade_atual: saldoAtual - qtd }
        : entry
    ),
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      // Adiciona movimentação financeira se for consumo ou venda
      ...(tipo === 'consumo' && loteId
        ? [
            {
              id: gerarNovoId(movimentosFinanceiros), // Novo ID para mov financeira
              tipo: 'despesa',
              categoria: 'consumo_estoque', // Nova categoria para consumo de estoque
              lote_id: Number(loteId),
              valor: valorTotalSaida,
              data,
              descricao: `Consumo de ${item.produto || 'Item'} para o lote ${loteId}`,
              origem_tipo: 'movimentacao_estoque',
              origem_id: novoMovEstoqueId,
            },
          ]
        : []),
      ...(tipo === 'venda'
        ? [
            {
              id: gerarNovoId(movimentosFinanceiros), // Novo ID para mov financeira
              tipo: 'receita',
              categoria: 'venda_estoque', // Nova categoria para venda de estoque
              lote_id: loteId ? Number(loteId) : null, // Pode ter lote associado ou não
              valor: valorTotalSaida, // Valor de venda, que pode ser diferente do custo
              data,
              descricao: `Venda de ${item.produto || 'Item'} (${qtd})`,
              origem_tipo: 'movimentacao_estoque',
              origem_id: novoMovEstoqueId,
            },
          ]
        : []),
    ],
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
