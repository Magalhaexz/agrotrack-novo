// Regras puras das operações pendentes de confirmação do Bot (Parte 15).
// Sem I/O: o webhook persiste em `telegram_operacoes_pendentes` e usa estas
// funções para decidir expiração, autoria e idempotência.

export const TTL_MINUTOS = 5;

export const STATUS = {
  PENDENTE: 'pendente',
  CONFIRMADA: 'confirmada',
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
  EXECUTADA: 'executada',
  ERRO: 'erro',
};

/** Instante de expiração a gravar ao criar a operação. */
export function calcularExpiraEm(agora = new Date(), minutos = TTL_MINUTOS) {
  return new Date(agora.getTime() + minutos * 60 * 1000);
}

export function estaExpirada(op, agora = new Date()) {
  if (!op?.expira_em) return false;
  return new Date(op.expira_em).getTime() <= agora.getTime();
}

/**
 * Pode a mensagem atual confirmar/cancelar esta operação pendente?
 * Regras (Parte 15): só o mesmo usuário, mesmo chat, status ainda pendente e
 * dentro do prazo. Idempotência: uma operação já confirmada/executada não é
 * confirmada de novo.
 * @returns {{ ok: boolean, motivo: string|null }}
 */
export function podeConfirmar(op, { userId, chatId, agora = new Date() } = {}) {
  if (!op) return { ok: false, motivo: 'SEM_OPERACAO' };
  if (op.status !== STATUS.PENDENTE) {
    return { ok: false, motivo: op.status === STATUS.EXECUTADA ? 'JA_EXECUTADA' : 'NAO_PENDENTE' };
  }
  if (estaExpirada(op, agora)) return { ok: false, motivo: 'EXPIRADA' };
  if (userId != null && String(op.user_id) !== String(userId)) return { ok: false, motivo: 'OUTRO_USUARIO' };
  if (chatId != null && String(op.telegram_chat_id) !== String(chatId)) return { ok: false, motivo: 'OUTRO_CHAT' };
  return { ok: true, motivo: null };
}

/** Só uma operação pendente e não expirada pode ser cancelada pelo dono. */
export function podeCancelar(op, contexto = {}) {
  return podeConfirmar(op, contexto);
}
