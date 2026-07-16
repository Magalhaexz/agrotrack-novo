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
  [INTENCOES.REGISTRAR_PESAGEM]: 'pesagens:editar',
  [INTENCOES.CADASTRAR_DESPESA]: 'financeiro:editar',
  [INTENCOES.CADASTRAR_RECEITA]: 'financeiro:editar',
  [INTENCOES.REGISTRAR_ENTRADA_ESTOQUE]: 'estoque:movimentar',
  // Sprint bot operacional determinístico — novos cadastros/ações:
  [INTENCOES.CADASTRAR_TAREFA]: 'tarefas:editar',
  [INTENCOES.CADASTRAR_ITEM_ESTOQUE]: 'estoque:editar',
  [INTENCOES.DAR_BAIXA_ESTOQUE]: 'estoque:movimentar',
  [INTENCOES.TROCAR_LOTE_PASTO]: 'lotes:editar',
  // Sprint de expansão do bot operacional — novos cadastros/ações:
  [INTENCOES.CADASTRAR_LOTE]: 'lotes:editar',
  [INTENCOES.CADASTRAR_PASTO]: 'pastagens:editar',
  [INTENCOES.REGISTRAR_VENDA]: 'animais:movimentar',
  [INTENCOES.REGISTRAR_MORTE]: 'animais:movimentar',
  [INTENCOES.FINALIZAR_LOTE]: 'lotes:editar',
  [INTENCOES.CADASTRAR_MANEJO]: 'sanitario:editar',
  [INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO]: 'suplementacao:editar',
  [INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO]: 'suplementacao:editar',
  // Sprint Paridade 1 — Fazendas/Lotes/Pesagens/Pastagens:
  [INTENCOES.CADASTRAR_FAZENDA]: 'fazendas:editar',
  [INTENCOES.RENOMEAR_FAZENDA]: 'fazendas:editar',
  [INTENCOES.LISTAR_PASTOS]: 'pastagens:ver',
  [INTENCOES.CONSULTAR_RESULTADO_LOTE]: 'lotes:ver',
  [INTENCOES.EDITAR_PESAGEM]: 'pesagens:editar',
  [INTENCOES.EXCLUIR_PESAGEM]: 'pesagens:excluir',
  [INTENCOES.AJUSTAR_LOTACAO]: 'lotes:editar',
  [INTENCOES.EDITAR_LOTE]: 'lotes:editar',
  [INTENCOES.EDITAR_PASTO]: 'pastagens:editar',
  [INTENCOES.RETIRAR_LOTE_PASTO]: 'lotes:editar',
};

// Cadastros que abrem conversa em etapas (slot-filling) quando falta dado.
const INTENCOES_CADASTRO = new Set([
  INTENCOES.REGISTRAR_PESAGEM, INTENCOES.CADASTRAR_DESPESA,
  INTENCOES.CADASTRAR_RECEITA, INTENCOES.REGISTRAR_ENTRADA_ESTOQUE,
  INTENCOES.CADASTRAR_TAREFA, INTENCOES.CADASTRAR_ITEM_ESTOQUE,
  INTENCOES.DAR_BAIXA_ESTOQUE, INTENCOES.TROCAR_LOTE_PASTO,
  INTENCOES.CADASTRAR_LOTE, INTENCOES.CADASTRAR_PASTO,
  INTENCOES.REGISTRAR_VENDA, INTENCOES.REGISTRAR_MORTE, INTENCOES.FINALIZAR_LOTE,
  INTENCOES.CADASTRAR_MANEJO, INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO,
  INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO,
  INTENCOES.CADASTRAR_FAZENDA, INTENCOES.RENOMEAR_FAZENDA,
  INTENCOES.EDITAR_PESAGEM, INTENCOES.EXCLUIR_PESAGEM,
  INTENCOES.AJUSTAR_LOTACAO, INTENCOES.EDITAR_LOTE,
  INTENCOES.EDITAR_PASTO, INTENCOES.RETIRAR_LOTE_PASTO,
]);

export function intencaoEhCadastro(intencao) {
  return INTENCOES_CADASTRO.has(intencao);
}

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
    || intencao === INTENCOES.RENOMEAR_LOTE
    || INTENCOES_CADASTRO.has(intencao);
}
