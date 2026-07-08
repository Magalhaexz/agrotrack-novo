// Rate limit do bot do Telegram (Sprint 20) — puro, sem I/O. O chamador
// (api/telegram-webhook.js) já filtra `eventosRecentes` para o `chatId` em
// questão e decide onde guardar o histórico (ver docs/DECISAO_TELEGRAM_PRODUCAO.md).

export const LIMITE_PADRAO = 10;
export const LIMITE_VINCULO = 20; // /start e HERDON-XXXXXX: mais generoso, não pode travar o pareamento legítimo.
export const JANELA_PADRAO_SEGUNDOS = 60;

/**
 * @param {object} params
 * @param {string|number|null} params.chatId
 * @param {Date} params.agora
 * @param {number[]} params.eventosRecentes - timestamps (ms) de eventos anteriores já filtrados para este chatId
 * @param {number} [params.limite]
 * @param {number} [params.janelaSegundos]
 */
export function avaliarRateLimitTelegram({
  chatId,
  agora,
  eventosRecentes,
  limite = LIMITE_PADRAO,
  janelaSegundos = JANELA_PADRAO_SEGUNDOS,
}) {
  if (!chatId) {
    return { permitido: false, motivo: 'chat_id_ausente', tentarNovamenteEmSegundos: 0, quantidadeNaJanela: 0 };
  }

  const agoraMs = agora instanceof Date ? agora.getTime() : Number(agora) || Date.now();
  const inicioJanela = agoraMs - janelaSegundos * 1000;
  const eventosNaJanela = (Array.isArray(eventosRecentes) ? eventosRecentes : [])
    .filter((ts) => Number(ts) > inicioJanela)
    .sort((a, b) => a - b);

  const quantidadeNaJanela = eventosNaJanela.length;

  if (quantidadeNaJanela >= limite) {
    const maisAntigo = eventosNaJanela[0];
    const tentarNovamenteEmSegundos = Math.max(1, Math.ceil((maisAntigo + janelaSegundos * 1000 - agoraMs) / 1000));
    return { permitido: false, motivo: 'rate_limit_excedido', tentarNovamenteEmSegundos, quantidadeNaJanela };
  }

  return { permitido: true, motivo: null, tentarNovamenteEmSegundos: 0, quantidadeNaJanela };
}
