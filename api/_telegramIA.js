// Orquestrador do Assistente IA do Telegram (sprint "Assistente Inteligente").
// Chamado pelo webhook DEPOIS do bot determinístico (`_telegramBot.js`)
// devolver null (mensagem não bateu com nenhum comando/regex conhecido) e
// ANTES do fallback legado (Sprint 8) — é a camada de linguagem natural real,
// mas nunca substitui o que já funciona sem IA: se a chave não estiver
// configurada, ou a Claude API falhar, devolve null e o webhook segue para o
// fallback determinístico (seção 29 do spec, "sem IA" continua funcionando).
//
// A IA nunca escreve nada diretamente. Toda ação de escrita vira uma
// operação pendente em `telegram_operacoes_pendentes` (tipo_operacao=
// 'ia_tool') — o MESMO mecanismo de confirmação/idempotência/TTL de todo o
// resto do bot, executado por `executarFerramentaIA` em `_telegramBot.js`.
import { montarDbDaConta } from './_herdonDb.js';
import { filtrarDbPorFazenda } from '../src/domain/escopoFazenda.js';
import { perfilTemPermissao } from '../src/auth/perfis.js';
import { hojeLocalISO } from '../src/domain/dataCivil.js';
import {
  carregarPerfil, registrarAuditoria, salvarOperacaoPendente, listaNumerada, nomeFazendaAtiva,
} from './_telegramBot.js';
import { ferramentasPermitidas } from '../src/domain/telegram/telegramToolsRegistry.js';
import {
  construirSystemPrompt, interpretarMensagemTelegramIA,
} from '../src/domain/telegram/interpretarMensagemIA.js';
import {
  contextoExpirado, adicionarTurno, construirHistoricoParaClaude, comandoDeControle, calcularExpiraContexto,
} from '../src/domain/telegram/contextoIA.js';
import { iaDisponivel, chamarClaudeParaTelegram } from './_anthropicClient.js';

const MSG = {
  AJUDA: [
    'Você pode conversar comigo em linguagem natural — pergunte sobre seus lotes, estoque, financeiro, tarefas ou alertas, ou peça para cadastrar/registrar algo.',
    '',
    'Comandos de controle: cancelar, começar de novo, trocar fazenda, menu.',
  ].join('\n'),
  CANCELADO: 'Certo, cancelado.',
  RECOMECAR: 'Conversa reiniciada. Pode perguntar ou pedir algo novo.',
  MENU: 'Envie /ajuda para ver os comandos, ou pergunte algo em linguagem natural — ex.: "quanto gado eu tenho?".',
  INDISPONIVEL_SEM_CHAVE: null, // sinaliza "cai para o fallback legado", nunca aparece pro usuário
  ERRO_GENERICO: 'Não consegui entender agora. Tente reformular, ou use /ajuda para ver os comandos.',
  SEM_FAZENDA_PARA_ESCREVER: 'Você tem mais de uma fazenda e nenhuma está selecionada. Antes de fazer isso, me diga: em qual fazenda?',
};

async function buscarContexto(client, chatId) {
  const { data } = await client.from('telegram_ia_contexto').select('*').eq('telegram_chat_id', String(chatId)).maybeSingle();
  return data || null;
}

async function salvarContexto(client, conexao, mensagensAtuais, { textoUsuario, textoAssistente }, agora) {
  const mensagens = adicionarTurno(mensagensAtuais, { textoUsuario, textoAssistente });
  await client.from('telegram_ia_contexto').upsert({
    owner_user_id: conexao.owner_user_id,
    user_id: conexao.user_id,
    telegram_chat_id: String(conexao.telegram_chat_id),
    fazenda_id: conexao.fazenda_id ?? null,
    mensagens,
    atualizado_em: agora.toISOString(),
    expira_em: calcularExpiraContexto(agora).toISOString(),
  }, { onConflict: 'telegram_chat_id' });
}

async function limparContexto(client, chatId) {
  await client.from('telegram_ia_contexto').delete().eq('telegram_chat_id', String(chatId));
}

/**
 * Ponto de entrada. Retorna { texto } quando a IA respondeu, ou null quando
 * deve cair no fallback sem IA (chave ausente, erro do provedor, ou resposta
 * inválida que preferimos não expor como se fosse uma resposta real).
 */
