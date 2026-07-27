// ─────────────────────────────────────────────────────────────────────────────
// PESAGEM INDIVIDUAL POR CABEÇA — CAMINHO TRANSACIONAL ÚNICO (Sprint Funcional
// 15, revisão crítica pré-commit).
//
// O primeiro rascunho desta sprint gravava a pesagem principal, os pesos
// individuais (criando animal virtual quando necessário) e o recálculo do
// lote como várias chamadas independentes em src/pages/PesagensPage.jsx
// (createOperationalRecord/updateOperationalRecord/deleteOperationalRecord em
// sequência) — eram múltiplas requisições HTTP separadas, não uma transação:
// uma falha no meio podia deixar pesagem principal sem peso, peso sem
// principal, ou o lote com peso desatualizado.
//
// Este módulo passa a usar as RPCs `registrar_pesagem_individual` e
// `excluir_pesagem_individual` (migration
// 20260727120000_rpcs_transacionais_pesagem_individual.sql), que fazem tudo —
// principal + individuais + animal virtual + recálculo do lote — dentro de um
// único corpo PL/pgSQL (transação implícita do Postgres), mesmo padrão já
// usado por `registrar_saida_lote` em services/saidaLoteTransacional.js.
//
// CONTRATO (idêntico ao de saidaLoteTransacional.js): nada do estado local é
// alterado antes de a RPC confirmar. Cada função devolve `{ ok: false, erro }`
// ou `{ ok: true, aplicar(db) }` — quem chama só atualiza a tela depois do
// `ok`, e `aplicar` espelha o que a transação gravou usando os ids reais
// devolvidos pela RPC (nunca `gerarNovoId`), complementado por uma leitura
// (SELECT autenticado, sob RLS normal) dos pesos individuais e animais
// vinculados — a RPC não devolve arrays dinâmicos de linhas criadas, só o
// resumo da principal e do lote.
//
// LIMITAÇÃO CONHECIDA: como toda RPC, esta chamada exige rede/sessão — não há
// fallback de fila offline aqui (mesma característica já aceita em
// saidaLoteTransacional.js). Um animal individual criado localmente e ainda
// não sincronizado com a nuvem não pode ser pesado por este fluxo até
// sincronizar (o `animal_id` local não existe na tabela real `animais` e a
// RPC rejeitaria "Animal não encontrado"); na prática isso só afeta lotes que
// já têm animais individuais REAIS pré-cadastrados — o caminho comum (animal
// virtual gerado pela própria pesagem) não depende de nenhum id pré-existente
// e não é afetado.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js';
import { getFriendlyErrorMessage } from './movimentacaoPastos.js';
import { calcularPesoMedioIndividual } from '../domain/pesagensLote.js';
import { registrarAuditoria } from './auditoria.js';

function falha(erro) {
  return { ok: false, erro, aplicar: null };
}

function normalizeIdKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * Valida e monta os parâmetros da RPC a partir dos `registros` já validados
 * pelo formulário (um por cabeça, ver PesagemForm.jsx). Puro — não toca em
 * rede. `calcularPesoMedioIndividual` roda aqui também só para dar feedback
 * imediato (a fonte de verdade do valor gravado é sempre o cálculo feito de
 * novo dentro da RPC).
 *
 * @returns {{ok:true, params:object, preview:object}|{ok:false, erro:string}}
 */
export function planejarPesagemIndividualTransacional(dados = {}) {
  const loteId = Number(dados?.lote_id);
  if (!Number.isFinite(loteId) || loteId <= 0) {
    return { ok: false, erro: 'Selecione um lote válido.' };
  }
  const data = String(dados?.data || '').trim();
  if (!data) {
    return { ok: false, erro: 'Informe a data da pesagem.' };
  }
  const registros = Array.isArray(dados?.registros) ? dados.registros : [];
  if (!registros.length) {
    return { ok: false, erro: 'Informe ao menos um peso válido para salvar.' };
  }

  const pesos = registros.map((registro) => ({
    animal_id: registro.animal_id ? Number(registro.animal_id) : null,
    virtual_index: registro?.virtual_animal?.index ? Number(registro.virtual_animal.index) : null,
    virtual_identificacao: registro?.virtual_animal?.identificacao || null,
    peso_medio: Number(registro.peso_medio),
    observacao: registro.observacao || null,
  }));

  const preview = calcularPesoMedioIndividual(pesos.map((item) => item.peso_medio));
  if (preview.quantidade === 0 || preview.media === null) {
    return { ok: false, erro: 'Nenhum peso válido para calcular a média.' };
  }

  const primeiro = registros[0] || {};

  return {
    ok: true,
    params: {
      p_lote_id: loteId,
      p_data: data,
      p_pesos: pesos,
      p_observacao: dados.observacao || null,
      p_rendimento_carcaca: Number(primeiro.rendimento_carcaca || 52),
      p_preco_arroba: primeiro.preco_arroba === null || primeiro.preco_arroba === undefined || primeiro.preco_arroba === ''
        ? null
        : Number(primeiro.preco_arroba),
      p_cabecas_totais_lote: Number.isFinite(Number(dados?.expectedHeadCount)) ? Number(dados.expectedHeadCount) : null,
      p_pesagem_principal_id: dados?.pesagemPrincipalId ? Number(dados.pesagemPrincipalId) : null,
    },
    preview,
  };
}

