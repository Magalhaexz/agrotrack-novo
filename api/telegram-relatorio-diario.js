/* global process */
// Relatório Diário via Telegram (Sprint 6) — POST protegido por
// TELEGRAM_REPORT_SECRET. Lê os dados operacionais de UMA conta (definida em
// TELEGRAM_OWNER_USER_ID, nunca pelo corpo da requisição), monta o `db` e
// reaproveita o Motor Único de Alertas (Sprint 5, `src/domain/alertasUnificados.js`)
// e o formatador (`src/domain/telegramRelatorio.js`) — nenhum cálculo novo
// nem sistema de alerta paralelo.
import { getSupabaseAdminClient, extractBearerToken } from './_supabaseAdmin.js';
import { enviarMensagemTelegram, getTelegramEnvStatus } from './_telegram.js';
import { gerarAlertasUnificados } from '../src/domain/alertasUnificados.js';
import { gerarRelatorioDiarioTelegram } from '../src/domain/telegramRelatorio.js';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

// Tabelas que `gerarAlertasUnificados` precisa para montar o `db` — mesma
// lista de fontes já auditada no Sprint 5, nada além disso é lido.
const TABELAS_NECESSARIAS = [
  'lotes',
  'animais',
  'pesagens',
  'movimentacoes_financeiras',
  'estoque',
  'movimentacoes_estoque',
  'tarefas',
  'sanitario',
  'pastagens',
];

function isAuthorized(req, secret) {
  const token = extractBearerToken(req);
  return Boolean(token) && token === secret;
}

async function montarDbDaConta(client, ownerUserId) {
  const resultados = await Promise.all(
    TABELAS_NECESSARIAS.map((tabela) => client.from(tabela).select('*').eq('owner_user_id', ownerUserId))
  );

  const db = {};
  TABELAS_NECESSARIAS.forEach((tabela, index) => {
    const { data, error } = resultados[index];
    if (error) throw error;
    db[tabela] = Array.isArray(data) ? data : [];
  });
  return db;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Método não permitido.' });
  }

  // 1. Segredo do endpoint — sem ele, nem tenta autenticar (evita endpoint público).
  const reportSecret = readEnv('TELEGRAM_REPORT_SECRET');
  if (!reportSecret) {
    return res.status(500).json({ ok: false, code: 'MISSING_REPORT_SECRET', message: 'Relatório não está configurado no servidor.' });
  }
  if (!isAuthorized(req, reportSecret)) {
    return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  }

  // 2. Variáveis do Telegram.
  const telegramEnv = getTelegramEnvStatus();
  if (!telegramEnv.botTokenPresent || !telegramEnv.chatIdPresent) {
    return res.status(500).json({ ok: false, code: 'MISSING_TELEGRAM_ENV', message: 'Telegram não está configurado no servidor.' });
  }

  // 3. Conta a consultar — só de variável de ambiente do servidor. Nunca
  //    aceitar `owner_user_id` vindo do corpo da requisição (MVP sem tabela
  //    de preferências por conta ainda — ver docs/SPRINT6_TELEGRAM_ALERTAS_RESULTADO.md).
  const ownerUserId = readEnv('TELEGRAM_OWNER_USER_ID');
  if (!ownerUserId) {
    return res.status(500).json({ ok: false, code: 'MISSING_OWNER_USER_ID', message: 'Conta do relatório não está configurada no servidor.' });
  }

  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const dryRun = body.dryRun === true;

  try {
    const client = getSupabaseAdminClient();
    const db = await montarDbDaConta(client, ownerUserId);
    const alertas = gerarAlertasUnificados(db);
    const mensagem = gerarRelatorioDiarioTelegram(alertas);

    if (dryRun) {
      return res.status(200).json({ ok: true, dryRun: true, totalAlertas: alertas.length, mensagem });
    }

    await enviarMensagemTelegram(mensagem);
    return res.status(200).json({ ok: true, totalAlertas: alertas.length });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      code: error?.code || 'TELEGRAM_REPORT_FAILED',
      message: 'Não foi possível gerar ou enviar o relatório agora.',
    });
  }
}
