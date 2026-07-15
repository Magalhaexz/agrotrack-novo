/* global process */
// Webhook do Telegram (Sprint 7 + Sprint 8 + hotfix comandos + Assistente IA)
// — recebe updates do Bot API e diferencia cinco tipos de mensagem:
//   1. código HERDON-XXXXXX de pareamento (Sprint 7, fluxo inalterado);
//   2. comando/frase determinística do bot interativo (`_telegramBot.js`,
//      regex/aliases, sem IA) — tentado primeiro por ser grátis e já testado;
//   2b. quando (2) não reconhece a mensagem, o Assistente IA
//      (`_telegramIA.js`, Claude API com ferramentas) tenta interpretar em
//      linguagem natural — só ativa se ANTHROPIC_API_KEY estiver configurada
//      e a API responder; qualquer indisponibilidade cai para o passo 3 sem
//      erro visível ao usuário (seção 29 do spec: bot continua funcionando
//      100% sem IA);
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
import { enviarMensagemTelegramParaChat as enviarMensagemTelegramParaChatBase } from './_telegram.js';
import { extractHerdonCodeFromText, isCodeUsable } from './_telegramConnections.js';
import { montarDbDaConta } from './_herdonDb.js';
import { prepararAlertasEscopados, enriquecerAlertasComFazenda } from '../src/domain/telegramFazenda.js';
import { gerarAlertasUnificados } from '../src/domain/alertasUnificados.js';
import { aplicarTratativasAosAlertas } from '../src/domain/tratativasAlertas.js';
import { classificarIntencaoTelegram, INTENCOES } from '../src/domain/telegramIntent.js';
import { interpretarComandoTelegram, gerarRespostaComandoTelegram } from '../src/domain/telegramComandos.js';
import { processarComandoBot } from './_telegramBot.js';
import { processarMensagemIA } from './_telegramIA.js';
import { avaliarRateLimitTelegram, LIMITE_PADRAO, LIMITE_VINCULO } from '../src/domain/telegramRateLimit.js';
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

/** Envolve o envio real só para logar sucesso/falha de forma segura (sem token, sem texto da mensagem). Mesmo contrato (lança em caso de falha) — quem chama decide se ignora com `.catch()`. */
async function enviarMensagemTelegramParaChat(chatId, texto) {
  try {
    const resultado = await enviarMensagemTelegramParaChatBase(chatId, texto);
    console.log('[telegram-webhook] resposta enviada com sucesso');
    return resultado;
  } catch (error) {
    console.error('[telegram-webhook] sendMessage falhou', { code: error?.code || null });
    throw error;
  }
}

// Rate limit em memória, por chat_id (Sprint 20). Sobrevive só enquanto a
// function Vercel ficar "quente" entre invocações — reseta em cold start.
// Suficiente para o caso que importa (rajada de spam/loop no mesmo chat em
// segundos), documentado em docs/DECISAO_TELEGRAM_PRODUCAO.md.
// ponytail: Map sem limite de entradas distintas; se virar problema real de
// memória, trocar por tabela (telegram_eventos) com persistência real.
const eventosPorChat = new Map();

