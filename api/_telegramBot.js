// Orquestrador server-side do Bot interativo do Telegram. Faz o I/O (lê o db da
// conta, resolve nome→registro, cria operação pendente, executa após
// /confirmar, grava auditoria) e delega TODA a lógica pura aos módulos de
// `src/domain/telegram/*`. Só é chamado para usuários JÁ vinculados; o
// pareamento e o fluxo de comandos sem vínculo continuam no webhook.
import { montarDbDaConta } from './_herdonDb.js';
import { gerarAlertasUnificados } from '../src/domain/alertasUnificados.js';
import { aplicarTratativasAosAlertas } from '../src/domain/tratativasAlertas.js';
import { prepararAlertasEscopados, enriquecerAlertasComFazenda } from '../src/domain/telegramFazenda.js';
import { filtrarDbPorFazenda } from '../src/domain/escopoFazenda.js';
import { INTENCOES } from '../src/domain/telegram/interpretarComandoTelegram.js';
import { interpretarMensagemTelegram, LIMIAR_EXECUTAR } from '../src/domain/telegram/interpretadorTelegram.js';
import { podeExecutarComandoTelegram, intencaoEhCadastro } from '../src/domain/telegram/permissoesTelegram.js';
import { resolverFazendaPorNome, resolverLotePorNome } from '../src/domain/telegram/resolvedores.js';
import {
  formatarFazendas, formatarLotes, formatarLote, formatarEstoque,
  formatarFinanceiro, formatarManejos, formatarPesagens, formatarResumo,
} from '../src/domain/telegram/respostasConsulta.js';
import { prepararTransferenciaAnimais, prepararRenomearLote } from '../src/domain/telegram/acoesLote.js';
import { calcularExpiraEm, podeConfirmar, STATUS } from '../src/domain/telegram/operacoesPendentes.js';
import {
  slotsDoCadastro, extrairDadosIniciais, interpretarResposta, prepararCadastro,
} from '../src/domain/telegram/cadastros.js';
import {
  proximoCampoFaltante, mesclarDados, conversaExpirada,
  calcularExpiraEm as calcularExpiraConversa, STATUS_CONVERSA,
} from '../src/domain/telegram/conversas.js';
import { obterFerramenta } from '../src/domain/telegram/telegramToolsRegistry.js';
import { perfilTemPermissao } from '../src/auth/perfis.js';

// Intenções que o novo bot atende; as demais (DESCONHECIDO) caem no fluxo
// legado (Sprint 8), preservando o comportamento atual.
const INTENCOES_ATENDIDAS = new Set([
  INTENCOES.AJUDA, INTENCOES.LISTAR_FAZENDAS, INTENCOES.SELECIONAR_FAZENDA,
  INTENCOES.LISTAR_LOTES, INTENCOES.VER_LOTE, INTENCOES.CONSULTAR_ESTOQUE,
  INTENCOES.CONSULTAR_FINANCEIRO, INTENCOES.VER_ALERTAS, INTENCOES.VER_MANEJOS,
  INTENCOES.VER_PESAGENS, INTENCOES.RESUMO, INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES,
  INTENCOES.RENOMEAR_LOTE, INTENCOES.CONFIRMAR, INTENCOES.CANCELAR, INTENCOES.AMBIGUO,
  INTENCOES.REGISTRAR_PESAGEM, INTENCOES.CADASTRAR_DESPESA, INTENCOES.CADASTRAR_RECEITA,
  INTENCOES.REGISTRAR_ENTRADA_ESTOQUE,
  // Sprint bot operacional determinístico — novos cadastros/ações:
  INTENCOES.CADASTRAR_TAREFA, INTENCOES.CADASTRAR_ITEM_ESTOQUE,
  INTENCOES.DAR_BAIXA_ESTOQUE, INTENCOES.TROCAR_LOTE_PASTO,
  // Sprint de expansão do bot operacional — 8 novos cadastros/ações:
  INTENCOES.CADASTRAR_LOTE, INTENCOES.CADASTRAR_PASTO,
  INTENCOES.REGISTRAR_VENDA, INTENCOES.REGISTRAR_MORTE, INTENCOES.FINALIZAR_LOTE,
  INTENCOES.CADASTRAR_MANEJO, INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO,
  INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO,
]);

