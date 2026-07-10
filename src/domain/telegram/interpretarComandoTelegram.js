// Interpretador estruturado de mensagens do Bot do Telegram (Sprint bot
// interativo). Determinístico — só regex/aliases, SEM IA externa. Puro, sem
// I/O: recebe o texto e devolve uma INTENÇÃO estruturada; quem chama (o
// webhook) resolve dados, permissão e confirmação.
//
// Distinto de `telegramComandos.js::interpretarComandoTelegram` (legado, que
// devolve só o NOME do comando em string). Aqui o retorno é sempre
//   { intencao, parametros, requerConfirmacao }.
//
// Regra de ouro: ações mutáveis (transferência, renomeação) SEMPRE marcam
// `requerConfirmacao: true`, e mensagens ambíguas nunca viram ação.

export const INTENCOES = {
  AJUDA: 'AJUDA',
  LISTAR_FAZENDAS: 'LISTAR_FAZENDAS',
  SELECIONAR_FAZENDA: 'SELECIONAR_FAZENDA',
  LISTAR_LOTES: 'LISTAR_LOTES',
  VER_LOTE: 'VER_LOTE',
  CONSULTAR_ESTOQUE: 'CONSULTAR_ESTOQUE',
  CONSULTAR_FINANCEIRO: 'CONSULTAR_FINANCEIRO',
  VER_ALERTAS: 'VER_ALERTAS',
  VER_MANEJOS: 'VER_MANEJOS',
  VER_PESAGENS: 'VER_PESAGENS',
  RESUMO: 'RESUMO',
  TRANSFERIR_ANIMAIS_ENTRE_LOTES: 'TRANSFERIR_ANIMAIS_ENTRE_LOTES',
  RENOMEAR_LOTE: 'RENOMEAR_LOTE',
  // Cadastros por linguagem natural (conversa em etapas quando faltar dado):
  REGISTRAR_PESAGEM: 'REGISTRAR_PESAGEM',
  CADASTRAR_DESPESA: 'CADASTRAR_DESPESA',
  CADASTRAR_RECEITA: 'CADASTRAR_RECEITA',
  REGISTRAR_ENTRADA_ESTOQUE: 'REGISTRAR_ENTRADA_ESTOQUE',
  CONFIRMAR: 'CONFIRMAR',
  CANCELAR: 'CANCELAR',
  AMBIGUO: 'AMBIGUO',
  DESCONHECIDO: 'DESCONHECIDO',
};

const intent = (intencao, parametros = {}, requerConfirmacao = false) => ({
  intencao,
  parametros,
  requerConfirmacao,
});

/**
 * Limpa um nome de lote/fazenda capturado: tira espaços, artigo e a palavra-chave
 * "lote" inicial (para "do lote Recria 01" virar "Recria 01"). Nomes literalmente
 * iniciados por "Lote" (ex.: "Lote A") ficam sem o prefixo aqui — o resolvedor de
 * lote no webhook deve tentar casar com e sem o prefixo "lote ".
 */
function limparNome(bruto) {
  return String(bruto || '')
    .trim()
    .replace(/^(?:o|a)\s+/i, '')
    .replace(/^lote\s+/i, '')
    .replace(/[.,;!?]+$/, '')
    .trim();
}

function normalizar(texto) {
  return String(texto || '').trim().replace(/\s+/g, ' ');
}

// --- Ações mutáveis (checadas primeiro; parâmetros preservam a grafia original) ---