function registrarEventoEAvaliarRateLimit(chatId, agora, limite) {
  const anteriores = eventosPorChat.get(chatId) || [];
  const resultado = avaliarRateLimitTelegram({ chatId, agora, eventosRecentes: anteriores, limite });
  const janelaMs = 60 * 1000;
  const eventosRecentes = anteriores.filter((ts) => ts > agora.getTime() - janelaMs);
  if (resultado.permitido) eventosRecentes.push(agora.getTime());
  eventosPorChat.set(chatId, eventosRecentes);
  return resultado;
}

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
    // Sprint 28: `fazenda_id` recupera o recorte por fazenda da conexão (quando
    // ela foi vinculada a uma fazenda específica) — sem isso o /alertas de uma
    // conta multi-fazenda misturava alertas de todas as fazendas.
    .select('id, owner_user_id, telegram_chat_id, fazenda_id')
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
    // Log seguro (sem token, sem secret, sem corpo da mensagem): confirma se
    // o rejeitado é por header ausente (webhook registrado sem secret_token)
    // ou por valor divergente (secret_token diferente do TELEGRAM_WEBHOOK_SECRET).
    console.warn('[telegram-webhook] rejeitado: secret_token ausente ou divergente', {
      headerPresente: Boolean(req.headers?.['x-telegram-bot-api-secret-token']),
    });
    return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const message = body.message || body.edited_message || null;
  const chatId = message?.chat?.id;
  const texto = message?.text || '';
  console.log('[telegram-webhook] update recebido', { temChatId: Boolean(chatId) });

  // Sempre responde 200: sem isso o Telegram reenvia o mesmo update.
  if (!chatId) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const codigo = extractHerdonCodeFromText(texto);
  const comandoParaLimite = interpretarComandoTelegram(texto);
  const limite = (codigo || comandoParaLimite === 'start') ? LIMITE_VINCULO : LIMITE_PADRAO;
  const rateLimit = registrarEventoEAvaliarRateLimit(String(chatId), new Date(), limite);
  if (!rateLimit.permitido) {
    console.warn('[telegram-webhook] rate limit excedido', { quantidadeNaJanela: rateLimit.quantidadeNaJanela });
    return res.status(200).json({ ok: true, rateLimited: true });
  }

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

  // Bot interativo (novo): só para usuários já vinculados. Interpreta a
  // mensagem em uma intenção estruturada; se a intenção for atendida, responde
  // e encerra. Se não (ex.: /status, /relatorio, perguntas do Sprint 8),
  // devolve null e o fluxo legado abaixo segue inalterado.
  if (conexao) {
    try {
      const respostaBot = await processarComandoBot({ client, conexao, texto, chatId });
      if (respostaBot) {
        await enviarMensagemTelegramParaChat(chatId, respostaBot.texto).catch(() => null);
        return res.status(200).json({ ok: true, bot: true });
      }
    } catch (error) {
      console.error('[telegram-webhook] erro no bot interativo', error);
      await enviarMensagemTelegramParaChat(chatId, MSG_ERRO_RESPOSTA).catch(() => null);
      return res.status(200).json({ ok: true, bot: false });
    }

    // Assistente IA (linguagem natural): só tentado quando o bot
    // determinístico acima não reconheceu a mensagem. `processarMensagemIA`
    // nunca lança para fora — devolve null tanto por chave ausente quanto por
    // qualquer erro do provedor, e nesse caso o fluxo segue para o Sprint 8
    // abaixo exatamente como se a IA não existisse.
    try {
      const respostaIA = await processarMensagemIA({ client, conexao, texto, chatId });
      if (respostaIA) {
        await enviarMensagemTelegramParaChat(chatId, respostaIA.texto).catch(() => null);
        return res.status(200).json({ ok: true, ia: true });
      }
    } catch (error) {
      console.error('[telegram-webhook] erro no assistente ia — seguindo para o fallback sem ia', error);
    }
  }

  // Comandos novos do hotfix (/start, /status, /contas, /alertas) — checados
  // antes do "sem código", pois eles têm resposta própria mesmo sem vínculo.
  // Comandos do Sprint 8 (/relatorio etc.) devolvem null aqui e seguem para
  // o classificador de intenção mais abaixo, sem duplicar lógica.
  const comando = comandoParaLimite;
  if (comando) {
    console.log('[telegram-webhook] comando recebido', { comando });
    if (comando === 'alertas' && conexao) {
      try {
        const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
        const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, conexao.fazenda_id);
        const alertasBrutos = gerarAlertasUnificados(db);
        // Sprint 16: alertas resolvidos/ignorados/adiados-para-o-futuro não
        // devem aparecer como prioridade no /alertas — mesma tratativa da Central.
        const alertasVisiveis = aplicarTratativasAosAlertas(alertasBrutos, db.alertas_tratativas, new Date())
          .filter((alerta) => alerta.visivel);
        const alertas = enriquecerAlertasComFazenda(alertasVisiveis, db, identificarFazenda);
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
    const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
    const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, conexao.fazenda_id);
    const alertas = enriquecerAlertasComFazenda(gerarAlertasUnificados(db), db, identificarFazenda);
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
