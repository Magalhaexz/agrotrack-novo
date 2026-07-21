// Integridade Sanidade → Estoque (Sprint 15). Puro, sem I/O: calcula quanto
// baixar/devolver de um item de estoque quando um registro sanitário é
// criado, editado ou excluído, e monta o objeto de movimentação pronto para
// persistência. A decisão de I/O (ler saldo real, gravar) fica em
// `services/estoqueSanidade.js`.
//
// Modelo adotado (Sprint 15, ver docs/SPRINT15_INTEGRIDADE_ESTOQUE_SANIDADE.md):
// reaproveita `movimentacoes_estoque` (já existe, com `origem`/`origem_tipo`/
// `origem_id` genéricos — mesmo padrão já usado por `movimentacoes_animais`/
// `movimentacoes_financeiras`) em vez de criar tabela nova. `quantidade_utilizada`
// (quantidade de produto consumida, distinta de `sanitario.qtd` = cabeças
// atendidas) fica em `sanitario.metadata`, ao lado de `item_estoque_id` —
// mesmo padrão já usado ali, sem exigir migration.
import { obterSaldoItemEstoque } from './estoque.js';

const MOTIVO_BLOQUEIO = {
  SALDO_INSUFICIENTE: 'saldo_insuficiente',
};

const MOTIVO_NAO_BAIXA = {
  SEM_PRODUTO: 'sem_produto',
  SEM_QUANTIDADE: 'sem_quantidade',
  SEM_ALTERACAO: 'sem_alteracao',
};

function normalizarQuantidade(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizarSaldo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve o saldo atual de um item de estoque, aceitando as variações de
 * nome de campo já usadas no projeto (mesma prioridade de
 * `EstoquePage.jsx`'s `getCurrentItemStockBalance`, reaproveitada aqui como
 * função pura testável).
 */
export function obterSaldoAtualItemEstoque(item) {
  // Sprint 5: delega para a fonte única (domain/estoque.js). Esta função
  // testava oito nomes de campo, começando por `saldo`, `saldoAtual` e
  // `saldo_atual` — nenhum dos três existe na tabela `estoque` (verificado no
  // schema de produção), então um objeto em memória que carregasse `saldo`
  // vencia a coluna real `quantidade_atual`. Medido no mesmo item: 55 aqui
  // contra 30 no Relatório de Estoque e na Nutrição.
  return obterSaldoItemEstoque(item);
}

/**
 * Calcula a baixa de estoque necessária para UMA aplicação sanitária ligada a
 * UM produto, considerando a quantidade já baixada anteriormente (0 para
 * registro novo). Nunca lança erro, nunca retorna NaN/Infinity.
 *
 * `quantidadeBaixar`: positivo = consumir do estoque; negativo = devolver
 * (a quantidade aplicada diminuiu numa edição); 0 = nada a fazer.
 */
export function calcularBaixaSanitaria({ quantidadeAplicada, quantidadeAnterior = 0, saldoAtual } = {}) {
  const aplicada = normalizarQuantidade(quantidadeAplicada);
  const anterior = normalizarQuantidade(quantidadeAnterior);
  const saldo = normalizarSaldo(saldoAtual);
  const delta = aplicada - anterior;

  if (delta === 0) {
    return { quantidadeBaixar: 0, saldoProjetado: saldo, podeBaixar: true, motivoBloqueio: null, ajusteNecessario: false };
  }

  if (delta < 0) {
    // Devolução: quantidade aplicada caiu numa edição — nunca bloqueia por
    // saldo, porque estamos aumentando o saldo, não consumindo.
    return { quantidadeBaixar: delta, saldoProjetado: saldo - delta, podeBaixar: true, motivoBloqueio: null, ajusteNecessario: true };
  }

  const saldoProjetado = saldo - delta;
  if (saldoProjetado < 0) {
    return {
      quantidadeBaixar: delta,
      saldoProjetado: saldo,
      podeBaixar: false,
      motivoBloqueio: MOTIVO_BLOQUEIO.SALDO_INSUFICIENTE,
      ajusteNecessario: false,
    };
  }
  return { quantidadeBaixar: delta, saldoProjetado, podeBaixar: true, motivoBloqueio: null, ajusteNecessario: false };
}

/**
 * Gate de mais alto nível: decide SE uma baixa deve ser tentada (há produto
 * vinculado e há quantidade/alteração de quantidade) e, quando sim, delega o
 * cálculo para `calcularBaixaSanitaria`. Registros sanitários sem produto
 * vinculado continuam funcionando normalmente — `deveBaixar` só fica `true`
 * quando faz sentido mexer no estoque.
 */
export function validarBaixaEstoqueSanidade({ produtoId, quantidadeAplicada, quantidadeAnterior = 0, saldoAtual } = {}) {
  if (!produtoId) {
    return {
      deveBaixar: false,
      motivo: MOTIVO_NAO_BAIXA.SEM_PRODUTO,
      quantidadeBaixar: 0,
      saldoProjetado: normalizarSaldo(saldoAtual),
      podeBaixar: true,
      motivoBloqueio: null,
      ajusteNecessario: false,
    };
  }

  const calculo = calcularBaixaSanitaria({ quantidadeAplicada, quantidadeAnterior, saldoAtual });
  if (calculo.quantidadeBaixar === 0) {
    const motivo = normalizarQuantidade(quantidadeAnterior) > 0
      ? MOTIVO_NAO_BAIXA.SEM_ALTERACAO
      : MOTIVO_NAO_BAIXA.SEM_QUANTIDADE;
    return { deveBaixar: false, motivo, ...calculo };
  }

  return { deveBaixar: true, motivo: null, ...calculo };
}

/**
 * Monta o registro de `movimentacoes_estoque` para uma baixa/devolução
 * sanitária, pronto para `createOperationalRecord` (que já injeta
 * `owner_user_id` a partir da sessão — não incluído aqui). `quantidade` pode
 * ser negativa (devolução); o objeto sempre guarda a magnitude positiva com
 * `tipo` indicando a direção, para caber nos tipos já aceitos por
 * `services/movimentacoes.js` (`consumo`/`ajuste`).
 */
export function montarMovimentacaoEstoqueSanidade({ sanitarioId, produtoId, loteId, quantidade, data } = {}) {
  const magnitude = Math.abs(Number(quantidade) || 0);
  const ehDevolucao = Number(quantidade) < 0;
  return {
    item_estoque_id: produtoId ?? null,
    lote_id: loteId ?? null,
    tipo: ehDevolucao ? 'ajuste' : 'consumo',
    quantidade: magnitude,
    data: data || null,
    origem: 'sanidade',
    origem_tipo: 'sanitario',
    origem_id: sanitarioId ?? null,
    obs: ehDevolucao
      ? 'Devolução por redução de quantidade aplicada (edição de manejo sanitário).'
      : 'Baixa automática por aplicação sanitária.',
  };
}

/**
 * Novo saldo do item de estoque após aplicar `quantidadeBaixar` (positivo
 * consome, negativo devolve). Nunca retorna negativo/NaN.
 */
export function aplicarBaixaAoSaldo(saldoAtual, quantidadeBaixar) {
  const resultado = normalizarSaldo(saldoAtual) - (Number(quantidadeBaixar) || 0);
  return Number.isFinite(resultado) ? Math.max(0, resultado) : 0;
}

export { MOTIVO_BLOQUEIO, MOTIVO_NAO_BAIXA };
