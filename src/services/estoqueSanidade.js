// Persistência da integração Sanidade → Estoque (Sprint 15). Orquestra I/O
// (ler saldo real de `db.estoque`, gravar em `estoque`/`movimentacoes_estoque`)
// em cima do domínio puro `domain/estoqueSanidade.js`. Chamado por
// `SanitarioPage.jsx` depois que o registro sanitário já foi criado/editado
// com sucesso — uma falha aqui nunca desfaz o registro sanitário, só avisa.
import { createOperationalRecord, updateOperationalRecord } from './operationalPersistence.js';
import {
  obterSaldoAtualItemEstoque,
  validarBaixaEstoqueSanidade,
  montarMovimentacaoEstoqueSanidade,
  aplicarBaixaAoSaldo,
} from '../domain/estoqueSanidade.js';

async function aplicarMovimentoEstoqueSanidade(db, session, { sanitarioId, produtoId, loteId, quantidadeAplicada, quantidadeAnterior, data }) {
  if (!produtoId) return { aplicado: false, aviso: null, estoquePatch: null, movimentacao: null };

  const estoque = Array.isArray(db?.estoque) ? db.estoque : [];
  const item = estoque.find((entry) => Number(entry.id) === Number(produtoId));
  if (!item) {
    return { aplicado: false, aviso: 'Produto vinculado não foi encontrado no estoque — a baixa não foi aplicada.', estoquePatch: null, movimentacao: null };
  }

  const saldoAtual = obterSaldoAtualItemEstoque(item);
  const validacao = validarBaixaEstoqueSanidade({ produtoId, quantidadeAplicada, quantidadeAnterior, saldoAtual });

  if (!validacao.deveBaixar) return { aplicado: false, aviso: null, estoquePatch: null, movimentacao: null };

  if (!validacao.podeBaixar) {
    const nomeProduto = item.produto || item.nome || 'produto';
    return {
      aplicado: false,
      aviso: `Estoque insuficiente para esta aplicação (${nomeProduto}). O manejo sanitário foi salvo, mas o estoque não foi baixado — ajuste o saldo do produto se necessário.`,
      estoquePatch: null,
      movimentacao: null,
    };
  }

  const novoSaldo = aplicarBaixaAoSaldo(saldoAtual, validacao.quantidadeBaixar);
  const movimentacaoPayload = montarMovimentacaoEstoqueSanidade({
    sanitarioId,
    produtoId,
    loteId,
    quantidade: validacao.quantidadeBaixar,
    data,
  });

  const estoquePersist = await updateOperationalRecord('estoque', Number(produtoId), {
    quantidade_atual: novoSaldo,
    quantidade: novoSaldo,
  }, session);
  const movPersist = await createOperationalRecord('movimentacoes_estoque', movimentacaoPayload, session);

  if (!estoquePersist?.persisted || !movPersist?.persisted) {
    return {
      aplicado: false,
      aviso: 'Não foi possível sincronizar o estoque para esta aplicação agora. Tente novamente em instantes.',
      estoquePatch: null,
      movimentacao: null,
    };
  }

  return {
    aplicado: true,
    aviso: null,
    estoquePatch: { id: Number(produtoId), changes: estoquePersist.data || { quantidade_atual: novoSaldo, quantidade: novoSaldo } },
    movimentacao: movPersist.data || { ...movimentacaoPayload },
  };
}

/**
 * Sincroniza a baixa de estoque de um registro sanitário criado ou editado.
 * Trata os três casos do Etapa 5: mesmo produto (baixa só a diferença),
 * produto trocado (reverte 100% do antigo, baixa 100% do novo) e produto
 * removido (reverte 100% do antigo, nada novo a baixar).
 *
 * Nunca lança erro — devolve avisos para a tela mostrar via toast, e as
 * mudanças já persistidas (`estoquePatches`/`movimentacoes`) para o chamador
 * mesclar no estado local (`setDb`).
 */
export async function sincronizarEstoqueSanidade(db, session, {
  sanitarioId,
  loteId,
  data,
  produtoIdAnterior = null,
  quantidadeAnterior = 0,
  produtoIdNovo = null,
  quantidadeNova = 0,
}) {
  const avisos = [];
  const estoquePatches = [];
  const movimentacoes = [];

  function registrar(resultado) {
    if (resultado.aviso) avisos.push(resultado.aviso);
    if (resultado.aplicado) {
      estoquePatches.push(resultado.estoquePatch);
      movimentacoes.push(resultado.movimentacao);
    }
  }

  const produtoMudou = String(produtoIdAnterior ?? '') !== String(produtoIdNovo ?? '');

  if (produtoMudou) {
    if (produtoIdAnterior && Number(quantidadeAnterior) > 0) {
      registrar(await aplicarMovimentoEstoqueSanidade(db, session, {
        sanitarioId, produtoId: produtoIdAnterior, loteId, quantidadeAplicada: 0, quantidadeAnterior, data,
      }));
    }
    if (produtoIdNovo && Number(quantidadeNova) > 0) {
      registrar(await aplicarMovimentoEstoqueSanidade(db, session, {
        sanitarioId, produtoId: produtoIdNovo, loteId, quantidadeAplicada: quantidadeNova, quantidadeAnterior: 0, data,
      }));
    }
  } else if (produtoIdNovo) {
    registrar(await aplicarMovimentoEstoqueSanidade(db, session, {
      sanitarioId, produtoId: produtoIdNovo, loteId, quantidadeAplicada: quantidadeNova, quantidadeAnterior, data,
    }));
  }

  return { avisos, estoquePatches, movimentacoes };
}

/**
 * Reverte a baixa de estoque de um registro sanitário excluído — devolve
 * 100% do que havia sido consumido para aquele produto.
 */
export async function reverterEstoqueSanidadeExcluido(db, session, { sanitarioId, produtoId, loteId, quantidade, data }) {
  if (!produtoId || !(Number(quantidade) > 0)) {
    return { avisos: [], estoquePatches: [], movimentacoes: [] };
  }
  const resultado = await aplicarMovimentoEstoqueSanidade(db, session, {
    sanitarioId, produtoId, loteId, quantidadeAplicada: 0, quantidadeAnterior: quantidade, data,
  });
  return {
    avisos: resultado.aviso ? [resultado.aviso] : [],
    estoquePatches: resultado.aplicado ? [resultado.estoquePatch] : [],
    movimentacoes: resultado.aplicado ? [resultado.movimentacao] : [],
  };
}
