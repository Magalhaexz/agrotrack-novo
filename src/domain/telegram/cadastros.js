// Motor de cadastros por conversa (Fase 3). Puro, sem I/O. Para cada intenção
// de cadastro define: slots (perguntas em etapas), extração de dados da
// mensagem, validação, resumo de confirmação e o "plano de escrita" que o
// webhook aplica no backend (Parte 20 — regra no servidor, nunca só no texto).
//
// A conversa só COLETA. A execução continua passando por operação pendente +
// /confirmar (a confirmação é criada pelo orquestrador a partir do plano aqui).
import { INTENCOES } from './interpretarComandoTelegram.js';
import { extrairValor, extrairPeso, extrairData, extrairQuantidade, extrairNomeApos, parseNumeroBR } from './extrairEntidades.js';
import { resolverLotePorNome, normalizarChave } from './resolvedores.js';
import { prepararCadastroTarefa } from './cadastroTarefa.js';
import { prepararCadastroItemEstoque } from './cadastroItemEstoque.js';
import { prepararSaidaEstoque } from './acoesEstoque.js';
import { prepararTrocaLotePasto } from './acoesPasto.js';

import { hojeLocalISO } from '../dataCivil.js';
const erro = (codigo) => ({ ok: false, erro: codigo });

/** Um número "puro" ("425" ou "1.234,56") — usado quando o slot já pergunta o campo. */
function numeroPuro(t) {
  return /^[\d.,]+$/.test(t) ? parseNumeroBR(t) : null;
}

/** Interpreta a resposta a UM slot (resposta direta a uma pergunta). */
export function interpretarResposta(tipo, texto, ctx = {}) {
  const t = String(texto || '').trim();
  switch (tipo) {
    case 'valor': return extrairValor(t) ?? numeroPuro(t);
    case 'peso': return extrairPeso(t) ?? numeroPuro(t);
    case 'data': return extrairData(t, ctx.hoje);
    case 'quantidade': return extrairQuantidade(t)?.quantidade ?? (/^\d+$/.test(t) ? Number(t) : null);
    case 'lote': return extrairNomeApos(t, ['lote']) || (t && !/^(nao|não|nenhum|sem)$/i.test(t) ? t : null);
    case 'texto': return t || null;
    case 'opcional_texto': return /^(nao|não|nenhum|sem|pular)$/i.test(t) ? '' : (t || null);
    default: return t || null;
  }
}