const RE_TRANSFERIR = /^\/?(?:transferir|mover|passar|movimentar)\s+(\d+)\s*(?:animais|animal|cabe[çc]as?|bois?|reses?)?\s+(?:do|de)\s+(.+?)\s+(?:para|pro|pra)(?:\s+o)?\s+(.+?)$/i;
// Verbo de transferência sem quantidade: ainda é transferência (o handler pede a qtd).
const RE_TRANSFERIR_SEM_QTD = /^\/?(?:transferir|mover|passar|movimentar)\s+(?:animais|cabe[çc]as?)?\s*(?:do|de)\s+(.+?)\s+(?:para|pro|pra)(?:\s+o)?\s+(.+?)$/i;
const RE_RENOMEAR = /^\/?(?:renomear|renomeie)\s+(?:o\s+)?lote\s+(.+?)\s+(?:para|pra|como)\s+(.+?)$/i;
// "trocar lote 1 para lote 2": trocar/mudar + lote, sem qty — ambíguo (Parte 19).
const RE_TROCAR_LOTE_AMBIGUO = /^\/?(?:trocar|mudar|passar)\s+(?:o\s+)?lote\s+(.+?)\s+(?:para|pra)\s+(?:o\s+)?(?:lote\s+)?(.+?)$/i;

// --- Cadastros (ações mutáveis; a extração de dados fica no orquestrador) ---
// Gatilho imperativo OU verbo de registro no início — nunca perguntas
// ("quanto gastei" é consulta, tratada mais abaixo).
const RE_CAD_DESPESA = /^\/?(?:cadastr\w+|registr\w+|lan[çc]\w+|anot\w+)\s+(?:uma?\s+)?despesa\b|^\/?(?:gastei|paguei)\b|\bdespesa de\b/i;
const RE_CAD_RECEITA = /^\/?(?:cadastr\w+|registr\w+|lan[çc]\w+|anot\w+)\s+(?:uma?\s+)?receita\b|^\/?recebi\b|\breceita de\b/i;
const RE_REG_PESAGEM = /^\/?(?:registr\w+|cadastr\w+|anot\w+)\s+(?:uma?\s+)?pesagem\b|\bpesagem de\b|\bpesou\b|\bpeso m[ée]dio de\b/i;
const RE_REG_ENT_ESTOQUE = /^\/?(?:cadastr\w+|registr\w+|adicion\w+|coloc\w+|dar entrada)\b.*\bestoque\b|\bentr(?:ou|ada de)\b.*\b(?:kg|sacos?|litros?|fardos?|un)\b|^\/?adicion\w+\s+\d+/i;

// --- Fazenda ---
const RE_SELECIONAR_FAZENDA = /^\/?(?:usar|selecionar|ativar|trocar\s+para|mudar\s+para|trocar|mudar|escolher)\s+(?:a\s+|de\s+|para\s+a\s+)?fazenda\s+(.+?)$/i;
const RE_LISTAR_FAZENDAS = /^\/?(?:fazendas?|listar\s+fazendas?|mostrar\s+fazendas?|minhas?\s+fazendas?|quais\s+(?:s[ãa]o\s+)?(?:as\s+)?(?:minhas?\s+)?fazendas?|trocar\s+de\s+fazenda|mudar\s+de\s+fazenda)\b/i;

// --- Lote(s) ---
const RE_VER_LOTE = /^\/?(?:ver\s+|detalhes?\s+d[eo]\s+|mostrar\s+|consultar\s+)?lote\s+(.+?)$/i;
const RE_LISTAR_LOTES = /^\/?(?:lotes|ver\s+lotes|listar\s+lotes|mostrar\s+lotes|meus\s+lotes|quais\s+(?:s[ãa]o\s+)?(?:os\s+)?(?:meus\s+)?lotes)\b|\blotes\b/i;

// --- Estoque ---
const RE_ESTOQUE_QUANTO_TENHO = /quanto\s+(?:tenho|tem|resta)\s+de\s+(.+?)$/i;
const RE_ESTOQUE_ITEM = /^\/?estoque\s+(.+?)$/i;
const RE_ESTOQUE_BAIXO = /estoque\s+baixo|o\s+que\s+est[áa]\s+acabando|acabando|abaixo\s+do\s+m[íi]nimo/i;
const RE_ESTOQUE = /^\/?estoque\b|como\s+est[áa]\s+o\s+estoque|ver\s+estoque|insumos?/i;