/**
 * Depois que a RPC confirma, busca (leitura autenticada normal, sob RLS) a
 * pesagem principal atualizada e todos os pesos individuais vinculados a
 * ela, para espelhar no estado local com os ids reais do banco.
 */
async function buscarPesagemComFilhos(client, principalId) {
  const { data: principal, error: erroPrincipal } = await client
    .from('pesagens')
    .select('*')
    .eq('id', principalId)
    .maybeSingle();
  if (erroPrincipal) throw erroPrincipal;

  const { data: filhos, error: erroFilhos } = await client
    .from('pesagens')
    .select('*')
    .eq('tipo', 'animal')
    .contains('metadata', { pesagem_principal_id: principalId });
  if (erroFilhos) throw erroFilhos;

  const animalIds = (filhos || []).map((item) => item.animal_id).filter((id) => id !== null && id !== undefined);
  let animais = [];
  if (animalIds.length) {
    const { data: animaisData, error: erroAnimais } = await client
      .from('animais')
      .select('*')
      .in('id', animalIds);
    if (erroAnimais) throw erroAnimais;
    animais = animaisData || [];
  }

  return { principal, filhos: filhos || [], animais };
}

function aplicarPesagemNoEstadoLocal(db, { principal, filhos, animais, loteAtualizado }) {
  const pesagensAtuais = Array.isArray(db?.pesagens) ? db.pesagens : [];
  const animaisAtuais = Array.isArray(db?.animais) ? db.animais : [];
  const lotesAtuais = Array.isArray(db?.lotes) ? db.lotes : [];

  const idsFilhos = new Set(filhos.map((item) => normalizeIdKey(item.id)));
  const pesagensSemAntigas = pesagensAtuais.filter((item) => (
    normalizeIdKey(item.id) !== normalizeIdKey(principal.id) && !idsFilhos.has(normalizeIdKey(item.id))
  ));

  const idsAnimaisNovos = new Set(animais.map((item) => normalizeIdKey(item.id)));
  const animaisSemNovos = animaisAtuais.filter((item) => !idsAnimaisNovos.has(normalizeIdKey(item.id)));

  return {
    ...db,
    pesagens: [...pesagensSemAntigas, principal, ...filhos],
    animais: [...animaisSemNovos, ...animais],
    lotes: lotesAtuais.map((lote) => (
      Number(lote.id) === Number(loteAtualizado.id)
        ? { ...lote, p_at: loteAtualizado.p_at, peso_atual: loteAtualizado.p_at, peso_medio_atual: loteAtualizado.p_at, ultima_pesagem: loteAtualizado.ultima_pesagem }
        : lote
    )),
  };
}

/**
 * Cria ou edita (quando `dados.pesagemPrincipalId` é informado) uma pesagem
 * individual por cabeça pela RPC transacional única.
 *
 * @param {object} dados { lote_id, data, observacao, expectedHeadCount, registros, pesagemPrincipalId? }
 * @param {object} opcoes { session, userContext, client } — `client` só existe para teste.
 */
