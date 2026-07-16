// Confirmação editável (Sprint Paridade 1, bloco 4). Puro, sem I/O: permite
// corrigir UM campo de um cadastro pendente ("troque o pasto para Pasto Sul")
// sem reiniciar a conversa nem perder os demais campos já coletados.
//
// Reaproveita 100% do motor de cadastro já existente (cadastros.js) — este
// módulo só (1) reconhece a frase de edição, (2) acha o slot correspondente
// no catálogo da intenção atual e (3) revalida tudo via `prepararCadastro`,
// exatamente como uma resposta normal de conversa faria.
import { CATALOGO_CADASTROS, interpretarResposta, prepararCadastro, slotsDoCadastro } from './cadastros.js';
import { normalizarChave } from './resolvedores.js';

// Só os casos óbvios — não vale inventar um dicionário grande sem uso real.
const SINONIMOS_CAMPO = {
  cabecas: 'quantidade',
  animais: 'quantidade',
  qtd: 'quantidade',
  pastagem: 'pasto',
  preco: 'valor',
};

const RE_EDITAR_CAMPO = /^(?:troc\w*|troqu\w*|mud\w*|alter\w*|corrij\w*|corrig\w*|atualiz\w*)\s+(?:o\s+|a\s+|os\s+|as\s+)?(.+?)\s+(?:para|pra)\s+(.+)$/i;
const RE_REMOVER_PASTO = /^(?:remov\w*|retir\w*|tir\w*)\s+(?:o\s+|a\s+)?pasto\b/i;

/**
 * Reconhece uma frase de edição de campo. Retorna `null` quando não casa
 * (a mensagem cai no fluxo normal, sem mudança de comportamento).
 * @returns {{campoBruto:string, valorBruto:string}|null}
 */
export function interpretarEdicaoCampo(texto) {
  const t = String(texto || '').trim();
  if (!t) return null;
  if (RE_REMOVER_PASTO.test(t)) return { campoBruto: 'pasto', valorBruto: '' };
  const m = t.match(RE_EDITAR_CAMPO);
  if (!m) return null;
  const campoBruto = m[1].trim();
  const valorBruto = m[2].trim();
  if (!campoBruto || !valorBruto) return null;
  return { campoBruto, valorBruto };
}

/**
 * Acha o slot do catálogo da intenção cujo nome casa com o campo dito em
 * português livre. Três tentativas em ordem (para no primeiro nível com
 * candidato): nome exato, prefixo/sufixo composto (ex.: "nome" → "nome_lote",
 * "quantidade" → "quantidade_animais"/"quantidade_produto" — aqui vira
 * ambíguo de propósito, já que os dois existem no mesmo cadastro), substring.
 * @returns {{status:'ok', slot:object}|{status:'ambiguo', candidatos:string[]}|{status:'nao_encontrado'}}
 */
export function resolverSlotPorNomeCampo(slots, campoBruto) {
  const lista = Array.isArray(slots) ? slots : [];
  const chave = normalizarChave(campoBruto);
  if (!chave) return { status: 'nao_encontrado' };
  const chaveFinal = SINONIMOS_CAMPO[chave] || chave;

  const porNivel = (teste) => lista.filter((s) => teste(normalizarChave(s.nome)));
  let candidatos = porNivel((nome) => nome === chaveFinal);
  if (candidatos.length === 0) {
    candidatos = porNivel((nome) => nome.startsWith(`${chaveFinal}_`) || nome.endsWith(`_${chaveFinal}`));
  }
  if (candidatos.length === 0) {
    candidatos = porNivel((nome) => nome.includes(chaveFinal));
  }

  if (candidatos.length === 0) return { status: 'nao_encontrado' };
  if (candidatos.length > 1) return { status: 'ambiguo', candidatos: candidatos.map((s) => s.nome) };
  return { status: 'ok', slot: candidatos[0] };
}

/**
 * Aplica a correção de um campo sobre os dados de um cadastro pendente e
 * revalida tudo (entidade, regra de negócio) via `prepararCadastro` — se a
 * revalidação falhar (ex.: novo pasto ambíguo), `dadosAtuais` não é alterado
 * pelo chamador (este módulo não muda nada em lugar nenhum; quem persiste é
 * o orquestrador, só depois de ver `ok:true`).
 * @param {{intencao:string, dadosAtuais:object, campoBruto:string, valorBruto:string, ctx?:object}} args
 */
export function aplicarEdicaoPendente({ intencao, dadosAtuais, campoBruto, valorBruto, ctx = {} }) {
  if (!CATALOGO_CADASTROS[intencao]) return { ok: false, erro: 'CADASTRO_DESCONHECIDO' };
  const slots = slotsDoCadastro(intencao);

  const resolucao = resolverSlotPorNomeCampo(slots, campoBruto);
  if (resolucao.status === 'ambiguo') return { ok: false, erro: 'CAMPO_AMBIGUO', candidatos: resolucao.candidatos };
  if (resolucao.status !== 'ok') return { ok: false, erro: 'CAMPO_NAO_RECONHECIDO' };

  const slot = resolucao.slot;
  const valor = interpretarResposta(slot.tipo, valorBruto, ctx);

  // Mesma regra de `continuarConversa` (conversas.js): campo opcional pode
  // ser limpo para '' (ex.: "remover pasto"); campo obrigatório não aceita
  // valor não reconhecido.
  const dadosNovos = { ...(dadosAtuais || {}) };
  if (valor === null || valor === '') {
    if (slot.obrigatorio === false) dadosNovos[slot.nome] = '';
    else return { ok: false, erro: 'VALOR_INVALIDO', campo: slot.nome };
  } else {
    dadosNovos[slot.nome] = valor;
  }

  const resultado = prepararCadastro(intencao, dadosNovos, ctx);
  if (!resultado.ok) return resultado;

  return { ok: true, campo: slot.nome, dadosNovos, resultado };
}