// ── Catálogo dos cadastros ───────────────────────────────────────────────────
export const CATALOGO_CADASTROS = {
  [INTENCOES.REGISTRAR_PESAGEM]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'lote', tipo: 'lote', pergunta: 'Em qual lote?' },
      { nome: 'peso', tipo: 'peso', pergunta: 'Qual o peso médio, em kg?' },
      { nome: 'data', tipo: 'data', pergunta: 'Em que data? (ex.: hoje, 10/07)', obrigatorio: false },
    ],
    validar(dados) {
      if (!(Number(dados.peso) > 0)) return erro('PESO_INVALIDO');
      return { ok: true };
    },
  },
  [INTENCOES.CADASTRAR_DESPESA]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'valor', tipo: 'valor', pergunta: 'Qual o valor da despesa?' },
      { nome: 'descricao', tipo: 'texto', pergunta: 'Qual a descrição?' },
      { nome: 'lote', tipo: 'opcional_texto', pergunta: 'Pertence a algum lote? (envie o nome ou "não")', obrigatorio: false, perguntar: true },
      { nome: 'data', tipo: 'data', pergunta: 'Em que data?', obrigatorio: false },
    ],
    validar(dados) {
      if (!(Number(dados.valor) > 0)) return erro('VALOR_INVALIDO');
      if (!String(dados.descricao || '').trim()) return erro('DESCRICAO_VAZIA');
      return { ok: true };
    },
  },
  [INTENCOES.CADASTRAR_RECEITA]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'valor', tipo: 'valor', pergunta: 'Qual o valor da receita?' },
      { nome: 'descricao', tipo: 'texto', pergunta: 'Qual a descrição?' },
      { nome: 'lote', tipo: 'opcional_texto', pergunta: 'Pertence a algum lote? (envie o nome ou "não")', obrigatorio: false, perguntar: true },
      { nome: 'data', tipo: 'data', pergunta: 'Em que data?', obrigatorio: false },
    ],
    validar(dados) {
      if (!(Number(dados.valor) > 0)) return erro('VALOR_INVALIDO');
      if (!String(dados.descricao || '').trim()) return erro('DESCRICAO_VAZIA');
      return { ok: true };
    },
  },
  [INTENCOES.REGISTRAR_ENTRADA_ESTOQUE]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'item', tipo: 'texto', pergunta: 'Qual item de estoque?' },
      { nome: 'quantidade', tipo: 'quantidade', pergunta: 'Qual a quantidade?' },
      { nome: 'data', tipo: 'data', pergunta: 'Em que data?', obrigatorio: false },
    ],
    validar(dados) {
      if (!(Number(dados.quantidade) > 0)) return erro('QUANTIDADE_INVALIDA');
      if (!String(dados.item || '').trim()) return erro('ITEM_VAZIO');
      return { ok: true };
    },
  },
  // ── Sprint bot operacional determinístico: 4 novos cadastros/ações ────────
  [INTENCOES.CADASTRAR_TAREFA]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'titulo', tipo: 'texto', pergunta: 'Qual o título da tarefa?' },
      { nome: 'data_vencimento', tipo: 'data', pergunta: 'Para qual data?' },
      { nome: 'lote', tipo: 'opcional_texto', pergunta: 'Está vinculada a algum lote? (envie o nome ou "não")', obrigatorio: false, perguntar: true },
    ],
    validar(dados) {
      if (!String(dados.titulo || '').trim()) return erro('TITULO_VAZIO');
      if (!dados.data_vencimento) return erro('DATA_VENCIMENTO_VAZIA');
      return { ok: true };
    },
  },
  [INTENCOES.CADASTRAR_ITEM_ESTOQUE]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'nome', tipo: 'texto', pergunta: 'Qual o nome do produto?' },
      { nome: 'quantidade_inicial', tipo: 'quantidade', pergunta: 'Qual a quantidade inicial? (ou "não" se ainda não vai entrar quantidade)', obrigatorio: false, perguntar: true },
    ],
    validar(dados) {
      if (!String(dados.nome || '').trim()) return erro('NOME_VAZIO');
      return { ok: true };
    },
  },
  [INTENCOES.DAR_BAIXA_ESTOQUE]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'item', tipo: 'texto', pergunta: 'Qual item de estoque?' },
      { nome: 'quantidade', tipo: 'quantidade', pergunta: 'Qual a quantidade?' },
    ],
    validar(dados) {
      if (!(Number(dados.quantidade) > 0)) return erro('QUANTIDADE_INVALIDA');
      if (!String(dados.item || '').trim()) return erro('ITEM_VAZIO');
      return { ok: true };
    },
  },
  [INTENCOES.TROCAR_LOTE_PASTO]: {
    tipo: 'cadastro',
    slots: [
      { nome: 'lote', tipo: 'lote', pergunta: 'Qual lote?' },
      { nome: 'pasto', tipo: 'texto', pergunta: 'Para qual pasto?' },
    ],
    validar(dados) {
      if (!String(dados.lote || '').trim()) return erro('LOTE_VAZIO');
      if (!String(dados.pasto || '').trim()) return erro('PASTO_VAZIO');
      return { ok: true };
    },
  },
};

export function slotsDoCadastro(intencao) {
  return CATALOGO_CADASTROS[intencao]?.slots || [];
}

/**
 * Extrai da mensagem INICIAL apenas sinais estruturados (valor, peso, "lote X",
 * "com <descrição>", etc.). Nunca usa o texto livre inteiro como um slot — senão
 * "cadastrar despesa" viraria o nome de um lote. O que faltar vira pergunta.
 */
export function extrairDadosIniciais(intencao, texto, ctx = {}) {
  const cad = CATALOGO_CADASTROS[intencao];
  if (!cad) return {};
  const dados = {};
  for (const slot of cad.slots) {
    let v = null;
    if (slot.nome === 'lote') v = extrairNomeApos(texto, ['lote']);
    else if (slot.nome === 'pasto') v = extrairNomeApos(texto, ['pasto']);
    else if (slot.nome === 'descricao') v = extrairDescricao(texto);
    else if (slot.nome === 'item') v = extrairItemEstoque(texto);
    else if (slot.nome === 'titulo') v = extrairTitulo(texto);
    else if (slot.nome === 'nome') v = extrairNomeProduto(texto);
    else if (slot.tipo === 'valor') v = extrairValor(texto);
    else if (slot.tipo === 'peso') v = extrairPeso(texto);
    else if (slot.tipo === 'quantidade') v = extrairQuantidade(texto)?.quantidade ?? null;
    else if (slot.tipo === 'data') v = extrairData(texto, ctx.hoje);
    // slots de texto livre (sem extrator estruturado) só são coletados via pergunta
    if (v !== null && v !== undefined && v !== '') dados[slot.nome] = v;
  }
  return dados;
}

