// ─────────────────────────────────────────────────────────────────────────────
// SAÍDA DE LOTE (VENDA / MORTE) — CAMINHO TRANSACIONAL ÚNICO DO APP WEB.
//
// Sprint 3. Antes desta sprint, venda e morte no app web gravavam por chamadas
// sequenciais (`registrarSaidaAnimal` em services/movimentacoes.js): movimentação,
// baixa do lote, sincronização de `animais` e lançamento financeiro iam ao banco
// em requisições separadas, sem transação, validadas apenas contra o `db`
// carregado no navegador. Duas abas viam o mesmo saldo, ambas passavam na
// validação local e ambas gravavam — o lote podia terminar negativo. E se a
// movimentação gravasse mas o financeiro falhasse, o estado ficava pela metade.
//
// A RPC `registrar_saida_lote` já existia e já era usada pelo bot do Telegram.
// Ela faz `SELECT … FOR UPDATE` no lote, revalida saldo/status no servidor e
// grava movimentação + baixa + sincronização de `animais` + financeiro NA MESMA
// TRANSAÇÃO. Este módulo passa o app web a usá-la, fechando a assimetria
// registrada em docs/MATRIZ_INDICADORES_HERDON.md.
//
// DIVERGÊNCIA ACEITA E MEDIDA (decisão da Sprint 3): a RPC **não** recalcula
// `lotes.p_at` da origem. O caminho antigo do web recalculava
// (`(qtdAtual×pesoAtual − qtdSaída×pesoSaída) / qtdRestante`). Adotamos o
// comportamento da RPC — mesma regra do bot, uma fonte só — em vez de fazer um
// UPDATE extra fora da transação, que reintroduziria exatamente a gravação
// sequencial que esta sprint remove. Consequência: vender os animais mais
// pesados não baixa mais a média do lote na hora; a correção vem da próxima
// pesagem. Ver `acoesLote.js` ("remover à média não muda a média da origem").
//
// CONTRATO: nada do estado local é alterado antes de a RPC confirmar. O módulo
// devolve `{ ok: false, erro }` ou `{ ok: true, aplicar(db) }` — quem chama só
// atualiza a tela depois do `ok`, e o `aplicar` espelha EXATAMENTE o que a
// transação gravou (inclusive os ids devolvidos pela RPC), para que recarregar
// a página não duplique nem divirja do banco.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js';
import { getFriendlyErrorMessage } from './movimentacaoPastos.js';
import { validarBaixaRebanho, loteEstaAtivo } from '../domain/rebanho.js';
import { verificarCarenciaAtivaLote } from '../domain/agendaSanitaria.js';
import { formatarData } from '../utils/formatters.js';
import { registrarAuditoria } from './auditoria.js';
import { sincronizarAnimaisGrupoDoLote } from './movimentacoes.js';

/**
 * Tipos de saída que o app web registra por este caminho transacional.
 * `transferencia_saida` continua em `registrarSaidaAnimal` — migrá-la é uma
 * sprint própria (envolve o lote de destino e a reponderação do peso).
 */
export const TIPOS_SAIDA_TRANSACIONAL = Object.freeze(['venda', 'morte']);

export function usaSaidaTransacional(tipoSaida) {
  return TIPOS_SAIDA_TRANSACIONAL.includes(String(tipoSaida || '').trim().toLowerCase());
}

function toNumeroFinito(valor, campo, { min = -Infinity } = {}) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < min) {
    throw new Error(`Valor inválido para ${campo}.`);
  }
  return numero;
}

function falha(erro) {
  return { ok: false, erro, aplicar: null, ids: null };
}

/**
 * Valida a saída contra o `db` do navegador e monta os parâmetros da RPC.
 * Puro — não toca em rede nem em estado. A validação daqui existe para dar
 * mensagem imediata ao usuário; a garantia real é a revalidação da RPC sob
 * lock (por isso as duas mensagens são equivalentes).
 *
 * @returns {{ok: true, params: object, contexto: object}|{ok: false, erro: string}}
 */
