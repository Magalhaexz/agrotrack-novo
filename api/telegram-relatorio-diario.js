/* global process */
// Relatório Diário via Telegram — multiusuário (Sprint 7). POST protegido por
// TELEGRAM_REPORT_SECRET. Não depende mais de TELEGRAM_OWNER_USER_ID/
// TELEGRAM_CHAT_ID (legado do Sprint 6): busca todas as conexões ativas com
// daily_report_enabled=true em telegram_connections e envia um relatório por
// conexão, usando o Motor Único de Alertas (Sprint 5,
// src/domain/alertasUnificados.js) e o formatador (Sprint 6,
// src/domain/telegramRelatorio.js) — nenhum cálculo novo nem sistema de
// alerta paralelo. Uma falha de envio não interrompe as demais conexões.
import { getSupabaseAdminClient, extractBearerToken } from './_supabaseAdmin.js';
import { enviarMensagemTelegramParaChat, getTelegramEnvStatus } from './_telegram.js';
import { montarDbDaConta } from './_herdonDb.js';
import { prepararAlertasEscopados, enriquecerAlertasComFazenda } from '../src/domain/telegramFazenda.js';
import { gerarAlertasUnificados } from '../src/domain/alertasUnificados.js';
import { aplicarTratativasAosAlertas } from '../src/domain/tratativasAlertas.js';
import { gerarRelatorioDiarioTelegram } from '../src/domain/telegramRelatorio.js';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function isAuthorized(req, secret) {
  const token = extractBearerToken(req);
  return Boolean(token) && token === secret;
}

async function registrarLog(client, { ownerUserId, connectionId, status, errorMessage }) {
  await client.from('telegram_notification_logs').insert({
    owner_user_id: ownerUserId,
    telegram_connection_id: connectionId,
    notification_type: 'daily_report',
    status,
    error_message: errorMessage || null,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }).select('id').maybeSingle().then(() => null, () => null);
}

async function processarConexao(client, conexao, { dryRun }) {
  try {
    const dbConta = await montarDbDaConta(client, conexao.owner_user_id);
    const { db, identificarFazenda } = prepararAlertasEscopados(dbConta, conexao.fazenda_id);
    const alertasBrutos = gerarAlertasUnificados(db);
    // Sprint 16: o relatório diário não deve repetir alertas já resolvidos/
    // ignorados/adiados-para-o-futuro — mesma tratativa da Central.
    const alertasVisiveis = aplicarTratativasAosAlertas(alertasBrutos, db.alertas_tratativas, new Date())
      .filter((alerta) => alerta.visivel);
    const alertas = enriquecerAlertasComFazenda(alertasVisiveis, db, identificarFazenda);
    const mensagem = gerarRelatorioDiarioTelegram(alertas);

    if (dryRun) {
      return { ownerUserId: conexao.owner_user_id, ok: true, totalAlertas: alertas.length };
    }

    await enviarMensagemTelegramParaChat(conexao.telegram_chat_id, mensagem);
    await registrarLog(client, { ownerUserId: conexao.owner_user_id, connectionId: conexao.id, status: 'sent' });
    return { ownerUserId: conexao.owner_user_id, ok: true, totalAlertas: alertas.length };
  } catch (error) {
    if (!dryRun) {
      await registrarLog(client, {
        ownerUserId: conexao.owner_user_id,
        connectionId: conexao.id,
        status: 'failed',
        errorMessage: String(error?.message || error?.code || 'erro_desconhecido'),
      });
    }
    return { ownerUserId: conexao.owner_user_id, ok: false, code: error?.code || 'SEND_FAILED' };
  }
}

export default async function handler(req, res) {
  // GET é aceito porque a Vercel Cron Job só invoca rotas via GET (ver
  // vercel.json). Chamadas manuais/testes continuam usando POST.
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  const reportSecret = readEnv('TELEGRAM_REPORT_SECRET');
  if (!reportSecret) {
    return res.status(500).json({ ok: false, code: 'MISSING_REPORT_SECRET', message: 'Relatório não está configurado no servidor.' });
  }
  if (!isAuthorized(req, reportSecret)) {
    return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  }

  const telegramEnv = getTelegramEnvStatus();
  if (!telegramEnv.botTokenPresent) {
    return res.status(500).json({ ok: false, code: 'MISSING_TELEGRAM_ENV', message: 'Telegram não está configurado no servidor.' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const dryRun = body.dryRun === true;

  const client = getSupabaseAdminClient();
  const { data: conexoes, error } = await client
    .from('telegram_connections')
    .select('id, owner_user_id, telegram_chat_id, fazenda_id')
    .eq('is_active', true)
    .eq('daily_report_enabled', true);

  if (error) {
    return res.status(502).json({ ok: false, code: 'CONNECTIONS_QUERY_FAILED', message: 'Não foi possível carregar as conexões agora.' });
  }

  const lista = Array.isArray(conexoes) ? conexoes : [];
  const resultados = [];
  for (const conexao of lista) {
    // Sequencial de propósito: evita estourar rate limit do Bot API com envios em paralelo.
    resultados.push(await processarConexao(client, conexao, { dryRun }));
  }

  return res.status(200).json({
    ok: true,
    dryRun,
    totalConexoes: lista.length,
    enviados: resultados.filter((item) => item.ok).length,
    falhas: resultados.filter((item) => !item.ok).length,
    resultados,
  });
}