// Intenções que exigem uma fazenda definida (recorte). Fazendas e ajuda não.
const INTENCOES_ESCOPADAS = new Set([
  INTENCOES.LISTAR_LOTES, INTENCOES.VER_LOTE, INTENCOES.CONSULTAR_ESTOQUE,
  INTENCOES.CONSULTAR_FINANCEIRO, INTENCOES.VER_ALERTAS, INTENCOES.VER_MANEJOS,
  INTENCOES.VER_PESAGENS, INTENCOES.RESUMO, INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES,
  INTENCOES.RENOMEAR_LOTE, INTENCOES.REGISTRAR_PESAGEM, INTENCOES.CADASTRAR_DESPESA,
  INTENCOES.CADASTRAR_RECEITA, INTENCOES.REGISTRAR_ENTRADA_ESTOQUE,
  INTENCOES.CADASTRAR_TAREFA, INTENCOES.CADASTRAR_ITEM_ESTOQUE,
  INTENCOES.DAR_BAIXA_ESTOQUE, INTENCOES.TROCAR_LOTE_PASTO,
  INTENCOES.CADASTRAR_LOTE, INTENCOES.CADASTRAR_PASTO,
  INTENCOES.REGISTRAR_VENDA, INTENCOES.REGISTRAR_MORTE, INTENCOES.FINALIZAR_LOTE,
  INTENCOES.CADASTRAR_MANEJO, INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO,
  INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO,
]);

const MSG = {
  SEM_PERMISSAO: 'Você não tem permissão para isso nesta fazenda.',
  FAZENDA_SEM_ACESSO: 'Você não tem acesso a essa fazenda.',
  FAZENDA_NAO_ENCONTRADA: 'Não encontrei uma fazenda com esse nome. Envie /fazendas para ver as suas.',
  LOTE_NAO_ENCONTRADO: 'Não encontrei esse lote na fazenda atual. Envie /lotes para ver os lotes.',
  QUANTIDADE_INVALIDA: 'Informe uma quantidade válida de animais. Ex.: transferir 10 animais do lote A para o lote B.',
  ANIMAIS_INSUFICIENTES: 'O lote de origem não tem essa quantidade de animais.',
  MESMO_LOTE: 'Origem e destino não podem ser o mesmo lote.',
  SEM_OPERACAO: 'Não há nenhuma operação aguardando confirmação. Ela pode ter expirado.',
  EXPIRADA: 'Essa operação expirou. Envie o comando novamente.',
  OUTRO_USUARIO: 'Só quem iniciou a operação pode confirmá-la.',
  JA_EXECUTADA: 'Essa operação já foi concluída.',
  FALHA: 'Não consegui concluir agora. Tente novamente em instantes.',
  NOME_VAZIO: 'Informe o novo nome do lote.',
  NOME_DUPLICADO: 'Já existe um lote ativo com esse nome.',
  NOME_IGUAL: 'O novo nome é igual ao atual.',
  PESO_INVALIDO: 'Informe um peso válido em kg.',
  VALOR_INVALIDO: 'Informe um valor válido.',
  DESCRICAO_VAZIA: 'Informe a descrição.',
  ITEM_VAZIO: 'Informe o item de estoque.',
  ITEM_NAO_ENCONTRADO: 'Não encontrei esse item no estoque. Envie /estoque para ver os itens.',
  ITEM_AMBIGUO: 'Há mais de um item com esse nome. Seja mais específico.',
  LOTE_AMBIGUO: 'Há mais de um lote com esse nome. Seja mais específico.',
  CADASTRO_CANCELADO: 'Cadastro cancelado.',
  // Sprint de expansão do bot operacional — novos cadastros/ações:
  FAZENDA_NAO_DEFINIDA: 'Não sei em qual fazenda cadastrar isso. Envie "usar fazenda NOME" antes.',
  SEXO_INVALIDO: 'Informe o sexo do grupo: machos, fêmeas ou misto.',
  SEXO_VAZIO: 'Informe o sexo do grupo: machos, fêmeas ou misto.',
  AREA_INVALIDA: 'Informe uma área válida, em hectares.',
  CAPACIDADE_INVALIDA: 'Informe uma capacidade de suporte válida.',
  PASTO_NAO_ENCONTRADO: 'Não encontrei esse pasto na fazenda atual. Envie /ajuda para ver os comandos.',
  PASTO_AMBIGUO: 'Há mais de um pasto com esse nome. Seja mais específico.',
  PASTO_OUTRA_FAZENDA: 'Esse pasto pertence a outra fazenda.',
  LOTE_BLOQUEADO: 'Esse lote está finalizado e não aceita novas movimentações.',
  LOTE_JA_FINALIZADO: 'Esse lote já está finalizado.',
  MOTIVO_VAZIO: 'Informe o motivo.',
  TIPO_VAZIO: 'Informe o tipo de manejo.',
  PRODUTO_VAZIO: 'Informe o produto.',
  SALDO_INSUFICIENTE: 'Estoque insuficiente para essa quantidade.',
};