export function planejarSaidaLoteTransacional(db, dados = {}) {
  const tipoSaida = String(dados.tipoSaida || dados.tipo || '').trim().toLowerCase();
  if (!usaSaidaTransacional(tipoSaida)) {
    return { ok: false, erro: `Tipo de saída não suportado neste fluxo: ${tipoSaida || '(vazio)'}.` };
  }

  const data = String(dados.data || '').trim();
  if (!data) return { ok: false, erro: 'Data é obrigatória.' };

  let loteId;
  let qtd;
  let pesoMedio;
  let valorTotal;
  try {
    loteId = toNumeroFinito(dados.loteId ?? dados.lote_id, 'lote', { min: 1 });
    qtd = toNumeroFinito(dados.qtd ?? dados.quantidade, 'quantidade', { min: 0.0000001 });
    pesoMedio = toNumeroFinito(dados.pesoMedio ?? dados.peso_medio, 'peso médio', { min: 0.0000001 });
    // Morte/perda nunca carrega valor: a RPC só lança receita para venda/abate,
    // e mandar valor aqui só criaria expectativa falsa na tela.
    valorTotal = tipoSaida === 'venda'
      ? toNumeroFinito(dados.valorTotal ?? dados.valor_total ?? 0, 'valor total', { min: 0 })
      : 0;
  } catch (error) {
    return { ok: false, erro: error.message };
  }

  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const lote = lotes.find((item) => Number(item.id) === Number(loteId));
  if (!lote) return { ok: false, erro: `Lote ${loteId} não encontrado para saída de animais.` };
  // Mesma regra do `if v_lote.status in ('encerrado','vendido')` da RPC.
  if (!loteEstaAtivo(lote)) {
    return { ok: false, erro: 'Esse lote está finalizado e não aceita novas movimentações.' };
  }

  // Toda venda no HERDON é tratada como destino abate (decisão de produto), por
  // isso a carência sanitária bloqueia venda e não morte.
  if (tipoSaida === 'venda') {
    const { ativa, produto, dataFim } = verificarCarenciaAtivaLote(db?.sanitario, loteId, data);
    if (ativa) {
      return {
        ok: false,
        erro: `Este animal está em período de carência para abate até ${formatarData(dataFim)}, devido ao tratamento com ${produto}. A venda para abate não pode ser concluída antes do término da carência.`,
      };
    }
  }

  const validacao = validarBaixaRebanho(lote, qtd, db?.animais);
  if (!validacao.ok) return { ok: false, erro: validacao.erro };

  const obsInformada = String(dados.observacao ?? dados.obs ?? '').trim();
  // A RPC grava `descricao` do lançamento financeiro a partir de `p_obs`. Sem
  // observação do usuário, mandamos a frase padrão que o fluxo antigo já usava,
  // para o extrato financeiro não sair com descrição vazia.
  const rotulo = tipoSaida === 'venda' ? 'Venda' : 'Morte/perda';
  const obs = obsInformada || `${rotulo} de ${qtd} animal(is) do lote ${loteId}`;
  const comprador = tipoSaida === 'venda' ? String(dados.comprador || '').trim() : '';

  return {
    ok: true,
    params: {
      p_lote_id: loteId,
      p_tipo: tipoSaida,
      p_qtd: qtd,
      p_peso_medio: pesoMedio,
      p_valor_total: valorTotal,
      p_custo_por_cabeca: qtd > 0 ? valorTotal / qtd : 0,
      p_data: data,
      p_comprador_fornecedor: comprador,
      p_obs: obs,
      p_destino_lote_id: null,
      p_peso_destino_final: null,
    },
    contexto: {
      loteId,
      tipoSaida,
      qtd,
      pesoMedio,
      valorTotal,
      data,
      comprador,
      obs,
      // Saldo lido do `db` local só para montar a tela; a fonte do saldo final
      // é a mesma conta que a RPC fez (`lotes.qtd - p_qtd`) sob lock.
      saldoFinal: validacao.saldoFinal,
      geraReceita: tipoSaida === 'venda' && valorTotal > 0,
    },
  };
}

/**
 * Espelha no `db` do navegador exatamente o que a transação gravou.
 * Usa os ids devolvidos pela RPC (e não `gerarNovoId`) para que a linha em
 * memória seja a MESMA linha do banco — recarregar a página não duplica o
 * lançamento financeiro nem a movimentação.
 */
