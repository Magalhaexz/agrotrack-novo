import { gerarNovoId } from '../utils/id.js';
import { registrarAuditoria } from './auditoria.js';
import {
  createOperationalRecord,
  persistCollectionMutation,
  updateOperationalRecord,
} from './operationalPersistence.js';

function persistirComAviso(mutations, context = {}) {
  const {
    persist = true,
    session = null,
    onWarning,
    onError,
  } = context || {};
  if (!persist || !session?.user?.id) return;

  void persistCollectionMutation(mutations).then((result) => {
    if (!result?.persisted && typeof onWarning === 'function') {
      onWarning('Alguns registros precisam de revisão.');
    }
  }).catch((error) => {
    if (typeof onError === 'function') {
      onError(error);
      return;
    }
    if (typeof onWarning === 'function') {
      onWarning(error?.message || 'Não foi possível concluir a operação agora.');
    }
  });
}

/**
 * Converte um valor para número, tratando nulos/indefinidos como 0.
 * @param {*} value - O valor a ser convertido.
 * @returns {number} O valor numérico.
 */
function toNumber(value) {
  return Number(value || 0);
}

function pickFirstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function ensureFiniteNumber(value, fieldName, { min = -Infinity, required = true } = {}) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) {
    if (!required && (value === undefined || value === null || value === '')) {
      return null;
    }
    throw new Error(`Valor inválido para ${fieldName}.`);
  }
  if (normalized < min) {
    throw new Error(`Valor inválido para ${fieldName}.`);
  }
  return normalized;
}

