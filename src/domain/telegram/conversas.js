// Estado conversacional em várias etapas (Parte 4). Puro, sem I/O: o webhook
// persiste em `telegram_conversas` e usa estas funções para decidir a próxima
// pergunta, mesclar respostas e detectar expiração. A confirmação de qualquer
// mutação continua sendo uma operação pendente separada — a conversa só
// COLETA os dados; não executa nada.

export const CONVERSA_TTL_MINUTOS = 10;

export const STATUS_CONVERSA = {
  ATIVA: 'ativa',
  CONCLUIDA: 'concluida',
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
};

export function calcularExpiraEm(agora = new Date(), minutos = CONVERSA_TTL_MINUTOS) {
  return new Date(agora.getTime() + minutos * 60 * 1000);
}

export function conversaExpirada(conversa, agora = new Date()) {
  if (!conversa?.expira_em) return false;
  return new Date(conversa.expira_em).getTime() <= agora.getTime();
}

/** Só valores realmente informados sobrescrevem — null/undefined não apagam o já coletado. */
export function mesclarDados(atual = {}, novos = {}) {
  const out = { ...(atual || {}) };
  Object.entries(novos || {}).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  });
  return out;
}

/**
 * Um slot já está resolvido? Obrigatório: precisa de valor não-vazio. Opcional
 * marcado `perguntar`: basta ter sido visitado (chave presente, mesmo que '' de
 * "pular"). Opcional sem `perguntar`: nunca pendente (usa default depois).
 */
function slotResolvido(slot, dados) {
  const v = dados?.[slot.nome];
  if (slot?.obrigatorio === false) return v !== undefined;
  return v !== null && v !== undefined && v !== '';
}
function slotPerguntavel(slot) {
  return slot?.obrigatorio !== false || slot?.perguntar === true;
}

/**
 * Próximo slot a perguntar: obrigatório faltante, ou opcional `perguntar` ainda
 * não visitado. Retorna null quando não há mais nada a perguntar.
 * @param {Array<{nome,pergunta,obrigatorio?,perguntar?}>} campos
 */
export function proximoCampoFaltante(campos = [], dados = {}) {
  const falta = (Array.isArray(campos) ? campos : [])
    .filter(slotPerguntavel)
    .find((c) => !slotResolvido(c, dados));
  return falta ? { nome: falta.nome, pergunta: falta.pergunta } : null;
}

/** Não há mais nada a perguntar? */
export function estaCompleta(campos = [], dados = {}) {
  return proximoCampoFaltante(campos, dados) === null;
}