export async function registrarPesagemIndividualTransacional(dados = {}, opcoes = {}) {
  const { session = null, userContext = {}, client = supabase } = opcoes;

  const plano = planejarPesagemIndividualTransacional(dados);
  if (!plano.ok) return falha(plano.erro);

  const ownerUserId = session?.user?.id || null;
  if (!ownerUserId) {
    return falha('Não foi possível confirmar o salvamento agora. Entre novamente e tente outra vez.');
  }

  let resposta;
  try {
    resposta = await client.rpc('registrar_pesagem_individual', {
      p_owner_user_id: ownerUserId,
      ...plano.params,
    });
  } catch (error) {
    return falha(getFriendlyErrorMessage(error));
  }

  if (resposta?.error) {
    return falha(getFriendlyErrorMessage(resposta.error));
  }

  const linha = Array.isArray(resposta?.data) ? resposta.data[0] : resposta?.data;
  if (!linha?.pesagem_principal_id) {
    return falha('Não foi possível confirmar a pesagem agora. Tente novamente.');
  }

  let dadosCompletos;
  try {
    dadosCompletos = await buscarPesagemComFilhos(client, linha.pesagem_principal_id);
  } catch (error) {
    // A transação já confirmou no banco — só a releitura falhou. Não é uma
    // falha de gravação; quem chama deve recarregar os dados normalmente
    // (próximo boot/sync) em vez de tentar de novo.
    return falha(getFriendlyErrorMessage(error) || 'Pesagem salva, mas não foi possível atualizar a tela agora. Recarregue a página.');
  }

  return {
    ok: true,
    erro: null,
    principalId: linha.pesagem_principal_id,
    pesoMedio: linha.peso_medio,
    quantidadeEfetiva: linha.quantidade_efetiva,
    aplicar: (estadoAtual) => registrarAuditoria(
      aplicarPesagemNoEstadoLocal(estadoAtual, {
        principal: dadosCompletos.principal,
        filhos: dadosCompletos.filhos,
        animais: dadosCompletos.animais,
        loteAtualizado: { id: plano.params.p_lote_id, p_at: linha.lote_p_at, ultima_pesagem: linha.lote_ultima_pesagem },
      }),
      {
        acao: dados?.pesagemPrincipalId ? 'pesagem_individual_editada' : 'pesagem_individual_registrada',
        entidade: 'pesagens',
        entidade_id: linha.pesagem_principal_id,
        descricao: `Pesagem individual do lote ${plano.params.p_lote_id}: ${linha.quantidade_efetiva} cabeça(s), média ${linha.peso_medio} kg`,
        ator_id: userContext?.id || null,
        ator_email: userContext?.email || '',
        criticidade: 'media',
      },
      { session }
    ),
  };
}

/**
 * Exclui uma pesagem individual (principal + todos os pesos vinculados) pela
 * RPC transacional única.
 *
 * @param {object} dados { pesagemPrincipalId }
 * @param {object} opcoes { session, userContext, client }
 */
export async function excluirPesagemIndividualTransacional(dados = {}, opcoes = {}) {
  const { session = null, userContext = {}, client = supabase } = opcoes;

  const principalId = Number(dados?.pesagemPrincipalId);
  if (!Number.isFinite(principalId) || principalId <= 0) {
    return falha('Pesagem inválida para exclusão.');
  }

  const ownerUserId = session?.user?.id || null;
  if (!ownerUserId) {
    return falha('Não foi possível confirmar a exclusão agora. Entre novamente e tente outra vez.');
  }

  let resposta;
  try {
    resposta = await client.rpc('excluir_pesagem_individual', {
      p_owner_user_id: ownerUserId,
      p_pesagem_principal_id: principalId,
    });
  } catch (error) {
    return falha(getFriendlyErrorMessage(error));
  }

  if (resposta?.error) {
    return falha(getFriendlyErrorMessage(resposta.error));
  }

  const linha = Array.isArray(resposta?.data) ? resposta.data[0] : resposta?.data;

  return {
    ok: true,
    erro: null,
    aplicar: (estadoAtual) => {
      const pesagensAtuais = Array.isArray(estadoAtual?.pesagens) ? estadoAtual.pesagens : [];
      const lotesAtuais = Array.isArray(estadoAtual?.lotes) ? estadoAtual.lotes : [];
      const removida = pesagensAtuais.find((item) => Number(item.id) === principalId);
      const restantes = pesagensAtuais.filter((item) => {
        if (Number(item.id) === principalId) return false;
        const vinculoId = Number(item?.metadata?.pesagem_principal_id);
        return vinculoId !== principalId;
      });
      const loteId = linha?.lote_id ?? removida?.lote_id ?? null;
      const lotesAtualizados = loteId != null
        ? lotesAtuais.map((lote) => (
            Number(lote.id) === Number(loteId)
              ? { ...lote, p_at: linha?.lote_p_at ?? lote.p_at, peso_atual: linha?.lote_p_at ?? lote.peso_atual, peso_medio_atual: linha?.lote_p_at ?? lote.peso_medio_atual, ultima_pesagem: linha?.lote_ultima_pesagem ?? null }
              : lote
          ))
        : lotesAtuais;
      return registrarAuditoria(
        { ...estadoAtual, pesagens: restantes, lotes: lotesAtualizados },
        {
          acao: 'pesagem_individual_excluida',
          entidade: 'pesagens',
          entidade_id: principalId,
          descricao: `Exclusão de pesagem individual do lote ${loteId ?? '—'}`,
          ator_id: userContext?.id || null,
          ator_email: userContext?.email || '',
          criticidade: 'alta',
        },
        { session }
      );
    },
  };
}
