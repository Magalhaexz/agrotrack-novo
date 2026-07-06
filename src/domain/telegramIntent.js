// Interpretador simples de mensagens do Bot do Telegram (Sprint 8) — sem IA
// generativa: classifica por comando fixo (`/algo`) ou por palavra-chave.
// Puramente por regras (regex), determinístico e sem custo externo.

export const INTENCOES = {
  AJUDA: 'ajuda',
  RELATORIO: 'relatorio',
  PRIORIDADES: 'prioridades',
  PAGAMENTOS: 'pagamentos',
  ESTOQUE: 'estoque',
  TAREFAS: 'tarefas',
  LOTES: 'lotes',
  DESCONHECIDO: 'desconhecido',
};

// Ordem importa: testado de cima para baixo, primeira regra que casar vence.
// "relatorio"/"como está a fazenda" é checado antes de "hoje" (prioridades)
// para "Como está minha fazenda hoje?" cair em relatório geral, não prioridades.
const REGRAS = [
  { intencao: INTENCOES.AJUDA, padrao: /^\/?ajuda\b|\bhelp\b|\bcomandos\b/ },
  { intencao: INTENCOES.RELATORIO, padrao: /^\/?relatorio\b|relat[óo]rio|como est[áa] (a )?(minha )?fazenda|resumo (geral|do dia)/ },
  { intencao: INTENCOES.PRIORIDADES, padrao: /^\/?prioridades\b|o que (eu )?preciso fazer|o que fazer hoje|prioridade/ },
  { intencao: INTENCOES.PAGAMENTOS, padrao: /^\/?pagamentos\b|conta.*vencid|pagamento|financeiro|contas? a pagar/ },
  { intencao: INTENCOES.ESTOQUE, padrao: /^\/?estoque\b|produto.*acabando|estoque|insumo/ },
  { intencao: INTENCOES.TAREFAS, padrao: /^\/?tarefas\b|tarefas?/ },
  { intencao: INTENCOES.LOTES, padrao: /^\/?lotes\b|\blotes?\b|\bgmd\b|pesagem|pronto para venda|pior lote|qual lote/ },
];

function normalizar(texto) {
  return String(texto || '').trim().toLowerCase();
}

/** Classifica a mensagem do produtor em uma das `INTENCOES`. Nunca lança erro. */
export function classificarIntencaoTelegram(texto) {
  const normalizado = normalizar(texto);
  if (!normalizado) return INTENCOES.DESCONHECIDO;

  const regra = REGRAS.find((item) => item.padrao.test(normalizado));
  return regra ? regra.intencao : INTENCOES.DESCONHECIDO;
}
