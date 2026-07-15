// Contexto conversacional do Assistente IA (seção 5 do spec). Puro, sem I/O —
// o orquestrador (`api/_telegramIA.js`) persiste em `telegram_ia_contexto` e
// usa estas funções para expirar, mesclar turnos e montar o histórico que vai
// para a Claude API. Guarda só o TEXTO da conversa; nenhuma escrita é
// decidida aqui (isso é `telegram_operacoes_pendentes`, como em toda outra
// parte do bot).
export const CONTEXTO_TTL_MINUTOS = 20;
// Limite de turnos guardados (usuário+assistente = 1 turno) — contexto maior
// não melhora a resposta e custa tokens à toa a cada nova chamada à IA.
export const CONTEXTO_MAX_TURNOS = 6;

export function calcularExpiraContexto(agora = new Date(), minutos = CONTEXTO_TTL_MINUTOS) {
  return new Date(agora.getTime() + minutos * 60 * 1000);
}

export function contextoExpirado(contexto, agora = new Date()) {
  if (!contexto?.expira_em) return false;
  return new Date(contexto.expira_em).getTime() <= agora.getTime();
}

/** Acrescenta um par (usuário, assistente) e mantém só os últimos N turnos. */
export function adicionarTurno(mensagensAtuais, { textoUsuario, textoAssistente }) {
  const lista = Array.isArray(mensagensAtuais) ? mensagensAtuais : [];
  const proxima = [
    ...lista,
    { role: 'user', content: String(textoUsuario || '') },
    { role: 'assistant', content: String(textoAssistente || '') },
  ];
  const limite = CONTEXTO_MAX_TURNOS * 2;
  return proxima.length > limite ? proxima.slice(proxima.length - limite) : proxima;
}

/** Histórico no formato de `messages` da Claude API (role/content apenas). */
export function construirHistoricoParaClaude(mensagens) {
  return (Array.isArray(mensagens) ? mensagens : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
}

// Comandos de controle (seção 5): sempre tratados ANTES de chamar a IA — nunca
// dependem de interpretação de linguagem natural, para funcionar mesmo se o
// provedor estiver fora do ar.
const RE_CANCELAR = /^\/?(?:cancelar|cancela|parar|para)\b/i;
const RE_RECOMECAR = /^\/?(?:come[çc]ar de novo|recome[çc]ar|limpar conversa|reiniciar)\b/i;
const RE_TROCAR_FAZENDA = /^\/?trocar fazenda\b|^\/?trocar de fazenda\b/i;
const RE_MENU = /^\/?menu\b/i;
const RE_AJUDA = /^\/?ajuda\b|^\/?help\b/i;

/** @returns {'cancelar'|'recomecar'|'trocar_fazenda'|'menu'|'ajuda'|null} */
export function comandoDeControle(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  if (RE_CANCELAR.test(t)) return 'cancelar';
  if (RE_RECOMECAR.test(t)) return 'recomecar';
  if (RE_TROCAR_FAZENDA.test(t)) return 'trocar_fazenda';
  if (RE_MENU.test(t)) return 'menu';
  if (RE_AJUDA.test(t)) return 'ajuda';
  return null;
}