function ajuda() {
  return [
    'HERDON pelo Telegram',
    '',
    'Consultas:',
    '/fazendas — suas fazendas    /lotes — lotes da fazenda',
    '/lote NOME — detalhe do lote  /estoque — estoque',
    '/financeiro — contas          /alertas — alertas',
    '/manejos — manejos            /pesagens — pesagens',
    '/resumo — resumo da fazenda',
    '',
    'Ações (pedem confirmação):',
    'usar fazenda NOME',
    'transferir 10 animais do lote A para o lote B',
    'renomear lote A para B',
    '',
    '/confirmar ou /cancelar para as ações.',
  ].join('\n');
}

/** Lista numerada de candidatos para desambiguação. */
export function listaNumerada(itens, campo = 'nome') {
  return itens.map((it, idx) => `${idx + 1}. ${it[campo]}`).join('\n');
}

/** Nome da fazenda ativa (selecionada ou única) para os títulos. */
export function nomeFazendaAtiva(dbConta, fazendaId) {
  const fazendas = Array.isArray(dbConta?.fazendas) ? dbConta.fazendas : [];
  if (fazendaId != null) {
    const f = fazendas.find((x) => Number(x.id) === Number(fazendaId));
    return f?.nome || null;
  }
  return fazendas.length === 1 ? fazendas[0].nome : null;
}

export async function carregarPerfil(client, userId) {
  const { data } = await client.from('profiles').select('perfil').eq('id', userId).maybeSingle();
  return data?.perfil || 'visualizador';
}

export async function registrarAuditoria(client, conexao, dados) {
  try {
    await client.from('telegram_bot_auditoria').insert({
      owner_user_id: conexao.owner_user_id,
      user_id: conexao.user_id,
      telegram_chat_id: conexao.telegram_chat_id,
      fazenda_id: conexao.fazenda_id ?? null,
      origem: 'telegram',
      ...dados,
    });
  } catch {
    console.error('[telegram-bot] falha ao gravar auditoria', { acao: dados?.acao });
  }
}

/**
 * Ponto de entrada. Retorna { texto } a enviar, ou null quando a intenção não é
 * atendida por este bot (o webhook então segue com o fluxo legado).
 *
 * Camada fina sobre `processarComandoBotInterno`: classifica a mensagem UMA
 * vez com o interpretador determinístico central (`interpretadorTelegram.js`
 * — normalização + sinônimos + tolerância a erro de digitação + confiança,
 * seção 6/11 do spec do bot operacional) e, quando a interpretação só foi
 * possível depois de CORRIGIR uma palavra (confiança 0.65 — o degrau mais
 * incerto), avisa o produtor da correção feita antes de mostrar a resposta,
 * em vez de silenciosamente assumir que adivinhou certo.
 */
export async function processarComandoBot({ client, conexao, texto, chatId, agora = new Date() }) {
  const intent = interpretarMensagemTelegram(texto);
  const resultado = await processarComandoBotInterno({ client, conexao, texto, chatId, agora, intent });
  if (!resultado) return resultado;

  const corrigiu = intent.confidence > 0 && intent.confidence < LIMIAR_EXECUTAR && intent.correcoes?.length > 0;
  if (corrigiu) {
    const { original, corrigida } = intent.correcoes[0];
    return { texto: `(Entendi "${original}" como "${corrigida}" — se não era isso, envie /cancelar e reformule.)\n\n${resultado.texto}` };
  }
  return resultado;
}