export function aplicarSaidaLoteNoEstadoLocal(db, contexto, ids = {}, ownerUserId = null) {
  const {
    loteId, tipoSaida, qtd, pesoMedio, valorTotal, data, comprador, obs, saldoFinal, geraReceita,
  } = contexto;
  const movimentacaoId = ids?.movimentacaoId ?? null;
  const financeiroId = ids?.financeiroId ?? null;

  const movimentacoesAnimais = Array.isArray(db?.movimentacoes_animais) ? db.movimentacoes_animais : [];
  const movimentacoesFinanceiras = Array.isArray(db?.movimentacoes_financeiras) ? db.movimentacoes_financeiras : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  const movimentacao = {
    id: movimentacaoId,
    owner_user_id: ownerUserId,
    lote_id: loteId,
    destino_lote_id: null,
    tipo: tipoSaida,
    qtd,
    peso_medio: pesoMedio,
    valor_total: valorTotal,
    custo_por_cabeca: qtd > 0 ? valorTotal / qtd : 0,
    data,
    comprador_fornecedor: comprador,
    obs,
  };

  // `p_at` do lote fica intocado de propósito — ver nota de divergência no topo.
  const lotesAtualizados = lotes.map((lote) => (
    Number(lote.id) === Number(loteId) ? { ...lote, qtd: saldoFinal } : lote
  ));
  // Mesma distribuição proporcional que a RPC aplica nas linhas "grupo" de
  // `animais`; `null` no peso preserva `p_at` de cada linha, como no SQL.
  const animaisSincronizados = sincronizarAnimaisGrupoDoLote(db?.animais, loteId, saldoFinal, null);

  const baseAtualizada = {
    ...db,
    lotes: lotesAtualizados,
    animais: animaisSincronizados,
    movimentacoes_animais: [...movimentacoesAnimais, movimentacao],
    movimentacoes_financeiras: geraReceita
      ? [...movimentacoesFinanceiras, {
          id: financeiroId,
          owner_user_id: ownerUserId,
          tipo: 'receita',
          categoria: 'venda_animal',
          lote_id: loteId,
          valor: valorTotal,
          data,
          data_competencia: data,
          status: 'realizado',
          descricao: obs,
          origem_tipo: 'movimentacao_animal',
          origem_id: movimentacaoId,
        }]
      : movimentacoesFinanceiras,
  };

  return baseAtualizada;
}

/**
 * Registra venda ou morte/perda de um lote pela RPC transacional.
 *
 * Nunca lança: devolve `{ ok, erro, aplicar }`. Só chame `aplicar(db)` quando
 * `ok` for `true` — em qualquer falha (validação local, rede, RLS, revalidação
 * do servidor) nada foi gravado e o estado local deve ficar como estava.
 *
 * @param {object} db estado atual do navegador.
 * @param {object} dados { loteId, tipoSaida, qtd, pesoMedio, valorTotal, data, comprador, observacao }.
 * @param {object} opcoes { session, userContext, client, persist } — `client` e
 *   `persist` só existem para teste (mesma convenção de `persistContext.persist`
 *   em services/movimentacoes.js: `persist: false` mantém a auditoria só em
 *   memória, sem tentar gravar na nuvem).
 */
export async function registrarSaidaLoteTransacional(db, dados = {}, opcoes = {}) {
  const {
    session = null, userContext = {}, client = supabase, persist = true,
  } = opcoes;

  const plano = planejarSaidaLoteTransacional(db, dados);
  if (!plano.ok) return falha(plano.erro);

  const ownerUserId = session?.user?.id || null;
  if (!ownerUserId) {
    return falha('Não foi possível confirmar o salvamento agora. Entre novamente e tente outra vez.');
  }

  let resposta;
  try {
    resposta = await client.rpc('registrar_saida_lote', {
      p_owner_user_id: ownerUserId,
      ...plano.params,
    });
  } catch (error) {
    // Exceção de transporte (fetch rejeitado) nunca chega como `{ error }`.
    return falha(getFriendlyErrorMessage(error));
  }

  if (resposta?.error) {
    return falha(getFriendlyErrorMessage(resposta.error));
  }

  // `returns table(movimentacao_id, financeiro_id)` chega como array de linhas.
  const linha = Array.isArray(resposta?.data) ? resposta.data[0] : resposta?.data;
  const ids = {
    movimentacaoId: linha?.movimentacao_id ?? null,
    financeiroId: linha?.financeiro_id ?? null,
  };

  const { contexto } = plano;
  return {
    ok: true,
    erro: null,
    ids,
    aplicar: (estadoAtual) => registrarAuditoria(
      aplicarSaidaLoteNoEstadoLocal(estadoAtual, contexto, ids, ownerUserId),
      {
        acao: 'saida_animal',
        entidade: 'movimentacoes_animais',
        entidade_id: ids.movimentacaoId,
        descricao: `Saída (${contexto.tipoSaida}) de ${contexto.qtd} animal(is) do lote ${contexto.loteId}`,
        ator_id: userContext?.id || null,
        ator_email: userContext?.email || '',
        criticidade: contexto.tipoSaida === 'morte' ? 'alta' : 'media',
      },
      { session: persist ? session : null }
    ),
  };
}
