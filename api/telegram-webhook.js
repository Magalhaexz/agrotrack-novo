/* global process */
// Webhook do Telegram (Sprint 7 + Sprint 8 + hotfix comandos) — recebe
// updates do Bot API e diferencia quatro tipos de mensagem:
//   1. código HERDON-XXXXXX de pareamento (Sprint 7, fluxo inalterado);
//   2. comando novo (/start, /status, /contas, /alertas, /ajuda — hotfix,
//      `src/domain/telegramComandos.js`);
//   3. comando fixo do Sprint 8 (/relatorio, /prioridades, /pagamentos,
//      /estoque, /tarefas, /lotes) ou pergunta livre por palavra-chave
//      (`src/domain/telegramIntent.js`) — SEM IA generativa, só reaproveita
//      o Motor Único de Alertas (Sprint 5) já calculado;
//   4. texto sem código nem comando: orienta a enviar o código de vínculo.
//
// O usuário é sempre identificado pelo `telegram_chat_id` já salvo em
// `telegram_connections` — nunca por um `owner_user_id` vindo do texto da
// mensagem. Nunca expõe TELEGRAM_BOT_TOKEN; a única validação de origem é o
// secret_token que o Telegram reenvia no header quando o webhook é
// registrado com `secret_token` (ver docs/SPRINT7_TELEGRAM_MULTIUSUARIO_RESULTADO.md).
import { getSupabaseAdminClient } from './_supabaseAdmin.js';
import { enviarMensagemTelegramParaChat } from './_telegram.js';
import { extractHerdonCodeFromText, isCodeUsable } from './_telegramConnections.js';
import { montarDbDaConta } from './_herdonDb.js';
import { gerarAlertasUnificados } from '../src/domain/alertasUnificados.js';
import { classificarIntencaoTelegram, INTENCOES } from '../src/domain/telegramIntent.js';
import { interpretarComandoTelegram, gerarRespostaComandoTelegram } from '../src/domain/telegramComandos.js';
import {
  gerarRelatorioDiarioTelegram,
  gerarRespostaAjudaTelegram,
  gerarRespostaPrioridadesTelegram,
  gerarRespostaPagamentosTelegram,
  gerarRespostaEstoqueTelegram,
  gerarRespostaTarefasTelegram,
  gerarRespostaLotesTelegram,
} from '../src/domain/telegramRelatorio.js';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

const MSG_SUCESSO = 'Telegram conectado ao HERDON com sucesso. Você já pode fechar esta conversa e voltar ao HERDON.';
const MSG_INVALIDO = 'Código inválido ou expirado. Gere um novo código no HERDON.';
const MSG_SEM_CODIGO = 'Envie o código gerado no HERDON, por exemplo: HERDON-482913';
const MSG_ERRO_RESPOSTA = 'Não consegui processar agora. Tente novamente ou use /ajuda.';

function isWebhookAuthorized(req) {
  const secret = readEnv('TELEGRAM_WEBHOOK_SECRET');
  if (!secret) return true; // Sem secret configurado: aceita (limitação documentada).
  const header = req.headers?.['x-telegram-bot-api-secret-token'];
  return header === secret;
}

/** Identifica o usuário só pela conexão já salva (chat_id → owner_user_id) — nunca por texto da mensagem. */
async function buscarConexaoAtiva(client, chatId) {
  const { data } = await client
    .from('telegram_connections')
    .select('id, owner_user_id, telegram_chat_id')
    .eq('telegram_chat_id', String(chatId))
    .eq('is_active', true)
    .maybeSingle();
  return data || null;
}