export async function processarMensagemIA({ client, conexao, texto, chatId, agora = new Date() }) {
  if (!iaDisponivel()) return null;

  const controle = comandoDeControle(texto);
  if (controle === 'cancelar') {
    await limparContexto(client, chatId);
    return { texto: MSG.CANCELADO };
  }
  if (controle === 'recomecar') {
    await limparContexto(client, chatId);
    return { texto: MSG.RECOMECAR };
  }
  if (controle === 'menu') return { texto: MSG.MENU };
  if (controle === 'ajuda') return { texto: MSG.AJUDA };
  if (controle === 'trocar_fazenda') return null; // deixa o comando determinístico "usar fazenda X" tratar

  const perfil = await carregarPerfil(client, conexao.user_id);
  const ferramentas = ferramentasPermitidas(perfilTemPermissao, perfil);
  if (ferramentas.length === 0) return { texto: MSG.ERRO_GENERICO };

  const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
  const fazendas = Array.isArray(dbConta.fazendas) ? dbConta.fazendas : [];
  const db = filtrarDbPorFazenda(dbConta, conexao.fazenda_id);
  const fazendaNome = nomeFazendaAtiva(dbConta, conexao.fazenda_id);

  const contextoRow = await buscarContexto(client, chatId);
  const contextoValido = contextoRow && !contextoExpirado(contextoRow, agora);
  const historico = construirHistoricoParaClaude(contextoValido ? contextoRow.mensagens : []);

  const systemPrompt = construirSystemPrompt({
    perfil, fazendas, fazendaAtual: fazendaNome, dataHoje: hojeLocalISO(),
  });

  const resultado = await interpretarMensagemTelegramIA({
    texto, historico, ferramentas, systemPrompt, chamarClaude: chamarClaudeParaTelegram,
  });

  if (resultado.tipo === 'indisponivel') return null; // fallback sem IA (seção 29)

  if (resultado.tipo === 'texto') {
    await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: resultado.texto }, agora);
    return { texto: resultado.texto };
  }

  if (resultado.tipo === 'invalido') {
    // Nunca executa uma ferramenta que falhou a validação — registra o erro
    // técnico (seção 28: "se o resultado for inválido: não executar; pedir
    // esclarecimento; registrar erro técnico") e pede para o usuário reformular,
    // sem expor o nome de ferramenta alucinado nem detalhes internos.
    await registrarAuditoria(client, conexao, {
      acao: 'ia_resposta_invalida', intencao: resultado.ferramenta || 'desconhecida', sucesso: false,
      erro: resultado.motivo, comando_original: texto,
    });
    const texto2 = MSG.ERRO_GENERICO;
    await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: texto2 }, agora);
    return { texto: texto2 };
  }

  // resultado.tipo === 'ferramenta'
  const ferramenta = ferramentas.find((f) => f.name === resultado.nome);

  // Nunca grava em "todas as fazendas": ferramenta de escrita sem fazenda
  // definida numa conta multi-fazenda pede a fazenda antes de tudo (seção 6).
  if (ferramenta.riskLevel !== 'leitura' && fazendas.length > 1 && conexao.fazenda_id == null) {
    const texto2 = [MSG.SEM_FAZENDA_PARA_ESCREVER, '', listaNumerada(fazendas)].join('\n');
    await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: texto2 }, agora);
    return { texto: texto2 };
  }

  const plano = ferramenta.execute(db, resultado.parametros, { fazendaId: conexao.fazenda_id ?? null });

  if (!plano.ok) {
    const texto2 = mensagemDeErroDePlano(plano);
    await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: texto2 }, agora);
    return { texto: texto2 };
  }

  if (ferramenta.riskLevel === 'leitura') {
    const texto2 = ferramenta.formatResult(plano);
    await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: texto2 }, agora);
    return { texto: texto2 };
  }

  const ok = await salvarOperacaoPendente(client, conexao, 'ia_tool', { tool: ferramenta.name, params: resultado.parametros }, agora);
  const texto2 = ok ? ferramenta.formatResult(plano, { confirmado: false }) : MSG.ERRO_GENERICO;
  await salvarContexto(client, conexao, contextoValido ? contextoRow.mensagens : [], { textoUsuario: texto, textoAssistente: texto2 }, agora);
  return { texto: texto2 };
}

function mensagemDeErroDePlano(plano) {
  const candidatos = plano.candidatos;
  if (Array.isArray(candidatos) && candidatos.length > 0) {
    return `Encontrei mais de uma opção:\n\n${listaNumerada(candidatos)}\n\nQual delas?`;
  }
  if (plano.erro === 'SALDO_INSUFICIENTE') {
    return `Saldo insuficiente. Disponível: ${plano.saldoAtual} ${plano.unidade || ''}`.trim();
  }
  return MSG.ERRO_GENERICO;
}