function normalizeAnimalMovementPayload(rawDados = {}, { movementType }) {
  const loteIdRaw = pickFirstDefined(rawDados.loteId, rawDados.lote_id);
  const quantidadeRaw = pickFirstDefined(rawDados.qtd, rawDados.quantidade);
  const pesoMedioRaw = pickFirstDefined(rawDados.pesoMedio, rawDados.peso_medio);
  const valorTotalRaw = pickFirstDefined(
    rawDados.valorTotal,
    rawDados.valor_total,
    rawDados.custo_total
  );
  const tipoSaidaRaw = pickFirstDefined(rawDados.tipoSaida, rawDados.tipo);
  const tipoEntradaRaw = pickFirstDefined(rawDados.tipo, rawDados.tipoEntrada);
  const observacaoRaw = pickFirstDefined(rawDados.observacao, rawDados.obs);
  const destinoLoteIdRaw = pickFirstDefined(rawDados.destinoLoteId, rawDados.destino_lote_id, rawDados.lote_destino);

  const loteId = ensureFiniteNumber(loteIdRaw, 'lote', { min: 1 });
  const qtd = ensureFiniteNumber(quantidadeRaw, 'quantidade', { min: 0.0000001 });
  const pesoMedio = ensureFiniteNumber(pesoMedioRaw, 'peso médio', { min: 0.0000001 });
  const valorTotal = ensureFiniteNumber(valorTotalRaw, 'valor total', { min: 0 });

  const data = String(rawDados.data || '').trim();
  if (!data) {
    throw new Error('Data é obrigatória.');
  }

  const tipoSaida = movementType === 'saida'
    ? String(tipoSaidaRaw || '').trim().toLowerCase()
    : '';

  if (movementType === 'saida' && !tipoSaida) {
    throw new Error('Tipo de saída é obrigatório.');
  }

  const destinoLoteId = destinoLoteIdRaw !== undefined && destinoLoteIdRaw !== null && destinoLoteIdRaw !== ''
    ? ensureFiniteNumber(destinoLoteIdRaw, 'lote destino', { min: 1 })
    : null;

  return {
    loteId,
    qtd,
    pesoMedio,
    valorTotal,
    data,
    fornecedor: String(rawDados.fornecedor || '').trim(),
    comprador: String(rawDados.comprador || '').trim(),
    obs: String(observacaoRaw || '').trim(),
    tipoSaida,
    tipoEntrada: String(tipoEntradaRaw || '').trim().toLowerCase(),
    destinoLoteId,
  };
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

  const qtdRegistrada = registrosLote.reduce((acc, item) => acc + toNumber(item.qtd), 0);
  const pesoMedioAtual = qtdRegistrada
    ? registrosLote.reduce(
        (acc, item) => acc + toNumber(item.p_at) * toNumber(item.qtd),
        0
      ) / qtdRegistrada
    : 0;

  // Seção 8 (auditoria lote.qtd): o SALDO usado para validar/decrementar em
  // vendas, mortes e transferências segue lote.qtd quando definido — fonte
  // canônica (Parte 1.3). Sem isso, um Ajuste de lotação (que só atualiza
  // lote.qtd, não animais.qtd) era ignorado ao validar a próxima venda/morte/
  // transferência, permitindo saldo negativo real mesmo com a checagem
  // "quantidade > qtdAtual" no lugar. O peso médio continua vindo dos
  // registros de animais — é a única fonte com esse detalhe, e a MÉDIA não
  // muda de escala mesmo quando o total canônico diverge do total registrado.
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((item) => Number(item.id) === Number(loteId));
  const qtdAtual = lote?.qtd != null ? toNumber(lote.qtd) : qtdRegistrada;

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

function ehRegistroIndividual(animal) {
  return String(animal?.tipo_registro || '').toLowerCase() === 'individual';
}

/**
 * Sincroniza os registros "grupo" de `animais` (a linha agregada por lote, com
 * seu próprio `qtd`/`p_at`) com o novo saldo/peso do LOTE após uma venda,
 * morte, transferência ou entrada.
 *
 * Bug corrigido (P0): venda/morte/transferência só atualizavam `lote.qtd`
 * (fonte canônica para o SALDO, usada por `calcLote`/`LotesPage`). A própria
 * linha de `animais` (lida diretamente por `AnimaisPage` — resumo "Total de
 * cabeças" e a aba "Grupos") nunca era tocada, então animais vendidos
 * continuavam aparecendo ali com a quantidade antiga, inclusive após reload
 * (o valor problemático estava persistido, não só desatualizado em memória).
 *
 * Registros `tipo_registro: 'individual'` (rastreio cabeça a cabeça, com seu
 * próprio ciclo de vida em `AnimaisPage`/`AnimalMovementModal`) nunca são
 * tocados aqui — só a(s) linha(s) "grupo" do lote.
 *
 * `novoPesoMedio` é opcional: omitido/`null` preserva o `p_at` de cada linha
 * (usado pelo Ajuste de Lotação em `LotesPage.jsx`, que corrige só a
 * contagem — "não altera peso médio", ver `lotesLogic.js::buildAjusteLotacaoPatch`).
 */
export function sincronizarAnimaisGrupoDoLote(animais, loteId, novaQtd, novoPesoMedio = null) {
  const lista = Array.isArray(animais) ? animais : [];
  const grupoDoLote = lista.filter((a) => Number(a.lote_id) === Number(loteId) && !ehRegistroIndividual(a));
  if (grupoDoLote.length === 0) return lista;

  const totalAtual = grupoDoLote.reduce((acc, a) => acc + toNumber(a.qtd), 0);
  return lista.map((a) => {
    if (Number(a.lote_id) !== Number(loteId) || ehRegistroIndividual(a)) return a;
    // Caso comum: uma única linha "grupo" por lote → recebe o valor exato.
    // Múltiplas linhas (raro): distribui proporcionalmente à participação atual.
    const parte = totalAtual > 0 ? toNumber(a.qtd) / totalAtual : 1 / grupoDoLote.length;
    return { ...a, qtd: Math.max(Math.round(novaQtd * parte), 0), p_at: novoPesoMedio == null ? a.p_at : novoPesoMedio };
  });
}

/** Mutações de persistência para as linhas "grupo" de `animais` de um lote (após sincronizadas). */
export function mutationsAnimaisDoLote(animaisSincronizados, loteId, session) {
  return (Array.isArray(animaisSincronizados) ? animaisSincronizados : [])
    .filter((a) => Number(a.lote_id) === Number(loteId) && !ehRegistroIndividual(a))
    .map((a) => updateOperationalRecord('animais', a.id, { qtd: a.qtd, p_at: a.p_at }, session));
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
  dados,
  userContext = {},
  persistContext = {}
) {
  const {
    loteId,
    qtd,
    pesoMedio,
    valorTotal,
    data,
    fornecedor,
    obs,
    tipoEntrada,
  } = normalizeAnimalMovementPayload(dados, { movementType: 'entrada' });
  const tipoMovimentoEntrada = ['compra', 'nascimento', 'transferencia_entrada'].includes(tipoEntrada)
    ? tipoEntrada
    : 'compra';

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const loteExiste = lotes.some((item) => Number(item.id) === Number(loteId));
  if (!loteExiste) {
    throw new Error(`Lote ${loteId} não encontrado para entrada de animais.`);
  }

  const quantidade = qtd;
  const peso = pesoMedio;
  const valor = valorTotal;

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
  const animaisSincronizados = sincronizarAnimaisGrupoDoLote(db?.animais, loteId, novaQtd, novoPesoMedio);

  const baseAtualizada = {
    ...db,
    movimentacoes_animais: [
      ...movimentosAnimais,
      {
        id: novoMovAnimalId,
        lote_id: Number(loteId),
        tipo: tipoMovimentoEntrada,
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
    animais: animaisSincronizados,
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      ...(tipoMovimentoEntrada === 'compra' && valor > 0
        ? [{
            id: novoMovFinanceiroId,
            tipo: 'despesa',
            categoria: 'compra_animal',
            lote_id: Number(loteId),
            valor,
            data,
            data_competencia: data,
            status: 'realizado',
            descricao: `Compra de ${quantidade} animal(is) para o lote ${loteId}`,
            origem_tipo: 'movimentacao_animal',
            origem_id: novoMovAnimalId,
          }]
        : []),
    ],
  };

  const loteAtualizado = baseAtualizada.lotes.find((item) => Number(item.id) === Number(loteId));
  const movAnimalCriado = baseAtualizada.movimentacoes_animais[baseAtualizada.movimentacoes_animais.length - 1];
  const movFinanceiraCriada = tipoMovimentoEntrada === 'compra'
    ? baseAtualizada.movimentacoes_financeiras[baseAtualizada.movimentacoes_financeiras.length - 1]
    : null;
  const mutations = [
    createOperationalRecord('movimentacoes_animais', {
      ...movAnimalCriado,
      id: undefined,
    }, persistContext.session),
    updateOperationalRecord('lotes', loteId, {
      qtd: loteAtualizado?.qtd || 0,
      p_at: loteAtualizado?.p_at || 0,
    }, persistContext.session),
    ...mutationsAnimaisDoLote(animaisSincronizados, loteId, persistContext.session),
  ];
  if (movFinanceiraCriada?.tipo === 'despesa') {
    mutations.push(createOperationalRecord('movimentacoes_financeiras', {
      ...movFinanceiraCriada,
      id: undefined,
    }, persistContext.session));
  }
  persistirComAviso(mutations, { ...persistContext, source: 'entrada_animal' });

  return registrarAuditoria(baseAtualizada, {
    acao: 'entrada_animal',
    entidade: 'movimentacoes_animais',
    entidade_id: novoMovAnimalId,
    descricao: `Entrada de ${quantidade} animal(is) no lote ${Number(loteId)}`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: 'media',
  }, persistContext);
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
  dados,
  userContext = {},
  persistContext = {}
) {
  const {
    loteId,
    qtd,
    pesoMedio,
    valorTotal,
    data,
    tipoSaida,
    destinoLoteId,
    comprador,
    obs,
  } = normalizeAnimalMovementPayload(dados, { movementType: 'saida' });

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((item) => Number(item.id) === Number(loteId));
  if (!lote) {
    throw new Error(`Lote ${loteId} não encontrado para saída de animais.`);
  }
  if (tipoSaida === 'transferencia_saida') {
    if (!destinoLoteId) {
      throw new Error('Transferência de saída exige lote de destino válido.');
    }
    if (Number(destinoLoteId) === Number(loteId)) {
      throw new Error('Lote de origem e destino devem ser diferentes na transferência.');
    }
    const loteDestinoExiste = lotes.some((item) => Number(item.id) === Number(destinoLoteId));
    if (!loteDestinoExiste) {
      throw new Error(`Lote de destino ${destinoLoteId} não encontrado para transferência.`);
    }
  }

  const quantidade = qtd;
  const peso = pesoMedio;
  const valor = valorTotal;

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

  let lotesAtualizados = lotes.map((l) =>
    Number(l.id) === Number(loteId)
      ? atualizarLoteComResumo(l, novaQtd, novoPesoMedio)
      : l
  );
  let animaisSincronizados = sincronizarAnimaisGrupoDoLote(db?.animais, loteId, novaQtd, novoPesoMedio);
  if (tipoSaida === 'transferencia_saida' && destinoLoteId) {
    const { qtdAtual: qtdDestinoAtual, pesoMedioAtual: pesoDestinoAtual } = obterResumoLote(db, destinoLoteId);
    const novaQtdDestino = qtdDestinoAtual + quantidade;
    const novoPesoDestino = novaQtdDestino
      ? (qtdDestinoAtual * pesoDestinoAtual + quantidade * peso) / novaQtdDestino
      : peso;
    lotesAtualizados = lotesAtualizados.map((l) =>
      Number(l.id) === Number(destinoLoteId)
        ? atualizarLoteComResumo(l, novaQtdDestino, novoPesoDestino)
        : l
    );
    animaisSincronizados = sincronizarAnimaisGrupoDoLote(animaisSincronizados, destinoLoteId, novaQtdDestino, novoPesoDestino);
  }

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
    lotes: lotesAtualizados,
    animais: animaisSincronizados,
    movimentacoes_financeiras: [
      ...movimentosFinanceiros,
      // Adiciona movimentação financeira para venda ou abate com valor
      ...((tipoSaida === 'venda' || tipoSaida === 'abate') && valor > 0
        ? [
            {
              id: novoMovFinanceiroId,
              tipo: 'receita',
              categoria: tipoSaida === 'abate' ? 'abate_animal' : 'venda_animal',
              lote_id: Number(loteId),
              valor,
              data,
              data_competencia: data,
              status: 'realizado',
              descricao: `${tipoSaida === 'abate' ? 'Abate' : 'Venda'} de ${quantidade} animal(is) do lote ${loteId}`,
              origem_tipo: 'movimentacao_animal',
              origem_id: novoMovAnimalId,
            },
          ]
        : []),
    ],
  };

  const loteAtualizado = baseAtualizada.lotes.find((item) => Number(item.id) === Number(loteId));
  const movAnimalCriado = baseAtualizada.movimentacoes_animais[baseAtualizada.movimentacoes_animais.length - 1];
  const mutations = [
    createOperationalRecord('movimentacoes_animais', {
      ...movAnimalCriado,
      id: undefined,
    }, persistContext.session),
    updateOperationalRecord('lotes', loteId, {
      qtd: loteAtualizado?.qtd || 0,
      p_at: loteAtualizado?.p_at || 0,
    }, persistContext.session),
    ...mutationsAnimaisDoLote(animaisSincronizados, loteId, persistContext.session),
  ];
  if ((tipoSaida === 'venda' || tipoSaida === 'abate') && valor > 0) {
    const movFinanceiraCriada = baseAtualizada.movimentacoes_financeiras[baseAtualizada.movimentacoes_financeiras.length - 1];
    if (movFinanceiraCriada?.tipo === 'receita') {
      mutations.push(createOperationalRecord('movimentacoes_financeiras', {
        ...movFinanceiraCriada,
        id: undefined,
      }, persistContext.session));
    }
  }
  if (tipoSaida === 'transferencia_saida' && destinoLoteId) {
    const loteDestino = baseAtualizada.lotes.find((item) => Number(item.id) === Number(destinoLoteId));
    if (loteDestino) {
      mutations.push(updateOperationalRecord('lotes', destinoLoteId, {
        qtd: loteDestino?.qtd || 0,
        p_at: loteDestino?.p_at || 0,
      }, persistContext.session));
      mutations.push(...mutationsAnimaisDoLote(animaisSincronizados, destinoLoteId, persistContext.session));
    }
  }
  persistirComAviso(mutations, { ...persistContext, source: 'saida_animal' });

  return registrarAuditoria(baseAtualizada, {
    acao: 'saida_animal',
    entidade: 'movimentacoes_animais',
    entidade_id: novoMovAnimalId,
    descricao: `Saída (${tipoSaida}) de ${quantidade} animal(is) do lote ${Number(loteId)}`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade:
      tipoSaida === 'morte' ||
      tipoSaida === 'descarte'
        ? 'alta'
        : 'media',
  }, persistContext);
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
  userContext = {},
  persistContext = {}
) {
  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  // Nunca falha silenciosamente (P0 da auditoria 360º): antes devolvia `db`
  // inalterado com um `console.warn`, e quem chamava fechava o modal como se
  // tivesse dado certo. Agora lança, e o modal (EstoquePage.jsx) mostra o erro
  // e mantém o formulário aberto.
  if (!item) {
    throw new Error(`Item de estoque não encontrado.`);
  }

  const quantidade = toNumber(qtd);
  const custoUnitario = toNumber(custo);
  if (quantidade <= 0) {
    throw new Error('Informe uma quantidade válida.');
  }
  if (custoUnitario < 0) {
    throw new Error('Informe um custo unitário válido.');
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
        custo_unitario: custoUnitario,
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
        lote_id: null,
        valor: valorTotal,
        data,
        data_competencia: data,
        status: 'realizado',
        descricao: `Entrada de estoque: ${item.produto || 'Item'} (${quantidade})`,
        origem_tipo: 'movimentacao_estoque',
        origem_id: novoMovEstoqueId,
      },
    ],
  };

  const movEstoqueCriado = baseAtualizada.movimentacoes_estoque[baseAtualizada.movimentacoes_estoque.length - 1];
  const movFinanceiraCriada = baseAtualizada.movimentacoes_financeiras[baseAtualizada.movimentacoes_financeiras.length - 1];
  const itemAtualizado = baseAtualizada.estoque.find((entry) => Number(entry.id) === Number(itemId));
  persistirComAviso([
    createOperationalRecord('movimentacoes_estoque', { ...movEstoqueCriado, id: undefined }, persistContext.session),
    updateOperationalRecord('estoque', itemId, {
      quantidade_atual: itemAtualizado?.quantidade_atual ?? 0,
      valor_unitario: itemAtualizado?.valor_unitario ?? 0,
    }, persistContext.session),
    createOperationalRecord('movimentacoes_financeiras', { ...movFinanceiraCriada, id: undefined }, persistContext.session),
  ], { ...persistContext, source: 'entrada_estoque' });

  return registrarAuditoria(baseAtualizada, {
    acao: 'entrada_estoque',
    entidade: 'movimentacoes_estoque',
    entidade_id: novoMovEstoqueId,
    descricao: `Entrada de estoque do item ${item.produto || 'Item'} (${quantidade})`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: 'media',
  }, persistContext);
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
  userContext = {},
  persistContext = {}
) {
  // Enum canônico das saídas de estoque (auditoria 360º, EST-01): a UI
  // (EstoquePage.jsx) só pode oferecer tipos que existem aqui — "tratamento"
  // foi adicionado porque o formulário já o oferecia sem o serviço reconhecer,
  // e a chamada falhava silenciosamente (`console.warn` + `db` inalterado,
  // com o modal fechando como se tivesse dado certo). Nunca mais falha
  // silenciosamente: tipo/item/quantidade inválidos agora lançam erro, e quem
  // chama (EstoquePage.jsx) mostra a mensagem e mantém o formulário aberto.
  const tiposValidos = ['consumo', 'tratamento', 'ajuste', 'perda', 'venda'];
  if (!tiposValidos.includes(tipo)) {
    throw new Error(`Tipo de saída inválido: ${tipo}.`);
  }

  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(itemId));
  if (!item) {
    throw new Error('Item de estoque não encontrado.');
  }

  const qtd = toNumber(quantidade);
  if (qtd <= 0) {
    throw new Error('Informe uma quantidade válida.');
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
        custo_unitario: custoUnit,
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
      // Consumo e tratamento geram despesa quando vinculados a um lote
      // (ajuste/perda são correções internas, sem lançamento financeiro).
      ...((tipo === 'consumo' || tipo === 'tratamento') && loteId
        ? [
            {
              id: gerarNovoId(movimentosFinanceiros),
              tipo: 'despesa',
              categoria: tipo === 'tratamento' ? 'tratamento_sanitario' : 'consumo_estoque',
              lote_id: Number(loteId),
              valor: valorTotalSaida,
              data,
              data_competencia: data,
              status: 'realizado',
              descricao: tipo === 'tratamento'
                ? `Tratamento com ${item.produto || 'Item'} no lote ${loteId}`
                : `Consumo de ${item.produto || 'Item'} para o lote ${loteId}`,
              origem_tipo: 'movimentacao_estoque',
              origem_id: novoMovEstoqueId,
            },
          ]
        : []),
      ...(tipo === 'venda'
        ? [
            {
              id: gerarNovoId(movimentosFinanceiros),
              tipo: 'receita',
              categoria: 'venda_estoque',
              lote_id: loteId ? Number(loteId) : null,
              valor: valorTotalSaida,
              data,
              data_competencia: data,
              status: 'realizado',
              descricao: `Venda de ${item.produto || 'Item'} (${qtd})`,
              origem_tipo: 'movimentacao_estoque',
              origem_id: novoMovEstoqueId,
            },
          ]
        : []),
    ],
  };

  const movEstoqueCriado = baseAtualizada.movimentacoes_estoque[baseAtualizada.movimentacoes_estoque.length - 1];
  const movFinanceiraCriada = baseAtualizada.movimentacoes_financeiras.length > movimentosFinanceiros.length
    ? baseAtualizada.movimentacoes_financeiras[baseAtualizada.movimentacoes_financeiras.length - 1]
    : null;
  const itemAtualizado = baseAtualizada.estoque.find((entry) => Number(entry.id) === Number(itemId));
  const mutationsSaida = [
    createOperationalRecord('movimentacoes_estoque', { ...movEstoqueCriado, id: undefined }, persistContext.session),
    updateOperationalRecord('estoque', itemId, {
      quantidade_atual: itemAtualizado?.quantidade_atual ?? 0,
    }, persistContext.session),
  ];
  if (movFinanceiraCriada) {
    mutationsSaida.push(createOperationalRecord('movimentacoes_financeiras', { ...movFinanceiraCriada, id: undefined }, persistContext.session));
  }
  persistirComAviso(mutationsSaida, { ...persistContext, source: 'saida_estoque' });

  return registrarAuditoria(baseAtualizada, {
    acao: 'saida_estoque',
    entidade: 'movimentacoes_estoque',
    entidade_id: novoMovEstoqueId,
    descricao: `Saída (${tipo}) de estoque do item ${item.produto || 'Item'} (${qtd})`,
    ator_id: userContext?.id || null,
    ator_email: userContext?.email || '',
    criticidade: tipo === 'perda' ? 'alta' : 'media',
  }, persistContext);
}
