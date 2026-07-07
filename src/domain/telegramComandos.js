// Comandos de barra do Bot do Telegram que faltavam no Sprint 8
// (`/start`, `/status`, `/contas`, `/alertas`) — hotfix.
//
// Sem I/O: recebe o texto da mensagem e o contexto já resolvido (vínculo,
// alertas) e devolve só o texto de resposta. `api/telegram-webhook.js` chama
// isto ANTES do classificador de intenção do Sprint 8
// (`src/domain/telegramIntent.js`), mas só depois de checar o código
// HERDON-000000 — então "/start HERDON-482913" (deep link) nunca chega aqui,
// continua caindo no fluxo de pareamento do Sprint 7.
import { gerarRespostaAjudaTelegram } from './telegramRelatorio.js';

// Comandos já tratados pelo Sprint 8 (telegramIntent.js) — devolvendo `null`
// aqui, o webhook deixa o classificador de intenção cuidar deles como já
// fazia, sem duplicar lógica.
const COMANDOS_SPRINT8 = new Set(['relatorio', 'prioridades', 'pagamentos', 'estoque', 'tarefas', 'lotes']);

const COMANDOS_NOVOS = new Set(['start', 'ajuda', 'status', 'contas', 'alertas']);

const MSG_START = 'Olá! Eu sou o bot de alertas do HERDON. Para vincular sua conta, envie aqui o código gerado no HERDON, no formato HERDON-000000. Para ver os comandos disponíveis, envie /ajuda.';

const MSG_STATUS = 'Bot do HERDON ativo. Integração Telegram respondendo corretamente.';

const MSG_CONTAS_VINCULADO = 'Este Telegram está vinculado ao HERDON.';

const MSG_NAO_VINCULADO = 'Este Telegram ainda não está vinculado a uma conta HERDON. Acesse o HERDON, gere o código de conexão e envie aqui no formato HERDON-000000.';

const MSG_ALERTAS_ERRO = 'Não consegui carregar os alertas agora. Tente novamente em instantes.';

const MSG_NAO_RECONHECIDO = 'Comando não reconhecido. Envie /ajuda para ver as opções disponíveis.';

const PRIORIDADE_EMOJI = { critico: '🔴', atencao: '🟡', decisao: '🟢' };
const LIMITE_ALERTAS_LISTADOS = 5;

function montarRespostaAjuda() {
  return [
    'Comandos disponíveis:',
    '/status — verifica se o bot está ativo',
    '/alertas — mostra um resumo dos alertas da operação',
    '/contas — mostra se este Telegram está vinculado a uma conta HERDON',
    '/ajuda — mostra esta ajuda',
    '',
    'Para vincular sua conta, envie o código gerado no HERDON, no formato HERDON-000000.',
    '',
    gerarRespostaAjudaTelegram(),
  ].join('\n');
}

function formatarResumoAlertas(alertas) {
  const lista = (Array.isArray(alertas) ? alertas : []).filter((a) => a?.prioridade !== 'informativo');
  if (lista.length === 0) return '✅ Nenhum alerta pendente agora.';

  const porPrioridade = { critico: 0, atencao: 0, decisao: 0 };
  lista.forEach((alerta) => {
    if (porPrioridade[alerta?.prioridade] !== undefined) porPrioridade[alerta.prioridade] += 1;
  });

  const linhas = [
    `📋 Alertas HERDON — total: ${lista.length}`,
    `🔴 Crítico: ${porPrioridade.critico} | 🟡 Atenção: ${porPrioridade.atencao} | 🟢 Decisão: ${porPrioridade.decisao}`,
    '',
  ];
  lista.slice(0, LIMITE_ALERTAS_LISTADOS).forEach((alerta) => {
    linhas.push(`${PRIORIDADE_EMOJI[alerta.prioridade] || '•'} ${alerta.titulo}`);
  });
  if (lista.length > LIMITE_ALERTAS_LISTADOS) {
    linhas.push(`• +${lista.length - LIMITE_ALERTAS_LISTADOS} outro(s) alerta(s)`);
  }
  return linhas.join('\n');
}

/**
 * Extrai o nome do comando de barra (`/start`, `/alertas@HerdonBot foo`...).
 * Devolve `null` quando o texto não é um comando (segue fluxo livre já
 * existente) ou quando é um comando do Sprint 8 (`telegramIntent.js` cuida).
 * Devolve `'desconhecido'` para qualquer outro comando de barra não mapeado.
 */
export function interpretarComandoTelegram(texto) {
  const match = String(texto || '').trim().match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s|$)/);
  if (!match) return null;

  const nome = match[1].toLowerCase();
  if (COMANDOS_SPRINT8.has(nome)) return null;
  return COMANDOS_NOVOS.has(nome) ? nome : 'desconhecido';
}

/**
 * Gera a resposta de texto para um comando já interpretado por
 * `interpretarComandoTelegram`. `vinculado` indica se o chat_id já está em
 * `telegram_connections`; `alertas` só é usado por `/alertas` quando vinculado
 * e sem erro de carregamento.
 */
export function gerarRespostaComandoTelegram(comando, { vinculado = false, alertas = null, alertasErro = false } = {}) {
  switch (comando) {
    case 'start':
      return MSG_START;
    case 'ajuda':
      return montarRespostaAjuda();
    case 'status':
      return MSG_STATUS;
    case 'contas':
      return vinculado ? MSG_CONTAS_VINCULADO : MSG_NAO_VINCULADO;
    case 'alertas':
      if (!vinculado) return MSG_NAO_VINCULADO;
      if (alertasErro) return MSG_ALERTAS_ERRO;
      return formatarResumoAlertas(alertas);
    default:
      return MSG_NAO_RECONHECIDO;
  }
}