async function processarComandoBotInterno({ client, conexao, texto, chatId, agora, intent }) {
  const ehSlash = String(texto || '').trim().startsWith('/');
  // Cancelamento EXPLÍCITO — não inclui um "não" solto, que dentro de uma
  // conversa é resposta a um slot opcional (ex.: "pertence a algum lote?").
  const cancelExplicito = /^\/?(?:cancelar|cancela|desistir|abortar)\b/i.test(String(texto || '').trim());

  // 0. Conversa em etapas ativa? Texto simples (não-slash) é resposta a ela.
  //    /comando ou cancelamento explícito interrompem. (Parte 4)
  const conversa = await buscarConversaAtiva(client, chatId, agora);
  if (conversa) {
    if (cancelExplicito) {
      await encerrarConversa(client, conversa.id, STATUS_CONVERSA.CANCELADA);
      await cancelarPendentesDoChat(client, chatId);
      return { texto: MSG.CADASTRO_CANCELADO };
    }
    if (!ehSlash) {
      return { texto: await continuarConversa(client, conexao, conversa, texto, agora) };
    }
    // Slash-command explícito durante conversa: interrompe a conversa e segue.
    await encerrarConversa(client, conversa.id, STATUS_CONVERSA.CANCELADA);
  }

  if (!INTENCOES_ATENDIDAS.has(intent.intencao)) return null;

  // Confirmação/cancelamento são resolvidos contra a operação pendente.
  if (intent.intencao === INTENCOES.CONFIRMAR) return { texto: await confirmar(client, conexao, chatId, agora) };
  if (intent.intencao === INTENCOES.CANCELAR) return { texto: await cancelar(client, conexao, chatId) };

  if (intent.intencao === INTENCOES.AJUDA) return { texto: ajuda() };
  if (intent.intencao === INTENCOES.AMBIGUO) {
    return { texto: [
      'Não ficou claro o que você quer. Você deseja:',
      `1. Transferir animais do lote ${intent.parametros.lote1} para ${intent.parametros.lote2};`,
      `2. Renomear o lote ${intent.parametros.lote1} para ${intent.parametros.lote2}.`,
      '',
      'Para transferir, envie: transferir N animais do lote ' + intent.parametros.lote1 + ' para o lote ' + intent.parametros.lote2,
      'Para renomear, envie: renomear lote ' + intent.parametros.lote1 + ' para ' + intent.parametros.lote2,
    ].join('\n') };
  }

  const perfil = await carregarPerfil(client, conexao.user_id);
  const { permitido } = podeExecutarComandoTelegram(perfil, intent.intencao);
  if (!permitido) {
    await registrarAuditoria(client, conexao, { acao: 'permissao_negada', intencao: intent.intencao, comando_original: texto, sucesso: false });
    return { texto: MSG.SEM_PERMISSAO };
  }

  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const fazendas = Array.isArray(dbConta.fazendas) ? dbConta.fazendas : [];

  // Fazenda: listar / selecionar (não precisam de recorte prévio).
  if (intent.intencao === INTENCOES.LISTAR_FAZENDAS) {
    return { texto: formatarFazendas(fazendas, conexao.fazenda_id) };
  }
  if (intent.intencao === INTENCOES.SELECIONAR_FAZENDA) {
    return { texto: await selecionarFazenda(client, conexao, fazendas, intent.parametros.nome, texto) };
  }

  // Intenções escopadas: exigem fazenda definida quando há mais de uma.
  if (INTENCOES_ESCOPADAS.has(intent.intencao) && fazendas.length > 1 && conexao.fazenda_id == null) {
    return { texto: [
      'Você possui mais de uma fazenda. Escolha uma antes de continuar:',
      '',
      listaNumerada(fazendas),
      '',
      'Envie: usar fazenda NOME',
    ].join('\n') };
  }

  const { db } = prepararAlertasEscopados(dbConta, conexao.fazenda_id);
  const fazendaNome = nomeFazendaAtiva(dbConta, conexao.fazenda_id);

  // Cadastros por conversa: extrai o que der da 1ª mensagem e pergunta o resto.
  if (intencaoEhCadastro(intent.intencao)) {
    return { texto: await iniciarCadastro(client, conexao, db, intent.intencao, texto, agora) };
  }

  switch (intent.intencao) {
    case INTENCOES.LISTAR_LOTES:
      return { texto: formatarLotes(db, { fazendaNome }) };
    case INTENCOES.VER_LOTE: {
      const r = resolverLotePorNome(db.lotes, intent.parametros.nome);
      if (r.status === 'ambiguo') return { texto: `Há mais de um lote com esse nome:\n\n${listaNumerada(r.candidatos)}` };
      if (r.status !== 'ok') return { texto: MSG.LOTE_NAO_ENCONTRADO };
      return { texto: formatarLote(db, r.lote) };
    }
    case INTENCOES.CONSULTAR_ESTOQUE:
      return { texto: formatarEstoque(db, intent.parametros) };
    case INTENCOES.CONSULTAR_FINANCEIRO:
      return { texto: formatarFinanceiro(db, { filtro: intent.parametros.filtro, loteNome: intent.parametros.lote }) };
    case INTENCOES.VER_ALERTAS:
      return { texto: await respostaAlertas(dbConta, conexao) };
    case INTENCOES.VER_MANEJOS:
      return { texto: formatarManejos(db, { hoje: agora }) };
    case INTENCOES.VER_PESAGENS:
      return { texto: formatarPesagens(db) };
    case INTENCOES.RESUMO:
      return { texto: formatarResumo(db, { fazendaNome }) };
    case INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES:
      return { texto: await prepararConfirmacaoTransferencia(client, conexao, db, intent, texto, agora) };
    case INTENCOES.RENOMEAR_LOTE:
      return { texto: await prepararConfirmacaoRenomear(client, conexao, db, intent, texto, agora) };
    default:
      return null;
  }
}