// --- Financeiro ---
const RE_FINANCEIRO_LOTE = /^\/?financeiro\s+lote\s+(.+?)$/i;
const RE_FINANCEIRO_FILTRO = /^\/?financeiro\s+(vencer|vencidas?|hoje|semana|pagas?)\b/i;
const RE_FINANCEIRO = /^\/?financeiro\b|contas?\s+(?:a\s+)?(?:vencer|vencidas?|pagar)|conta.*vencid|financeir|movimenta[çc][ãa]o\s+financeira|saldo|quanto\s+(?:eu\s+)?(?:gastei|gasto|custou|entrou|recebi|sobrou)|meu\s+lucro|qual\s+(?:o\s+)?(?:meu\s+)?(?:lucro|saldo)/i;

// --- Alertas / manejos / pesagens / resumo ---
const RE_ALERTAS = /^\/?alertas?\b|ver\s+alertas?|tem\s+alerta|vacina\s+atrasada|o\s+que\s+est[áa]\s+pendente/i;
const RE_MANEJOS = /^\/?manejos?\b|mostrar\s+manejos?|manejos?\s+(?:da\s+)?(?:semana|hoje|atrasad)|manejo\s+atrasad/i;
const RE_PESAGENS = /^\/?pesagens?\b|[úu]ltimas?\s+pesagens?|qual\s+lote\s+precisa\s+pesar|pr[óo]xima\s+pesagem|ver\s+pesagens?/i;
const RE_RESUMO = /^\/?resumo\b|resumo\s+d[ao]\s+fazenda|resumo\s+geral/i;

const RE_AJUDA = /^\/?(?:ajuda|help|comandos|menu|start|iniciar)\b/i;
const RE_CONFIRMAR = /^\/?(?:confirmar|confirmo|confirma|sim[,!.\s]*(?:confirmar?)?|pode\s+confirmar)\b/i;
const RE_CANCELAR = /^\/?(?:cancelar|cancela|desistir|abortar|n[ãa]o[,!.\s]*(?:cancelar?)?)\b/i;

/**
 * Interpreta a mensagem do usuário em uma intenção estruturada.
 * @param {string} texto
 * @returns {{ intencao: string, parametros: object, requerConfirmacao: boolean }}
 */
