// Autorização central dos comandos do Bot do Telegram (Parte 17). Puro, sem
// I/O: decide se um perfil pode executar uma intenção. Reaproveita
// `auth/perfis.js` (mesma matriz do app) — NÃO cria uma segunda fonte de
// verdade de permissão. Quem chama (o webhook) lê o `perfil` do `profiles` do
// `user_id` da conexão no servidor; nunca confia no texto da mensagem.
import { perfilTemPermissao } from '../../auth/perfis.js';
import { INTENCOES } from './interpretarComandoTelegram.js';

// Intenções de consulta: exigem só acesso à fazenda (o recorte por fazenda já
// garante isolamento). Mapeadas para a permissão de leitura equivalente do app.
const PERMISSAO_POR_INTENCAO = {
  [INTENCOES.LISTAR_FAZENDAS]: 'fazendas:ver',
  [INTENCOES.SELECIONAR_FAZENDA]: 'fazendas:ver',
  [INTENCOES.LISTAR_LOTES]: 'lotes:ver',
  [INTENCOES.VER_LOTE]: 'lotes:ver',
  [INTENCOES.CONSULTAR_ESTOQUE]: 'estoque:ver',
  [INTENCOES.CONSULTAR_FINANCEIRO]: 'financeiro:ver',
  [INTENCOES.VER_ALERTAS]: 'dashboard:ver',
  [INTENCOES.VER_MANEJOS]: 'sanitario:ver',
  [INTENCOES.VER_PESAGENS]: 'pesagens:ver',
  [INTENCOES.RESUMO]: 'dashboard:ver',
  // Ações mutáveis:
  [INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES]: 'animais:movimentar',
  [INTENCOES.RENOMEAR_LOTE]: 'lotes:editar',
};

// Intenções sem dado sensível: qualquer chat vinculado pode usar.
const SEM_PERMISSAO = new Set([
  INTENCOES.AJUDA,
  INTENCOES.CONFIRMAR,
  INTENCOES.CANCELAR,
  INTENCOES.AMBIGUO,
  INTENCOES.DESCONHECIDO,
]);

/**
 * @param {string} perfil papel do usuário (proprietario/gerente/operador/visualizador).
 * @param {string} intencao uma das `INTENCOES`.
 * @returns {{ permitido: boolean, permissao: string|null }}
 */
export function podeExecutarComandoTelegram(perfil, intencao) {
  if (SEM_PERMISSAO.has(intencao)) return { permitido: true, permissao: null };
  const permissao = PERMISSAO_POR_INTENCAO[intencao] || null;
  if (!permissao) return { permitido: false, permissao: null };
  return { permitido: perfilTemPermissao(perfil, permissao), permissao };
}

/** Uma intenção altera dados? (usada para negar mutação a visualizador cedo). */
export function intencaoEhMutavel(intencao) {
  return intencao === INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES
    || intencao === INTENCOES.RENOMEAR_LOTE;
}