// ── Alertas: reaproveita o pipeline existente (mantém comportamento atual) ────
async function respostaAlertas(dbConta, conexao) {
  const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, conexao.fazenda_id);
  const brutos = gerarAlertasUnificados(db);
  const visiveis = aplicarTratativasAosAlertas(brutos, db.alertas_tratativas, new Date()).filter((a) => a.visivel);
  const alertas = enriquecerAlertasComFazenda(visiveis, db, identificarFazenda).filter((a) => a?.prioridade !== 'informativo');
  if (alertas.length === 0) return '✅ Nenhum alerta pendente agora.';
  const emoji = { critico: '🔴', atencao: '🟡', decisao: '🟢' };
  const linhas = [`📋 Alertas — ${alertas.length}`, ''];
  alertas.slice(0, 8).forEach((a) => linhas.push(`${emoji[a.prioridade] || '•'} ${a.titulo}${a.fazendaNome ? ` — ${a.fazendaNome}` : ''}`));
  if (alertas.length > 8) linhas.push(`• +${alertas.length - 8} outro(s)`);
  return linhas.join('\n');
}

// ── Seleção de fazenda (Parte 6) ─────────────────────────────────────────────
async function selecionarFazenda(client, conexao, fazendas, nome, textoOriginal) {
  const r = resolverFazendaPorNome(fazendas, nome);
  if (r.status === 'ambiguo') {
    return `Há mais de uma fazenda parecida. Qual delas?\n\n${listaNumerada(r.candidatas)}\n\nEnvie: usar fazenda NOME`;
  }
  if (r.status !== 'ok') return MSG.FAZENDA_NAO_ENCONTRADA;

  const { error } = await client.from('telegram_connections')
    .update({ fazenda_id: r.fazenda.id })
    .eq('id', conexao.id);
  if (error) return MSG.FALHA;

  await registrarAuditoria(client, conexao, {
    acao: 'trocar_fazenda', intencao: 'SELECIONAR_FAZENDA', comando_original: textoOriginal,
    dados_anteriores: { fazenda_id: conexao.fazenda_id }, dados_posteriores: { fazenda_id: r.fazenda.id }, sucesso: true,
  });
  conexao.fazenda_id = r.fazenda.id; // reflete na conexão em memória
  return `Fazenda alterada com sucesso.\n\nFazenda atual: ${r.fazenda.nome}.\nTodos os próximos comandos usarão essa fazenda.`;
}

// ── Preparar ação → operação pendente (Parte 15) ─────────────────────────────
export async function salvarOperacaoPendente(client, conexao, tipo, payload, agora) {
  // Cancela qualquer pendência anterior do mesmo chat antes de criar a nova.
  await client.from('telegram_operacoes_pendentes')
    .update({ status: STATUS.CANCELADA })
    .eq('telegram_chat_id', conexao.telegram_chat_id)
    .eq('status', STATUS.PENDENTE);

  const { error } = await client.from('telegram_operacoes_pendentes').insert({
    owner_user_id: conexao.owner_user_id,
    user_id: conexao.user_id,
    telegram_chat_id: conexao.telegram_chat_id,
    fazenda_id: conexao.fazenda_id ?? null,
    tipo_operacao: tipo,
    payload,
    status: STATUS.PENDENTE,
    expira_em: calcularExpiraEm(agora).toISOString(),
  });
  return !error;
}

