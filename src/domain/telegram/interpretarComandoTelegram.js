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
  // Sprint bot operacional determinístico — novos cadastros/ações:
  CADASTRAR_TAREFA: 'CADASTRAR_TAREFA',
  CADASTRAR_ITEM_ESTOQUE: 'CADASTRAR_ITEM_ESTOQUE',
  DAR_BAIXA_ESTOQUE: 'DAR_BAIXA_ESTOQUE',
  TROCAR_LOTE_PASTO: 'TROCAR_LOTE_PASTO',
  // Sprint de expansão do bot operacional — cadastros/ações que ainda faltavam:
  CADASTRAR_LOTE: 'CADASTRAR_LOTE',
  CADASTRAR_PASTO: 'CADASTRAR_PASTO',
  REGISTRAR_VENDA: 'REGISTRAR_VENDA',
  REGISTRAR_MORTE: 'REGISTRAR_MORTE',
  FINALIZAR_LOTE: 'FINALIZAR_LOTE',
  CADASTRAR_MANEJO: 'CADASTRAR_MANEJO',
  CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO: 'CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO',
  REGISTRAR_CONSUMO_SUPLEMENTACAO: 'REGISTRAR_CONSUMO_SUPLEMENTACAO',
  // Sprint Paridade 1 — Fazendas/Lotes/Pesagens/Pastagens:
  CADASTRAR_FAZENDA: 'CADASTRAR_FAZENDA',
  RENOMEAR_FAZENDA: 'RENOMEAR_FAZENDA',
  LISTAR_PASTOS: 'LISTAR_PASTOS',
  CONSULTAR_RESULTADO_LOTE: 'CONSULTAR_RESULTADO_LOTE',
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
// Troca de PASTO: precisa ser checada ANTES de RE_TROCAR_LOTE_AMBIGUO — "trocar
// o lote X para o pasto Y" também bateria na ambiguidade genérica de lote se
// checada depois (o destino "o pasto Y" passa no grupo de captura opcional
// dela). A palavra "pasto" é o sinal que desambigua as duas leituras.
const RE_TROCAR_PASTO = /^\/?(?:mov\w+|trocar|troque|mand\w+|lev\w+)\b.*\bpasto\b|\btrocar_pasto\b/i;

// --- Cadastros (ações mutáveis; a extração de dados fica no orquestrador) ---
// Gatilho imperativo OU verbo de registro no início — nunca perguntas
// ("quanto gastei" é consulta, tratada mais abaixo).
const RE_CAD_DESPESA = /^\/?(?:cadastr\w+|registr\w+|lan[çc]\w+|anot\w+)\s+(?:uma?\s+)?despesa\b|^\/?(?:gastei|paguei)\b|\bdespesa de\b/i;
const RE_CAD_RECEITA = /^\/?(?:cadastr\w+|registr\w+|lan[çc]\w+|anot\w+)\s+(?:uma?\s+)?receita\b|^\/?recebi\b|\breceita de\b/i;
const RE_REG_PESAGEM = /^\/?(?:registr\w+|cadastr\w+|anot\w+)\s+(?:uma?\s+)?pesagem\b|\bpesagem de\b|\bpesou\b|\bpeso m[ée]dio de\b/i;
const RE_REG_ENT_ESTOQUE = /^\/?(?:cadastr\w+|registr\w+|adicion\w+|coloc\w+|dar entrada)\b.*\bestoque\b|\bentr(?:ou|ada de)\b.*\b(?:kg|sacos?|litros?|fardos?|un)\b|^\/?adicion\w+\s+\d+/i;

// --- Sprint bot operacional determinístico: 4 novos cadastros/ações ---
// Tarefa: checada antes de despesa/receita (nenhuma colisão de palavra, mas
// mantém a ordem lógica dos cadastros existentes).
const RE_CAD_TAREFA = /^\/?(?:cadastr\w+|criar?|crie|anot\w+)\s+(?:uma?\s+)?(?:tarefa|lembrete)\b|^\/?agend\w+\b|\bme\s+lembr[ae]\b|\blembr[ae]\s+de\b|\btarefa\b/i;
// Item de estoque NOVO: precisa vir ANTES de RE_REG_ENT_ESTOQUE — "cadastre
// um item de estoque" contém a palavra "estoque" e cairia na entrada
// genérica se checado depois. A palavra "item"/"produto" é o sinal
// explícito que distingue "criar um item novo" de "somar quantidade a um
// item existente" (ambíguo em português sem esse sinal).
const RE_CAD_ITEM_ESTOQUE = /\bitem\s+novo\b|\bnovo\s+item\b|\bproduto\s+novo\b|\bnovo\s+produto\b|^\/?(?:cadastr\w+|criar?|crie)\s+(?:um\s+)?(?:item|produto)\b/i;