/** Assistente por regras (Sprint 8) — sem IA generativa: só filtra/formata os alertas já calculados. */
function gerarRespostaIntencao(intencao, { db, alertas }) {
  switch (intencao) {
    case INTENCOES.RELATORIO:
      return gerarRelatorioDiarioTelegram(alertas);
    case INTENCOES.PRIORIDADES:
      return gerarRespostaPrioridadesTelegram(alertas);
    case INTENCOES.PAGAMENTOS:
      return gerarRespostaPagamentosTelegram(alertas, { temMovimentacoes: (db.movimentacoes_financeiras || []).length > 0 });
    case INTENCOES.ESTOQUE:
      return gerarRespostaEstoqueTelegram(alertas, { temEstoque: (db.estoque || []).length > 0 });
    case INTENCOES.TAREFAS:
      return gerarRespostaTarefasTelegram(alertas, { temTarefas: (db.tarefas || []).length > 0 });
    case INTENCOES.LOTES:
      return gerarRespostaLotesTelegram(alertas, { temLotes: (db.lotes || []).length > 0 });
    case INTENCOES.AJUDA:
    case INTENCOES.DESCONHECIDO:
    default:
      return gerarRespostaAjudaTelegram();
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  if (!isWebhookAuthorized(req)) {
    return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const message = body.message || body.edited_message || null;
  const chatId = message?.chat?.id;
  const texto = message?.text || '';

  // Sempre responde 200: sem isso o Telegram reenvia o mesmo update.
  if (!chatId) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const codigo = extractHerdonCodeFromText(texto);
  if (codigo) {
    try {
      const client = getSupabaseAdminClient();
      const now = new Date();

      const { data: codeRow } = await client
        .from('telegram_connection_codes')
        .select('*')
        .eq('code', codigo)
        .maybeSingle();

      if (!isCodeUsable(codeRow, now)) {
        await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
        return res.status(200).json({ ok: true, connected: false });
      }

      const { error: upsertError } = await client.from('telegram_connections').upsert({
        owner_user_id: codeRow.owner_user_id,
        user_id: codeRow.user_id,
        fazenda_id: codeRow.fazenda_id,
        telegram_chat_id: String(chatId),
        telegram_username: message?.from?.username || null,
        telegram_first_name: message?.from?.first_name || null,
        telegram_last_name: message?.from?.last_name || null,
        is_active: true,
      }, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('[telegram-webhook] falha ao salvar conexão', upsertError);
        await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
        return res.status(200).json({ ok: true, connected: false });
      }

      // A conexão já foi salva: avisa o usuário antes de tentar marcar o
      // código como usado, para uma falha nesse passo não virar uma mensagem
      // de "código inválido" incorreta.
      await enviarMensagemTelegramParaChat(chatId, MSG_SUCESSO).catch(() => null);
      await client.from('telegram_connection_codes').update({ used_at: now.toISOString() }).eq('id', codeRow.id).then(() => null, () => null);
      return res.status(200).json({ ok: true, connected: true });
    } catch (error) {
      console.error('[telegram-webhook] erro inesperado', error);
      await enviarMensagemTelegramParaChat(chatId, MSG_INVALIDO).catch(() => null);
      return res.status(200).json({ ok: true, connected: false });
    }
  }

  // Não é código de pareamento: identifica o usuário só pela conexão já
  // salva. Nunca aceita owner_user_id vindo do texto da mensagem.
  const client = getSupabaseAdminClient();
  const conexao = await buscarConexaoAtiva(client, chatId).catch(() => null);

  // Comandos novos do hotfix (/start, /status, /contas, /alertas) — checados
  // antes do "sem código", pois eles têm resposta própria mesmo sem vínculo.
  // Comandos do Sprint 8 (/relatorio etc.) devolvem null aqui e seguem para
  // o classificador de intenção mais abaixo, sem duplicar lógica.
  const comando = interpretarComandoTelegram(texto);
  if (comando) {
    if (comando === 'alertas' && conexao) {
      try {
        const db = await montarDbDaConta(client, conexao.owner_user_id);
        const alertas = gerarAlertasUnificados(db);
        const resposta = gerarRespostaComandoTelegram(comando, { vinculado: true, alertas });
        await enviarMensagemTelegramParaChat(chatId, resposta).catch(() => null);
        return res.status(200).json({ ok: true, comando });
      } catch (error) {
        console.error('[telegram-webhook] erro ao carregar alertas para /alertas', error);
        const resposta = gerarRespostaComandoTelegram(comando, { vinculado: true, alertasErro: true });
        await enviarMensagemTelegramParaChat(chatId, resposta).catch(() => null);
        return res.status(200).json({ ok: true, comando, erro: true });
      }
    }
    const resposta = gerarRespostaComandoTelegram(comando, { vinculado: Boolean(conexao) });
    await enviarMensagemTelegramParaChat(chatId, resposta).catch(() => null);
    return res.status(200).json({ ok: true, comando });
  }

  if (!conexao) {
    await enviarMensagemTelegramParaChat(chatId, MSG_SEM_CODIGO).catch(() => null);
    return res.status(200).json({ ok: true, ignored: true });
  }

  try {
    const db = await montarDbDaConta(client, conexao.owner_user_id);
    const alertas = gerarAlertasUnificados(db);
    const intencao = classificarIntencaoTelegram(texto);
    const resposta = gerarRespostaIntencao(intencao, { db, alertas });
    await enviarMensagemTelegramParaChat(chatId, resposta).catch(() => null);
    return res.status(200).json({ ok: true, respondido: true, intencao });
  } catch (error) {
    console.error('[telegram-webhook] erro ao responder pergunta', error);
    await enviarMensagemTelegramParaChat(chatId, MSG_ERRO_RESPOSTA).catch(() => null);
    return res.status(200).json({ ok: true, respondido: false });
  }
}