async function prepararConfirmacaoTransferencia(client, conexao, db, intent, textoOriginal, agora) {
  const { quantidade, loteOrigem, loteDestino } = intent.parametros;
  const origem = resolverLotePorNome(db.lotes, loteOrigem, { somenteAtivos: true });
  const destino = resolverLotePorNome(db.lotes, loteDestino, { somenteAtivos: true });
  if (origem.status === 'ambiguo') return `Há mais de um lote de origem com esse nome:\n\n${listaNumerada(origem.candidatos)}`;
  if (destino.status === 'ambiguo') return `Há mais de um lote de destino com esse nome:\n\n${listaNumerada(destino.candidatos)}`;
  if (origem.status !== 'ok' || destino.status !== 'ok') return MSG.LOTE_NAO_ENCONTRADO;

  const plano = prepararTransferenciaAnimais(db, {
    loteOrigemId: origem.lote.id, loteDestinoId: destino.lote.id, quantidade,
  });
  if (!plano.ok) return MSG[plano.erro] || MSG.FALHA;

  const ok = await salvarOperacaoPendente(client, conexao, 'transferir_animais', {
    loteOrigemId: origem.lote.id, loteDestinoId: destino.lote.id, quantidade,
  }, agora);
  if (!ok) return MSG.FALHA;

  return [
    'Confirme a transferência:',
    '',
    `Origem: ${plano.resumo.origemNome}`,
    `Destino: ${plano.resumo.destinoNome}`,
    `Quantidade: ${plano.resumo.quantidade} animais`,
    '',
    'Responda /confirmar para concluir ou /cancelar para desistir.',
  ].join('\n');
}

async function prepararConfirmacaoRenomear(client, conexao, db, intent, textoOriginal, agora) {
  const { loteAtual, novoNome } = intent.parametros;
  const alvo = resolverLotePorNome(db.lotes, loteAtual, { somenteAtivos: true });
  if (alvo.status === 'ambiguo') return `Há mais de um lote com esse nome:\n\n${listaNumerada(alvo.candidatos)}`;
  if (alvo.status !== 'ok') return MSG.LOTE_NAO_ENCONTRADO;

  const plano = prepararRenomearLote(db, { loteId: alvo.lote.id, novoNome });
  if (!plano.ok) return MSG[plano.erro] || MSG.FALHA;

  const ok = await salvarOperacaoPendente(client, conexao, 'renomear_lote', {
    loteId: alvo.lote.id, novoNome,
  }, agora);
  if (!ok) return MSG.FALHA;

  return [
    'Confirme a renomeação:',
    '',
    `Lote: ${plano.resumo.nomeAnterior}`,
    `Novo nome: ${plano.resumo.nomeNovo}`,
    '',
    'Responda /confirmar para concluir ou /cancelar para desistir.',
  ].join('\n');
}

// ── Cadastros por conversa (Fase 3) ──────────────────────────────────────────
async function buscarConversaAtiva(client, chatId, agora) {
  const { data } = await client.from('telegram_conversas')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .eq('status', STATUS_CONVERSA.ATIVA)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (conversaExpirada(data, agora)) {
    await encerrarConversa(client, data.id, STATUS_CONVERSA.EXPIRADA);
    return null;
  }
  return data;
}

async function encerrarConversa(client, id, status) {
  await client.from('telegram_conversas').update({ status, atualizado_em: new Date().toISOString() }).eq('id', id);
}

async function cancelarPendentesDoChat(client, chatId) {
  await client.from('telegram_operacoes_pendentes')
    .update({ status: STATUS.CANCELADA })
    .eq('telegram_chat_id', String(chatId))
    .eq('status', STATUS.PENDENTE);
}

async function iniciarCadastro(client, conexao, db, intencao, texto, agora) {
  const slots = slotsDoCadastro(intencao);
  const dados = extrairDadosIniciais(intencao, texto, { hoje: agora, db });
  const prox = proximoCampoFaltante(slots, dados);
  if (!prox) return finalizarCadastro(client, conexao, db, intencao, dados, null, agora);

  await client.from('telegram_conversas').insert({
    owner_user_id: conexao.owner_user_id,
    user_id: conexao.user_id,
    telegram_chat_id: conexao.telegram_chat_id,
    fazenda_id: conexao.fazenda_id ?? null,
    intencao_atual: intencao,
    etapa_atual: prox.nome,
    dados_coletados: dados,
    status: STATUS_CONVERSA.ATIVA,
    expira_em: calcularExpiraConversa(agora).toISOString(),
  });
  return prox.pergunta;
}

async function continuarConversa(client, conexao, conversa, texto, agora) {
  const intencao = conversa.intencao_atual;
  const slots = slotsDoCadastro(intencao);
  const slotAtual = slots.find((s) => s.nome === conversa.etapa_atual);
  let dados = conversa.dados_coletados || {};
  if (slotAtual) {
    const valor = interpretarResposta(slotAtual.tipo, texto, { hoje: agora });
    dados = mesclarDados(dados, { [slotAtual.nome]: valor });
    // slot opcional respondido com "não" fica como '' — marca como visitado.
    if (slotAtual.obrigatorio === false && (valor === '' || valor === null)) dados[slotAtual.nome] = '';
  }
  const prox = proximoCampoFaltante(slots, dados);
  if (prox) {
    await client.from('telegram_conversas')
      .update({ dados_coletados: dados, etapa_atual: prox.nome, atualizado_em: new Date().toISOString() })
      .eq('id', conversa.id);
    return prox.pergunta;
  }
  // Recarrega db fresco da fazenda da conversa para resolver nomes/validar.
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, conversa.fazenda_id);
  await encerrarConversa(client, conversa.id, STATUS_CONVERSA.CONCLUIDA);
  return finalizarCadastro(client, conexao, db, intencao, dados, conversa, agora);
}