// --- Sprint de expansão do bot operacional: 8 novos cadastros/ações ---
// Lote/pasto NOVOS: verbo de criação + o substantivo logo em seguida (nunca
// colide com VER_LOTE/RE_CAD_ITEM_ESTOQUE — nenhum dos dois começa com
// "cadastrar/criar/crie" seguido de "lote"/"pasto").
const RE_CAD_LOTE = /^\/?(?:cadastr\w+|criar?|crie)\s+(?:um\s+|o\s+)?lote\b/i;
const RE_CAD_PASTO = /^\/?(?:cadastr\w+|criar?|crie|adicion\w+)\s+(?:um\s+|o\s+)?pasto\b/i;
// Venda/morte: verbos próprios, checados ANTES de RE_SAIDA_ESTOQUE (baixa
// genérica) e RE_CAD_DESPESA/RECEITA (não compartilham verbo).
const RE_REG_VENDA = /^\/?(?:vend[ae]|vendeu|vendi)\b|^\/?registr\w+\s+(?:a\s+)?venda\b/i;
const RE_REG_MORTE = /^\/?(?:morr\w+|perda\s+de)\b|^\/?registr\w+\s+(?:a\s+)?(?:morte|perda)\b|\bbaixa\s+por\s+morte\b/i;
// Finalizar lote: "finalizar/encerrar" + lote, ou "marque o lote X como finalizado".
const RE_FINALIZAR_LOTE = /^\/?(?:finaliz\w+|encerr\w+)\b.*\blote\b|\bmarque\s+o\s+lote\b.*\bfinalizado\b/i;
// Manejo sanitário: verbo específico no início, ou verbo genérico de cadastro
// + substantivo do domínio (evita colidir com despesa/receita/tarefa).
const RE_CAD_MANEJO = /^\/?(?:vacin\w+|vermifug\w+)\b|\bmanejo\s+sanit[áa]rio\b|^\/?(?:cadastr\w+|registr\w+|aplic\w+)\s+.*\b(?:vacina[çc][ãa]o|vermifuga[çc][ãa]o|ivermectina|tratamento)\b/i;
// Suplementação: planejamento ("planeje"/"alimentação") checado antes do
// consumo realizado; ambos checados ANTES de RE_SAIDA_ESTOQUE (que também
// reconhece "usei"/"consumi" de forma genérica) — a palavra de produto
// (ração/sal/suplemento/trato/proteinado) é o sinal que desambigua.
const RE_PLANEJ_SUPL = /^\/?planej\w+\b|^\/?cadastr\w+\s+.*\balimenta[çc][ãa]o\b/i;
const RE_CONSUMO_SUPL = /^\/?registr\w+\s+(?:o\s+)?consumo\b.*\b(?:sal|ra[çc][ãa]o|suplement\w*|trato|proteinado)\b|^\/?us(?:ei|ou|amos|ar)\b.*\b(?:sal|ra[çc][ãa]o|suplement\w*|trato|proteinado)\b|\bbaixa\s+da\s+alimenta[çc][ãa]o\b/i;

// --- Sprint Paridade 1: Fazendas/Lotes/Pesagens/Pastagens ---
// Cadastrar fazenda: verbo de criação + "fazenda", checado ANTES de
// RE_SELECIONAR_FAZENDA na cascata (seção 3) não é necessário — os verbos
// não colidem ("cadastrar/criar/crie" vs. "usar/selecionar/trocar/mudar").
const RE_CAD_FAZENDA = /^\/?(?:cadastr\w+|criar?|crie)\s+(?:uma\s+|a\s+)?fazenda\b/i;
// Renomear fazenda: verbos próprios ("altere"/"renomear"), nunca
// "mudar"/"trocar" (esses já são o gatilho de SELECIONAR_FAZENDA).
const RE_RENOMEAR_FAZENDA = /^\/?(?:renome\w+|altere|alterar)\s+(?:o\s+nome\s+d[ae]\s+|a\s+)?fazenda\b/i;
// Listar pastos: consulta, mesmo padrão de RE_LISTAR_LOTES.
const RE_LISTAR_PASTOS = /^\/?(?:pastos?|ver\s+pastos?|listar\s+pastos?|mostrar\s+pastos?|meus\s+pastos?|quais\s+(?:s[ãa]o\s+)?(?:os\s+)?(?:meus\s+)?pastos?)\b|\bpastos\b/i;
// Resultado do lote: checado antes de VER_LOTE não é necessário (RE_VER_LOTE
// exige que "lote" apareça logo após um prefixo de consulta específico no
// início da frase — "resultado do lote X" nunca bate nela), mas mantido
// antes por clareza de leitura da cascata.
const RE_RESULTADO_LOTE = /\b(?:resultado|margem|lucro)\s+d[eo]\s+lote\s+(.+?)$/i;

// --- Fazenda ---
const RE_SELECIONAR_FAZENDA = /^\/?(?:usar|selecionar|ativar|trocar\s+para|mudar\s+para|trocar|mudar|escolher)\s+(?:a\s+|de\s+|para\s+a\s+)?fazenda\s+(.+?)$/i;
const RE_LISTAR_FAZENDAS = /^\/?(?:fazendas?|listar\s+fazendas?|mostrar\s+fazendas?|minhas?\s+fazendas?|quais\s+(?:s[ãa]o\s+)?(?:as\s+)?(?:minhas?\s+)?fazendas?|trocar\s+de\s+fazenda|mudar\s+de\s+fazenda)\b/i;

