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
import { interpretarSelecaoFazenda } from '../src/domain/telegram/selecaoFazendaPendente.js';
import {
  formatarFazendas, formatarLotes, formatarLote, formatarEstoque,
  formatarFinanceiro, formatarManejos, formatarPesagens, formatarResumo,
  formatarPastagens, formatarResultadoLote,
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
import { interpretarEdicaoCampo, aplicarEdicaoPendente } from '../src/domain/telegram/edicaoPendente.js';
import { formatarResumoConsolidadoFazendas } from '../src/domain/telegram/resumoConsolidado.js';

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
  // Sprint Paridade 1 — Fazendas/Lotes/Pesagens/Pastagens:
  INTENCOES.CADASTRAR_FAZENDA, INTENCOES.RENOMEAR_FAZENDA,
  INTENCOES.LISTAR_PASTOS, INTENCOES.CONSULTAR_RESULTADO_LOTE,
  INTENCOES.EDITAR_PESAGEM, INTENCOES.EXCLUIR_PESAGEM,
  INTENCOES.AJUSTAR_LOTACAO, INTENCOES.EDITAR_LOTE,
  INTENCOES.EDITAR_PASTO, INTENCOES.RETIRAR_LOTE_PASTO,
  // Sprint Paridade 1, bloco 5 — alertas, exclusão de fazenda/pasto, resumo:
  INTENCOES.MARCAR_ALERTA_EM_ANALISE, INTENCOES.RESOLVER_ALERTA,
  INTENCOES.IGNORAR_ALERTA, INTENCOES.ADIAR_ALERTA, INTENCOES.REABRIR_ALERTA,
  INTENCOES.RESUMO_CONSOLIDADO_FAZENDAS,
  INTENCOES.EXCLUIR_FAZENDA, INTENCOES.EXCLUIR_PASTO,
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
  INTENCOES.LISTAR_PASTOS, INTENCOES.CONSULTAR_RESULTADO_LOTE,
  INTENCOES.EDITAR_PESAGEM, INTENCOES.EXCLUIR_PESAGEM,
  INTENCOES.AJUSTAR_LOTACAO, INTENCOES.EDITAR_LOTE,
  INTENCOES.EDITAR_PASTO, INTENCOES.RETIRAR_LOTE_PASTO,
  // Alertas e exclusão de pasto operam dentro de uma fazenda; exclusão de
  // fazenda e o resumo consolidado são cross-fazenda por natureza (mesmo
  // padrão de CADASTRAR_FAZENDA/RENOMEAR_FAZENDA, também fora desta lista).
  INTENCOES.MARCAR_ALERTA_EM_ANALISE, INTENCOES.RESOLVER_ALERTA,
  INTENCOES.IGNORAR_ALERTA, INTENCOES.ADIAR_ALERTA, INTENCOES.REABRIR_ALERTA,
  INTENCOES.EXCLUIR_PASTO,
]);

