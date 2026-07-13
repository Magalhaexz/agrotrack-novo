// Utilitario central de datas civis (Parte 2 da auditoria pos-6c9a30e).
// Datas civis (pesagem, vencimento, manejo, venda, competencia...) nao tem
// horario e nao devem passar por toISOString(), que converte para UTC e pode
// mudar o dia exibido/gravado para usuarios em America/Sao_Paulo (UTC-3) -
// em especial entre ~21h e meia-noite. Este arquivo roda tanto no browser
// quanto no runtime serverless do Vercel (api/*, Telegram), por isso usa
// timezone explicito em vez de depender do relogio local do processo.
const TIME_ZONE = 'America/Sao_Paulo';

const civilFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Data civil de "hoje" no fuso do produto (America/Sao_Paulo), formato YYYY-MM-DD.
export function hojeLocalISO(instant = new Date()) {
  return civilFormatter.format(instant);
}