// Slots completos → valida, cria operação pendente e pede /confirmar.
async function finalizarCadastro(client, conexao, db, intencao, dados, conversa, agora) {
  const plano = prepararCadastro(intencao, dados, { db, hoje: agora, fazendaId: conexao.fazenda_id ?? null });
  if (!plano.ok) return MSG[plano.erro] || MSG.FALHA;

  const ok = await salvarOperacaoPendente(client, conexao, 'cadastro', { intencao, dados }, agora);
  if (!ok) return MSG.FALHA;

  return [...plano.resumo, '', 'Responda /confirmar para concluir ou /cancelar para desistir.'].join('\n');
}

async function executarCadastro(client, conexao, op) {
  const { intencao, dados } = op.payload || {};
  // Revalida permissão na execução (Parte 19).
  const perfil = await carregarPerfil(client, conexao.user_id);
  if (!podeExecutarComandoTelegram(perfil, intencao).permitido) throw new Error('SEM_PERMISSAO');

  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const plano = prepararCadastro(intencao, dados, { db, hoje: new Date(), fazendaId: op.fazenda_id ?? null });
  if (!plano.ok) throw new Error(plano.erro);

  await aplicarWrites(client, conexao, plano.writes);
  await registrarAuditoria(client, conexao, {
    acao: plano.tipo, intencao, sucesso: true, dados_posteriores: dados,
  });
  return `${plano.resumo[0].replace('Confirme', 'Registrado').replace(':', '.')}`;
}

// ── Execução de uma ferramenta do catálogo (telegramToolsRegistry) já
// confirmada. Ponto de saída genérico para qualquer ferramenta despachada
// pelo interpretador determinístico (`interpretadorTelegram.js`) que não
// seja uma das duas ações críticas legadas (`transferir_animais`/
// `renomear_lote`, que continuam usando `executarTransferencia`/
// `executarRenomear` acima, intocadas). Mesmo padrão das demais execuções:
// recarrega o db fresco (idempotente contra saldo desatualizado) e revalida
// a permissão no momento da confirmação, não só na proposta.
export async function executarFerramentaCatalogo(client, conexao, op) {
  const { tool: nomeFerramenta, params } = op.payload || {};
  const ferramenta = obterFerramenta(nomeFerramenta);
  if (!ferramenta) throw new Error('FERRAMENTA_DESCONHECIDA');

  const perfil = await carregarPerfil(client, conexao.user_id);
  if (!perfilTemPermissao(perfil, ferramenta.requiredPermission)) throw new Error('SEM_PERMISSAO');

  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const plano = ferramenta.execute(db, params, { fazendaId: op.fazenda_id ?? null });
  if (!plano.ok) throw new Error(plano.erro || 'FALHA');

  await aplicarWrites(client, conexao, plano.writes);
  await registrarAuditoria(client, conexao, {
    acao: nomeFerramenta, intencao: nomeFerramenta, sucesso: true, dados_posteriores: params,
  });
  return ferramenta.formatResult(plano, { confirmado: true });
}