export function interpretarComandoTelegram(texto) {
  const t = normalizar(texto);
  if (!t) return intent(INTENCOES.DESCONHECIDO);

  // 1. Confirmação/cancelamento (curtos, checados antes de tudo).
  if (RE_CONFIRMAR.test(t)) return intent(INTENCOES.CONFIRMAR);
  if (RE_CANCELAR.test(t)) return intent(INTENCOES.CANCELAR);

  // 2. Ações mutáveis (sempre requerConfirmacao). Transferência com qty antes
  //    da ambígua "trocar lote X para Y".
  let m = t.match(RE_TRANSFERIR);
  if (m) {
    return intent(INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES, {
      quantidade: Number(m[1]),
      loteOrigem: limparNome(m[2]),
      loteDestino: limparNome(m[3]),
    }, true);
  }

  // 3. Fazenda: seleção por nome antes de "trocar lote" (para "trocar para
  //    fazenda X" não cair na ambiguidade de lote).
  m = t.match(RE_SELECIONAR_FAZENDA);
  if (m) {
    const nome = limparNome(m[1]);
    if (nome) return intent(INTENCOES.SELECIONAR_FAZENDA, { nome });
  }
  if (RE_LISTAR_FAZENDAS.test(t)) return intent(INTENCOES.LISTAR_FAZENDAS);

  // 4. Renomear lote (verbo explícito) antes da ambiguidade genérica.
  m = t.match(RE_RENOMEAR);
  if (m) {
    return intent(INTENCOES.RENOMEAR_LOTE, {
      loteAtual: limparNome(m[1]),
      novoNome: limparNome(m[2]),
    }, true);
  }

  // 5. Transferência sem quantidade explícita (ainda é transferência; qtd null).
  m = t.match(RE_TRANSFERIR_SEM_QTD);
  if (m) {
    return intent(INTENCOES.TRANSFERIR_ANIMAIS_ENTRE_LOTES, {
      quantidade: null,
      loteOrigem: limparNome(m[1]),
      loteDestino: limparNome(m[2]),
    }, true);
  }

  // 6. "trocar lote X para Y" sem quantidade → ambíguo (não assume destrutivo).
  m = t.match(RE_TROCAR_LOTE_AMBIGUO);
  if (m) {
    return intent(INTENCOES.AMBIGUO, {
      lote1: limparNome(m[1]),
      lote2: limparNome(m[2]),
    });
  }

  // 6b. Cadastros (ações mutáveis). Checados antes das consultas equivalentes
  //     (ex.: pesagem cadastro antes de VER_PESAGENS). A extração dos dados é
  //     feita pelo orquestrador (extrairEntidades) — aqui só classifica.
  if (RE_REG_PESAGEM.test(t)) return intent(INTENCOES.REGISTRAR_PESAGEM, {}, true);
  if (RE_CAD_DESPESA.test(t)) return intent(INTENCOES.CADASTRAR_DESPESA, {}, true);
  if (RE_CAD_RECEITA.test(t)) return intent(INTENCOES.CADASTRAR_RECEITA, {}, true);
  if (RE_REG_ENT_ESTOQUE.test(t)) return intent(INTENCOES.REGISTRAR_ENTRADA_ESTOQUE, {}, true);

  // 7. Estoque com item/quantidade (antes do estoque genérico).
  m = t.match(RE_ESTOQUE_QUANTO_TENHO);
  if (m) return intent(INTENCOES.CONSULTAR_ESTOQUE, { item: limparNome(m[1]) });
  if (RE_ESTOQUE_BAIXO.test(t)) return intent(INTENCOES.CONSULTAR_ESTOQUE, { filtro: 'baixo' });
  m = t.match(RE_ESTOQUE_ITEM);
  if (m) return intent(INTENCOES.CONSULTAR_ESTOQUE, { item: limparNome(m[1]) });
  if (RE_ESTOQUE.test(t)) return intent(INTENCOES.CONSULTAR_ESTOQUE, {});

  // 8. Financeiro (filtro por lote / período antes do genérico).
  m = t.match(RE_FINANCEIRO_LOTE);
  if (m) return intent(INTENCOES.CONSULTAR_FINANCEIRO, { lote: limparNome(m[1]) });
  m = t.match(RE_FINANCEIRO_FILTRO);
  if (m) return intent(INTENCOES.CONSULTAR_FINANCEIRO, { filtro: m[1].toLowerCase().replace(/s$/, '') });
  if (RE_FINANCEIRO.test(t)) return intent(INTENCOES.CONSULTAR_FINANCEIRO, {});

  // 9. Alertas / manejos / pesagens / resumo.
  if (RE_ALERTAS.test(t)) return intent(INTENCOES.VER_ALERTAS);
  if (RE_MANEJOS.test(t)) return intent(INTENCOES.VER_MANEJOS);
  if (RE_PESAGENS.test(t)) return intent(INTENCOES.VER_PESAGENS);
  if (RE_RESUMO.test(t)) return intent(INTENCOES.RESUMO);

  // 10. Lotes: ver um lote específico antes de listar todos.
  m = t.match(RE_VER_LOTE);
  if (m) return intent(INTENCOES.VER_LOTE, { nome: limparNome(m[1]) });
  if (RE_LISTAR_LOTES.test(t)) return intent(INTENCOES.LISTAR_LOTES);

  // 11. Ajuda / start.
  if (RE_AJUDA.test(t)) return intent(INTENCOES.AJUDA);

  return intent(INTENCOES.DESCONHECIDO);
}