// Sentinela do `intencao_atual` usado para marcar, na MESMA tabela
// `telegram_conversas` das conversas de cadastro, a pendência de "escolha uma
// fazenda antes de continuar" (bug original: uma resposta como "1" não batia
// em nenhuma intenção conhecida e caía direto no fallback de ajuda). Nunca
// colide com um valor de `INTENCOES`, que são todos identificadores de
// `interpretarComandoTelegram.js`.
const SELECAO_FAZENDA_SENTINELA = '__SELECIONAR_FAZENDA_PENDENTE__';

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
  FAZENDA_AMBIGUA: 'Há mais de uma fazenda com esse nome. Seja mais específico.',
  FAZENDA_VAZIA: 'Informe qual fazenda.',
  PESAGEM_NAO_ENCONTRADA: 'Não encontrei nenhuma pesagem registrada para esse lote.',
  SEM_ALTERACAO: 'A nova quantidade é igual à atual — nada para ajustar.',
  LOTE_SEM_PASTO: 'Esse lote já não tem pasto vinculado.',
  NENHUM_CAMPO_INFORMADO: 'Informe ao menos um campo para alterar.',
  // Sprint Paridade 1, bloco 5 — alertas, exclusão de fazenda/pasto:
  ALERTA_VAZIO: 'Informe qual alerta (o número da lista ou parte do título).',
  ALERTA_NAO_ENCONTRADO: 'Não encontrei esse alerta na lista atual. Envie /alertas para ver os alertas.',
  ALERTA_AMBIGUO: 'Há mais de um alerta parecido. Seja mais específico.',
  ALERTA_NAO_TRATADO: 'Esse alerta não está tratado — não há nada para reabrir.',
  STATUS_INVALIDO: 'Status de tratativa inválido.',
  DATA_ADIAMENTO_VAZIA: 'Informe até quando adiar.',
  DADOS_INVALIDOS: 'Não consegui registrar esses dados agora.',
  FAZENDA_COM_VINCULOS: 'Essa fazenda possui dados vinculados e não pode ser excluída pelo Telegram. Faça a gestão dela no aplicativo.',
  PASTO_OCUPADO: 'Esse pasto tem lote vinculado no momento — retire o lote antes de excluir.',
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

  // -1. Seleção de fazenda pendente tem PRIORIDADE sobre tudo, inclusive o
  //     fallback de ajuda: uma resposta como "1" nunca bate em nenhuma
  //     intenção conhecida (`intent.intencao` viria DESCONHECIDO), e sem esta
  //     checagem cairia direto no fluxo legado do webhook (bug original).
  const respostaSelecao = await tratarSelecaoFazendaPendente(client, conexao, chatId, texto, ehSlash, cancelExplicito, agora);
  if (respostaSelecao) return respostaSelecao;

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

  // 0.5 Confirmação editável (Sprint Paridade 1, bloco 4): texto livre pode
  //     corrigir UM campo de um cadastro já pendente ("troque o pasto para
  //     Pasto Sul") sem reiniciar a conversa. Só quando não há conversa ativa
  //     (ela já é dona do texto livre acima) e existe uma operação pendente
  //     do tipo 'cadastro' — `tentarEditarPendente` devolve null quando não
  //     há nada a interceptar, e a mensagem segue o fluxo normal.
  if (!ehSlash) {
    const respostaEdicao = await tentarEditarPendente(client, conexao, chatId, texto, agora);
    if (respostaEdicao) return { texto: respostaEdicao };
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
  // Guarda a pendência (mesma tabela/padrão das conversas de cadastro) para
  // que a PRÓXIMA mensagem — "1", o nome, ou "usar fazenda NOME" — resolva a
  // escolha e retome esta intenção original automaticamente, em vez de exigir
  // que o comando seja reenviado.
  if (INTENCOES_ESCOPADAS.has(intent.intencao) && fazendas.length > 1 && conexao.fazenda_id == null) {
    await salvarSelecaoFazendaPendente(client, conexao, fazendas, intent, texto, agora);
    return { texto: [
      'Você possui mais de uma fazenda. Escolha uma antes de continuar:',
      '',
      listaNumerada(fazendas),
      '',
      'Envie: usar fazenda NOME, ou apenas o número da opção.',
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
    case INTENCOES.RESUMO_CONSOLIDADO_FAZENDAS:
      return { texto: formatarResumoConsolidadoFazendas(dbConta) };
    case INTENCOES.LISTAR_PASTOS:
      return { texto: formatarPastagens(db, { fazendaNome }) };
    case INTENCOES.CONSULTAR_RESULTADO_LOTE: {
      const r = resolverLotePorNome(db.lotes, intent.parametros.nome);
      if (r.status === 'ambiguo') return { texto: `Há mais de um lote com esse nome:\n\n${listaNumerada(r.candidatos)}` };
      if (r.status !== 'ok') return { texto: MSG.LOTE_NAO_ENCONTRADO };
      return { texto: formatarResultadoLote(db, r.lote) };
    }
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
  // Numerados (Sprint Paridade 1, bloco 5): permite "resolver alerta 3" logo
  // após listar — mesma lista recomputada (não é estado persistido entre
  // mensagens), então só é confiável se nada mudou nos alertas nesse meio-tempo.
  alertas.slice(0, 8).forEach((a, idx) => linhas.push(`${idx + 1}. ${emoji[a.prioridade] || '•'} ${a.titulo}${a.fazendaNome ? ` — ${a.fazendaNome}` : ''}`));
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

// ── Seleção de fazenda PENDENTE (correção da seleção numérica) ──────────────
// Guarda, na mesma linha/tabela `telegram_conversas` das conversas de
// cadastro (nunca coexistem — uma cancela a outra), a lista EXATA mostrada ao
// usuário e a intenção original interrompida, para retomá-la sem exigir que o
// comando seja reenviado.
async function buscarSelecaoFazendaPendente(client, chatId) {
  const { data } = await client.from('telegram_conversas')
    .select('*')
    .eq('telegram_chat_id', String(chatId))
    .eq('status', STATUS_CONVERSA.ATIVA)
    .eq('intencao_atual', SELECAO_FAZENDA_SENTINELA)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function salvarSelecaoFazendaPendente(client, conexao, fazendas, intentOriginal, textoOriginal, agora) {
  await client.from('telegram_conversas').insert({
    owner_user_id: conexao.owner_user_id,
    user_id: conexao.user_id,
    telegram_chat_id: conexao.telegram_chat_id,
    fazenda_id: null,
    intencao_atual: SELECAO_FAZENDA_SENTINELA,
    etapa_atual: 'selecionar_fazenda',
    dados_coletados: {
      opcoes: fazendas.map((f, idx) => ({ indice: idx + 1, fazenda_id: f.id, nome: f.nome })),
      intencaoOriginal: intentOriginal.intencao,
      parametrosOriginais: intentOriginal.parametros,
      textoOriginal,
    },
    status: STATUS_CONVERSA.ATIVA,
    expira_em: calcularExpiraConversa(agora).toISOString(),
  });
}

// Chamada no topo de `processarComandoBotInterno`, ANTES de classificar a
// mensagem — uma resposta como "1" nunca bate em nenhuma intenção conhecida,
// então sem isto o fallback de ajuda do webhook (fluxo legado) a interceptava
// primeiro. Devolve `null` quando não há pendência (segue o fluxo normal).
async function tratarSelecaoFazendaPendente(client, conexao, chatId, texto, ehSlash, cancelExplicito, agora) {
  const pendente = await buscarSelecaoFazendaPendente(client, chatId);
  if (!pendente) return null;

  if (conversaExpirada(pendente, agora)) {
    await encerrarConversa(client, pendente.id, STATUS_CONVERSA.EXPIRADA);
    // Um /comando novo não precisa do aviso de expiração — só segue normal.
    return ehSlash ? null : { texto: 'Essa seleção expirou.\n\nEnvie novamente o comando que deseja realizar.' };
  }

  if (cancelExplicito) {
    await encerrarConversa(client, pendente.id, STATUS_CONVERSA.CANCELADA);
    return { texto: MSG.CADASTRO_CANCELADO };
  }
  // Um /comando novo (não-cancelamento) interrompe a pendência, igual às
  // conversas de cadastro, e segue para classificar esse comando normalmente.
  if (ehSlash) {
    await encerrarConversa(client, pendente.id, STATUS_CONVERSA.CANCELADA);
    return null;
  }

  const { opcoes, intencaoOriginal, parametrosOriginais, textoOriginal } = pendente.dados_coletados || {};
  const r = interpretarSelecaoFazenda(texto, opcoes);

  if (r.status === 'ambiguo') {
    return { texto: `Encontrei mais de uma fazenda parecida. Qual delas você deseja usar?\n\n${listaNumerada(r.candidatos)}` };
  }
  if (r.status !== 'ok') {
    return { texto: [
      'Não encontrei essa opção.',
      '',
      'Escolha uma das fazendas abaixo:',
      '',
      listaNumerada(opcoes || [], 'nome'),
    ].join('\n') };
  }

  // Nunca confia cegamente no fazenda_id da pendência: revalida contra a
  // conta no momento da resposta (a fazenda pode ter sido removida nesse
  // meio-tempo, ou pertencer a outra conta).
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const fazendaAtual = (dbConta.fazendas || []).find((f) => Number(f.id) === Number(r.opcao.fazenda_id));
  if (!fazendaAtual) {
    await encerrarConversa(client, pendente.id, STATUS_CONVERSA.CANCELADA);
    return { texto: MSG.FAZENDA_SEM_ACESSO };
  }

  const { error } = await client.from('telegram_connections').update({ fazenda_id: fazendaAtual.id }).eq('id', conexao.id);
  if (error) return { texto: MSG.FALHA };

  await registrarAuditoria(client, conexao, {
    acao: 'trocar_fazenda', intencao: 'SELECIONAR_FAZENDA', comando_original: texto,
    dados_anteriores: { fazenda_id: conexao.fazenda_id }, dados_posteriores: { fazenda_id: fazendaAtual.id }, sucesso: true,
  });
  await encerrarConversa(client, pendente.id, STATUS_CONVERSA.CONCLUIDA);
  // ponytail: seleção via lista pendente troca a fazenda ATIVA da conexão,
  // igual ao "usar fazenda NOME" explícito — não existe hoje um conceito de
  // fazenda "só para esta operação" no bot (fazenda_id é sempre da conexão);
  // criar esse escopo temporário seria uma feature nova não pedida.
  conexao.fazenda_id = fazendaAtual.id;

  const confirmacao = `✅ Fazenda ${fazendaAtual.nome} selecionada.`;
  if (!intencaoOriginal) return { texto: confirmacao };

  // Retoma a intenção original recursivamente: com `conexao.fazenda_id` já
  // definido, o portão de "mais de uma fazenda" mais abaixo passa direto e o
  // switch da intenção executa normalmente — mesma função, mesmo caminho de
  // qualquer comando novo.
  const retomado = await processarComandoBotInterno({
    client, conexao, texto: textoOriginal, chatId, agora,
    intent: { intencao: intencaoOriginal, parametros: parametrosOriginais || {}, requerConfirmacao: false },
  });
  return { texto: retomado ? `${confirmacao}\n\n${retomado.texto}` : confirmacao };
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

// ── Confirmação editável (Sprint Paridade 1, bloco 4) ────────────────────────
// Corrige UM campo de uma operação `cadastro` ainda pendente, sem reiniciar a
// conversa. Reaproveita o mesmo `buscarPendente`/`calcularExpiraEm` do resto
// do fluxo de confirmação; a revalidação em si é 100% do módulo puro
// `edicaoPendente.js` (mesmo `prepararCadastro` de sempre). Devolve `null`
// quando não há nada a interceptar (sem pendência, tipo não editável, ou a
// mensagem não é uma frase de edição) — a chamada segue o fluxo normal.
async function tentarEditarPendente(client, conexao, chatId, texto, agora) {
  const op = await buscarPendente(client, chatId);
  if (!op || op.tipo_operacao !== 'cadastro') return null;

  const edicao = interpretarEdicaoCampo(texto);
  if (!edicao) return null;

  const { intencao, dados } = op.payload || {};
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const resultado = aplicarEdicaoPendente({
    intencao,
    dadosAtuais: dados,
    campoBruto: edicao.campoBruto,
    valorBruto: edicao.valorBruto,
    ctx: { db, hoje: agora, fazendaId: op.fazenda_id ?? null },
  });

  if (!resultado.ok) {
    if (resultado.erro === 'CAMPO_AMBIGUO') {
      return `Há mais de um campo parecido com "${edicao.campoBruto}": ${resultado.candidatos.join(', ')}. Seja mais específico.`;
    }
    if (resultado.erro === 'CAMPO_NAO_RECONHECIDO') {
      return `Não reconheço o campo "${edicao.campoBruto}" neste cadastro.`;
    }
    if (resultado.candidatos) {
      return `Há mais de um resultado com esse nome:\n\n${listaNumerada(resultado.candidatos)}`;
    }
    return MSG[resultado.erro] || MSG.FALHA;
  }

  // action_id estável: UPDATE na mesma linha pendente, nunca cria uma nova.
  // Guarda `.eq('status', STATUS.PENDENTE)` contra uma corrida com /confirmar.
  const { data: atualizado, error } = await client.from('telegram_operacoes_pendentes')
    .update({ payload: { intencao, dados: resultado.dadosNovos }, expira_em: calcularExpiraEm(agora).toISOString() })
    .eq('id', op.id).eq('status', STATUS.PENDENTE)
    .select('id').maybeSingle();
  if (error || !atualizado) return MSG.FALHA;

  const campoLabel = String(resultado.campo).replace(/_/g, ' ');
  return [
    `${campoLabel.charAt(0).toUpperCase()}${campoLabel.slice(1)} alterado.`,
    '',
    ...resultado.resultado.resumo,
    '',
    'Responda /confirmar para concluir ou /cancelar para desistir.',
  ].join('\n');
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

  if (plano.rpc) await aplicarRpc(client, conexao, plano.rpc);
  else await aplicarWrites(client, conexao, plano.writes);
  await registrarAuditoria(client, conexao, {
    acao: plano.tipo, intencao, sucesso: true, dados_posteriores: dados,
  });
  return mensagemSucessoCadastro(plano);
}

// Mensagem de sucesso pós-execução. A maioria dos cadastros usa o resumo
// "Confirme X:" → "Registrado X." (transformação genérica). Os tipos cujo
// resumo começa com um verbo de intenção ("Vou marcar..."/"Vou reabrir...")
// teriam uma mensagem de sucesso que lê como pré-ação; para esses, uma
// mensagem própria no passado.
const SUCESSO_POR_TIPO = {
  tratativa_alerta: '✅ Alerta atualizado.',
  reabrir_alerta: '✅ Alerta reaberto.',
  excluir_fazenda: '✅ Fazenda excluída.',
  excluir_pasto: '✅ Pasto excluído.',
};
function mensagemSucessoCadastro(plano) {
  if (SUCESSO_POR_TIPO[plano.tipo]) return SUCESSO_POR_TIPO[plano.tipo];
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

  if (plano.rpc) await aplicarRpc(client, conexao, plano.rpc);
  else await aplicarWrites(client, conexao, plano.writes);
  await registrarAuditoria(client, conexao, {
    acao: nomeFerramenta, intencao: nomeFerramenta, sucesso: true, dados_posteriores: params,
  });
  return ferramenta.formatResult(plano, { confirmado: true });
}

// Sprint Paridade 1, bloco 4: chamada transacional — substitui `aplicarWrites`
// para as operações migradas para RPC (`op.payload.rpc`/`plano.rpc`). Uma
// única chamada `client.rpc(...)` cujo corpo já é uma transação de banco
// (tudo aplica ou nada aplica), ao contrário de `aplicarWrites`, que é um
// `for` sequencial sem checagem de erro nenhuma entre passos.
async function aplicarRpc(client, conexao, rpc) {
  const { error } = await client.rpc(rpc.nome, { p_owner_user_id: conexao.owner_user_id, ...rpc.params });
  if (error) throw new Error(error.message || 'RPC_FALHOU');
}

export async function aplicarWrites(client, conexao, writes) {
  for (const w of writes) {
    if (w.tipo === 'insert') {
      await client.from(w.tabela).insert({ owner_user_id: conexao.owner_user_id, ...w.registro });
    } else if (w.tipo === 'update') {
      let q = client.from(w.tabela).update(w.patch);
      Object.entries(w.match || {}).forEach(([k, v]) => { q = q.eq(k, v); });
      await q.eq('owner_user_id', conexao.owner_user_id);
    } else if (w.tipo === 'delete') {
      let q = client.from(w.tabela).delete();
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

// Recalcula sobre o db fresco (idempotente / sem qty velha) e aplica via RPC
// transacional (Sprint Paridade 1, bloco 4) — antes eram 3 awaits sequenciais
// sem transação (nem checagem de erro entre eles); agora um único
// `registrar_saida_lote` (tipo 'transferencia_saida').
async function executarTransferencia(client, conexao, op) {
  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const db = filtrarDbPorFazenda(dbConta, op.fazenda_id);
  const plano = prepararTransferenciaAnimais(db, op.payload);
  if (!plano.ok) throw new Error(plano.erro);

  await aplicarRpc(client, conexao, plano.rpc);

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