// --- Lote(s) ---
const RE_VER_LOTE = /^\/?(?:ver\s+|detalhes?\s+d[eo]\s+|mostrar\s+|consultar\s+)?lote\s+(.+?)$/i;
const RE_LISTAR_LOTES = /^\/?(?:lotes|ver\s+lotes|listar\s+lotes|mostrar\s+lotes|meus\s+lotes|quais\s+(?:s[ãa]o\s+)?(?:os\s+)?(?:meus\s+)?lotes)\b|\blotes\b/i;

// --- Estoque ---
// Saída/baixa de estoque: checada nas ações mutáveis (junto aos outros
// cadastros), não aqui nas consultas — mantida perto por serem do mesmo
// domínio. Não colide com RE_REG_ENT_ESTOQUE (verbos diferentes: "dar
// baixa"/"retirar"/"usar"/"consumir" nunca aparecem na alternância de entrada).
const RE_SAIDA_ESTOQUE = /^\/?(?:dar\s+baixa|de\s+baixa|retir\w+|us(?:ar|ei|ou|amos)|consum\w+)\b|\bsaiu\b.*\b(?:estoque|kg|sacos?|litros?|fardos?)\b|\bestoque_saida\b/i;
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

  // 5b. Troca de pasto — checada ANTES da ambiguidade genérica de lote (a
  //     presença da palavra "pasto" desfaz a ambiguidade transferir/renomear).
  if (RE_TROCAR_PASTO.test(t)) return intent(INTENCOES.TROCAR_LOTE_PASTO, {}, true);

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
  //     Tarefa e item de estoque novo checados antes dos demais: "item de
  //     estoque" precisa vir antes de RE_REG_ENT_ESTOQUE (ambos contêm a
  //     palavra "estoque").
  // 6c. Sprint de expansão: lote/pasto novos, venda/morte/finalização e
  //     manejo/suplementação — checados ANTES dos cadastros genéricos de
  //     estoque (a palavra de produto/verbo específico é o sinal que
  //     desambigua "usei 3 sacos de ração" de uma baixa de estoque genérica).
  if (RE_CAD_FAZENDA.test(t)) return intent(INTENCOES.CADASTRAR_FAZENDA, {}, true);
  if (RE_RENOMEAR_FAZENDA.test(t)) return intent(INTENCOES.RENOMEAR_FAZENDA, {}, true);
  if (RE_CAD_LOTE.test(t)) return intent(INTENCOES.CADASTRAR_LOTE, {}, true);
  if (RE_CAD_PASTO.test(t)) return intent(INTENCOES.CADASTRAR_PASTO, {}, true);
  if (RE_REG_VENDA.test(t)) return intent(INTENCOES.REGISTRAR_VENDA, {}, true);
  if (RE_REG_MORTE.test(t)) return intent(INTENCOES.REGISTRAR_MORTE, {}, true);
  if (RE_FINALIZAR_LOTE.test(t)) return intent(INTENCOES.FINALIZAR_LOTE, {}, true);
  if (RE_CAD_MANEJO.test(t)) return intent(INTENCOES.CADASTRAR_MANEJO, {}, true);
  if (RE_PLANEJ_SUPL.test(t)) return intent(INTENCOES.CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO, {}, true);
  if (RE_CONSUMO_SUPL.test(t)) return intent(INTENCOES.REGISTRAR_CONSUMO_SUPLEMENTACAO, {}, true);

  if (RE_CAD_TAREFA.test(t)) return intent(INTENCOES.CADASTRAR_TAREFA, {}, true);
  if (RE_CAD_ITEM_ESTOQUE.test(t)) return intent(INTENCOES.CADASTRAR_ITEM_ESTOQUE, {}, true);
  if (RE_REG_PESAGEM.test(t)) return intent(INTENCOES.REGISTRAR_PESAGEM, {}, true);
  if (RE_CAD_DESPESA.test(t)) return intent(INTENCOES.CADASTRAR_DESPESA, {}, true);
  if (RE_CAD_RECEITA.test(t)) return intent(INTENCOES.CADASTRAR_RECEITA, {}, true);
  if (RE_SAIDA_ESTOQUE.test(t)) return intent(INTENCOES.DAR_BAIXA_ESTOQUE, {}, true);
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

  // 10. Lotes: resultado (checado antes de VER_LOTE), depois ver um lote
  //     específico antes de listar todos.
  m = t.match(RE_RESULTADO_LOTE);
  if (m) return intent(INTENCOES.CONSULTAR_RESULTADO_LOTE, { nome: limparNome(m[1]) });
  m = t.match(RE_VER_LOTE);
  if (m) return intent(INTENCOES.VER_LOTE, { nome: limparNome(m[1]) });
  if (RE_LISTAR_LOTES.test(t)) return intent(INTENCOES.LISTAR_LOTES);

  // 10b. Pastos (consulta).
  if (RE_LISTAR_PASTOS.test(t)) return intent(INTENCOES.LISTAR_PASTOS);

  // 11. Ajuda / start.
  if (RE_AJUDA.test(t)) return intent(INTENCOES.AJUDA);

  return intent(INTENCOES.DESCONHECIDO);
}