/** Descrição livre: texto após "com"/"de" (não numérico). */
function extrairDescricao(texto) {
  const orig = String(texto || '');
  let m = orig.match(/\bcom\s+(.+?)(?:\s+(?:no|na|para|dia|hoje|ontem|amanha)\b|[.,;!?]|$)/i);
  if (m) return m[1].trim();
  m = orig.match(/\bde\s+([^\d].*?)(?:\s+(?:no|na|para|dia|hoje|ontem|amanha|de\s+\d)\b|[.,;!?]|$)/i);
  if (m && !/^\d/.test(m[1].trim())) return m[1].trim();
  return null;
}

/** Nome do item de estoque: após "de/do" ou o substantivo antes de "no estoque". */
function extrairItemEstoque(texto) {
  const orig = String(texto || '');
  let m = orig.match(/\d+\s*(?:sacos?|kg|quilos?|litros?|fardos?|un|unidades?)\s+de\s+(.+?)(?:\s+(?:no|na|para|dia|hoje|ontem|amanha|estoque)\b|[.,;!?]|$)/i);
  if (m) return m[1].trim();
  m = orig.match(/\bde\s+(.+?)\s+no\s+estoque\b/i);
  if (m) return m[1].trim();
  return null;
}

/** Título de tarefa: após "tarefa (para|de)"/"lembrete (para|de)"/"lembra de". */
function extrairTitulo(texto) {
  const orig = String(texto || '');
  let m = orig.match(/\b(?:tarefa|lembrete)\s+(?:para|de)\s+(.+?)(?:\s+(?:dia|hoje|ontem|amanha|no\s+lote|na\s+fazenda)\b|[.,;!?]|$)/i);
  if (m) return m[1].trim();
  m = orig.match(/\bme\s+lembr[ae]\s+de\s+(.+?)(?:\s+(?:dia|hoje|ontem|amanha|no\s+lote|na\s+fazenda)\b|[.,;!?]|$)/i);
  if (m) return m[1].trim();
  m = orig.match(/^\/?agend\w+\s+(.+?)(?:\s+(?:para|dia|hoje|ontem|amanha)\b|[.,;!?]|$)/i);
  if (m) return m[1].trim();
  return null;
}

/**
 * Nome de produto novo: após "item novo"/"novo item"/"produto novo"/"novo
 * produto" (cadastro de item de estoque). Exige as DUAS palavras presentes
 * — "item"/"produto" sozinho é ambíguo demais para arriscar (poderia
 * capturar a palavra "novo" como se fosse o nome, quando a mensagem só diz
 * "cadastre um item novo" sem nome nenhum ainda — nesse caso o slot deve
 * perguntar, não inventar "novo" como nome do produto).
 */
function extrairNomeProduto(texto) {
  const orig = String(texto || '');
  const padroes = [
    /\bnovo\s+(?:item|produto)\s+(?:chamado\s+)?(.+?)(?:\s+(?:no|na|com|de|para)\b|[.,;!?]|$)/i,
    /\b(?:item|produto)\s+novo\s+(?:chamado\s+)?(.+?)(?:\s+(?:no|na|com|de|para)\b|[.,;!?]|$)/i,
  ];
  for (const re of padroes) {
    const m = orig.match(re);
    const candidato = m?.[1]?.trim();
    if (candidato) return candidato;
  }
  return null;
}

/**
 * Resolve nomes (lote/item) e monta o plano de escrita + resumo de confirmação.
 * @returns {{ ok:true, resumo, tipo, writes }} | { ok:false, erro }
 */