export async function aplicarWrites(client, conexao, writes) {
  for (const w of writes) {
    if (w.tipo === 'insert') {
      await client.from(w.tabela).insert({ owner_user_id: conexao.owner_user_id, ...w.registro });
    } else if (w.tipo === 'update') {
      let q = client.from(w.tabela).update(w.patch);
      Object.entries(w.match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
      await q.eq('owner_user_id', conexao.owner_user_id);
    }
  }
}

// ── Confirmar / cancelar (Parte 15/16) ───────────────────────────────────────
async function buscarPendente(client, chatId) {
  const { data } = await client.from('telegram_operacoes_pendentes')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .eq('status', STATUS.PENDENTE)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function cancelar(client, conexao, chatId) {
  const op = await buscarPendente(client, chatId);
  if (!op) return MSG.SEM_OPERACAO;
  await client.from('telegram_operacoes_pendentes').update({ status: STATUS.CANCELADA }).eq('id', op.id);
  await registrarAuditoria(client, conexao, { acao: 'cancelar_operacao', intencao: 'CANCELAR', sucesso: true, dados_anteriores: { tipo: op.tipo_operacao } });
  return 'Operação cancelada.';
}

async function confirmar(client, conexao, chatId, agora) {
  const op = await buscarPendente(client, chatId);
  const check = podeConfirmar(op, { userId: conexao.user_id, chatId, agora });
  if (!check.ok) {
    if (op && check.motivo === 'EXPIRADA') {
      await client.from('telegram_operacoes_pendentes').update({ status: STATUS.EXPIRADA }).eq('id', op.id);
    }
    return MSG[check.motivo] || MSG.SEM_OPERACAO;
  }

  // Marca como confirmada (idempotência: só transiciona a partir de pendente).
  const { data: travada } = await client.from('telegram_operacoes_pendentes')
    .update({ status: STATUS.CONFIRMADA, confirmado_em: agora.toISOString() })
    .eq('id', op.id).eq('status', STATUS.PENDENTE)
    .select('id').maybeSingle();
  if (!travada) return MSG.JA_EXECUTADA;

  try {
    let texto;
    if (op.tipo_operacao === 'transferir_animais') texto = await executarTransferencia(client, conexao, op);
    else if (op.tipo_operacao === 'renomear_lote') texto = await executarRenomear(client, conexao, op);
    else if (op.tipo_operacao === 'cadastro') texto = await executarCadastro(client, conexao, op);
    else if (op.tipo_operacao === 'ferramenta_bot') texto = await executarFerramentaCatalogo(client, conexao, op);
    else throw new Error('TIPO_DESCONHECIDO');
    await client.from('telegram_operacoes_pendentes').update({ status: STATUS.EXECUTADA, executado_em: new Date().toISOString() }).eq('id', op.id);
    return texto;
  } catch (e) {
    console.error('[telegram-bot] falha ao executar operação', { tipo: op.tipo_operacao });
    await client.from('telegram_operacoes_pendentes').update({ status: STATUS.ERRO, erro: String(e?.message || 'erro') }).eq('id', op.id);
    return MSG.FALHA;
  }
}

// Recalcula sobre o db fresco (idempotente / sem qty velha) e aplica os writes.
async function executarTransferencia(client, conexao, op) {
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const plano = prepararTransferenciaAnimais(db, op.payload);
  if (!plano.ok) throw new Error(plano.erro);

  const hoje = new Date().toISOString().slice(0, 10);
  await client.from('movimentacoes_animais').insert({
    owner_user_id: conexao.owner_user_id,
    ...plano.writes.movimentacaoAnimal,
    data: hoje,
    obs: 'Transferência via Telegram',
  });
  await client.from('lotes').update({ qtd: plano.writes.loteOrigem.qtd, p_at: plano.writes.loteOrigem.p_at })
    .eq('id', plano.writes.loteOrigem.id).eq('owner_user_id', conexao.owner_user_id);
  await client.from('lotes').update({ qtd: plano.writes.loteDestino.qtd, p_at: plano.writes.loteDestino.p_at })
    .eq('id', plano.writes.loteDestino.id).eq('owner_user_id', conexao.owner_user_id);

  await registrarAuditoria(client, conexao, {
    acao: 'transferir_animais', intencao: 'TRANSFERIR_ANIMAIS_ENTRE_LOTES', sucesso: true,
    dados_posteriores: plano.resumo,
  });
  return [
    'Transferência concluída.',
    '',
    `${plano.resumo.quantidade} animais de ${plano.resumo.origemNome} para ${plano.resumo.destinoNome}.`,
    `${plano.resumo.origemNome}: ${plano.resumo.origemQtdFinal} animais`,
    `${plano.resumo.destinoNome}: ${plano.resumo.destinoQtdFinal} animais`,
  ].join('\n');
}

async function executarRenomear(client, conexao, op) {
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const plano = prepararRenomearLote(db, op.payload);
  if (!plano.ok) throw new Error(plano.erro);

  await client.from('lotes').update({ nome: plano.writes.loteUpdate.nome })
    .eq('id', plano.writes.loteUpdate.id).eq('owner_user_id', conexao.owner_user_id);

  await registrarAuditoria(client, conexao, {
    acao: 'renomear_lote', intencao: 'RENOMEAR_LOTE', sucesso: true, dados_posteriores: plano.resumo,
  });
  return `Lote renomeado de "${plano.resumo.nomeAnterior}" para "${plano.resumo.nomeNovo}".`;
}