export function prepararCadastro(intencao, dados, ctx = {}) {
  const cad = CATALOGO_CADASTROS[intencao];
  if (!cad) return erro('CADASTRO_DESCONHECIDO');
  const val = cad.validar(dados);
  if (!val.ok) return val;

  const db = ctx.db || {};
  const dataFinal = dados.data || ctx.hoje?.toISOString?.().slice(0, 10) || hojeLocalISO();

  // Resolve lote quando informado (opcional na maioria dos cadastros).
  let loteId = null; let loteNome = null;
  const loteBruto = dados.lote;
  if (loteBruto && String(loteBruto).trim()) {
    const r = resolverLotePorNome(db.lotes, loteBruto);
    if (r.status === 'ambiguo') return { ok: false, erro: 'LOTE_AMBIGUO', candidatos: r.candidatos };
    if (r.status !== 'ok') return erro('LOTE_NAO_ENCONTRADO');
    loteId = r.lote.id; loteNome = r.lote.nome;
  }

  switch (intencao) {
    case INTENCOES.REGISTRAR_PESAGEM: {
      if (!loteId) return erro('LOTE_NAO_ENCONTRADO');
      return {
        ok: true, tipo: 'pesagem',
        resumo: ['Confirme a pesagem:', '', `Lote: ${loteNome}`, `Peso médio: ${dados.peso} kg`, `Data: ${dataFinal}`],
        writes: [{ tabela: 'pesagens', tipo: 'insert', registro: { lote_id: loteId, peso_medio: Number(dados.peso), data: dataFinal, origem: 'telegram' } }],
      };
    }
    case INTENCOES.CADASTRAR_DESPESA:
    case INTENCOES.CADASTRAR_RECEITA: {
      const isDespesa = intencao === INTENCOES.CADASTRAR_DESPESA;
      return {
        ok: true, tipo: isDespesa ? 'despesa' : 'receita',
        resumo: [`Confirme o lançamento:`, '', `Tipo: ${isDespesa ? 'Despesa' : 'Receita'}`, `Descrição: ${dados.descricao}`, `Valor: R$ ${Number(dados.valor).toFixed(2).replace('.', ',')}`, `Lote: ${loteNome || 'não vinculado'}`, `Data: ${dataFinal}`, `Status: realizado`],
        writes: [{ tabela: 'movimentacoes_financeiras', tipo: 'insert', registro: {
          tipo: isDespesa ? 'despesa' : 'receita', valor: Number(dados.valor), descricao: dados.descricao,
          lote_id: loteId, data: dataFinal, data_competencia: dataFinal, status: 'realizado', origem: 'telegram',
        } }],
      };
    }
    case INTENCOES.REGISTRAR_ENTRADA_ESTOQUE: {
      const estoque = Array.isArray(db.estoque) ? db.estoque : [];
      const alvo = normalizarChave(dados.item);
      const achados = estoque.filter((e) => normalizarChave(e.produto || e.nome).includes(alvo));
      if (achados.length === 0) return erro('ITEM_NAO_ENCONTRADO');
      if (achados.length > 1) return { ok: false, erro: 'ITEM_AMBIGUO', candidatos: achados.map((e) => ({ nome: e.produto || e.nome })) };
      const item = achados[0];
      const qtd = Number(dados.quantidade);
      const atual = Number(item.quantidade_atual ?? item.quantidade ?? 0);
      return {
        ok: true, tipo: 'entrada_estoque',
        resumo: ['Confirme a entrada de estoque:', '', `Item: ${item.produto || item.nome}`, `Quantidade: +${qtd} ${item.unidade || item.unidade_medida || ''}`.trim(), `Novo saldo: ${atual + qtd}`, `Data: ${dataFinal}`],
        writes: [
          { tabela: 'movimentacoes_estoque', tipo: 'insert', registro: { item_estoque_id: item.id, tipo: 'entrada', quantidade: qtd, data: dataFinal, obs: 'Entrada via Telegram' } },
          { tabela: 'estoque', tipo: 'update', match: { id: item.id }, patch: { quantidade_atual: atual + qtd } },
        ],
      };
    }
    case INTENCOES.CADASTRAR_TAREFA: {
      const plano = prepararCadastroTarefa(db, dados, { fazendaId: ctx.fazendaId ?? null });
      return plano.ok ? { ...plano, tipo: 'tarefa' } : plano;
    }
    case INTENCOES.CADASTRAR_ITEM_ESTOQUE: {
      const plano = prepararCadastroItemEstoque(db, dados, { fazendaId: ctx.fazendaId ?? null });
      return plano.ok ? { ...plano, tipo: 'item_estoque' } : plano;
    }
    case INTENCOES.DAR_BAIXA_ESTOQUE: {
      const plano = prepararSaidaEstoque(db, dados);
      return plano.ok ? { ...plano, tipo: 'saida_estoque' } : plano;
    }
    case INTENCOES.TROCAR_LOTE_PASTO: {
      const plano = prepararTrocaLotePasto(db, dados);
      return plano.ok ? { ...plano, tipo: 'troca_pasto' } : plano;
    }
    default:
      return erro('CADASTRO_DESCONHECIDO');
  }
}
