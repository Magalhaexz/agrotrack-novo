// Extração central de entidades das mensagens do Bot (Parte 5). Puro, sem I/O.
// Converte texto livre em valores tipados (valor, quantidade, peso, data,
// unidade, período). Nomes de lote/fazenda/produto NÃO são resolvidos aqui —
// isto só extrai o texto candidato; a resolução para um registro real é feita
// pelos resolvedores, sempre dentro da fazenda autorizada.

/** Normaliza para casamento: minúsculas, sem acento, espaços colapsados. */
export function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Números por extenso simples (0–20 + dezenas), suficiente para quantidades faladas.
const NUM_EXTENSO = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  cem: 100, cento: 100, mil: 1000,
};

/** Converte "1.234,56" ou "1234.56" ou "mil"/"vinte" em number, ou null. */
function parseNumeroBR(bruto) {
  if (bruto == null) return null;
  const s = normalizar(bruto);
  if (NUM_EXTENSO[s] != null) return NUM_EXTENSO[s];
  // Formato BR: ponto = milhar, vírgula = decimal.
  const limpo = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  if (!limpo || limpo === '.') return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** Valor monetário: "500 reais", "R$ 1.234,56", "2 mil reais", "15 mil". */
export function extrairValor(texto) {
  const t = normalizar(texto);
  let m = t.match(/r\$\s*([\d.,]+)/);
  if (m) return parseNumeroBR(m[1]);
  m = t.match(/([\d.,]+)\s*mil(?:\s+reais)?/);
  if (m) { const base = parseNumeroBR(m[1]); return base != null ? base * 1000 : null; }
  m = t.match(/([\d.,]+)\s*(?:reais|real|conto)/);
  if (m) return parseNumeroBR(m[1]);
  return null;
}

/** Peso em kg: "425 kg", "470 quilos", "peso de 390". */
export function extrairPeso(texto) {
  const t = normalizar(texto);
  let m = t.match(/([\d.,]+)\s*(?:kg|quilos?|kilos?|k)\b/);
  if (m) return parseNumeroBR(m[1]);
  // "peso de 425", "pesagem de 390", "pesou 470"
  m = t.match(/\bpes\w*\b(?:\s+medi[ao])?(?:\s+de)?\s+([\d.,]+)/);
  if (m) return parseNumeroBR(m[1]);
  return null;
}

/** Quantidade de animais/itens: "15 animais", "20 sacos", "10 cabeças", "trinta animais". */
export function extrairQuantidade(texto) {
  const t = normalizar(texto);
  // número (dígito ou extenso) seguido de substantivo de contagem
  const m = t.match(/(\d+|\b(?:um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem|mil)\b)\s*(animais|animal|cabe[cç]as?|bois?|reses?|sacos?|sacas?|fardos?|unidades?|un|litros?|l|kg|quilos?|toneladas?|t)\b/);
  if (!m) return null;
  return { quantidade: parseNumeroBR(m[1]), unidade: unidadeCanonica(m[2]) };
}

const UNIDADE_ALIASES = {
  kg: 'kg', quilo: 'kg', quilos: 'kg', kilo: 'kg', kilos: 'kg',
  saco: 'sacos', sacos: 'sacos', saca: 'sacos', sacas: 'sacos',
  litro: 'litros', litros: 'litros', l: 'litros',
  tonelada: 'toneladas', toneladas: 'toneladas', t: 'toneladas',
  unidade: 'un', unidades: 'un', un: 'un',
  fardo: 'fardos', fardos: 'fardos',
  animais: 'animais', animal: 'animais', cabeca: 'animais', cabecas: 'animais',
  boi: 'animais', bois: 'animais', res: 'animais', reses: 'animais',
};

export function unidadeCanonica(bruto) {
  return UNIDADE_ALIASES[normalizar(bruto)] || normalizar(bruto);
}

const DIAS_SEMANA = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

/**
 * Data em ISO (YYYY-MM-DD) a partir de linguagem natural.
 * Reconhece hoje/ontem/amanha, dd/mm[/aaaa], "dia 15" e dia da semana futuro.
 * @param {Date} hoje base para datas relativas (injeta em teste).
 */
export function extrairData(texto, hoje = new Date()) {
  const t = normalizar(texto);
  const iso = (d) => d.toISOString().slice(0, 10);
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  if (/\bhoje\b/.test(t)) return iso(base);
  if (/\bontem\b/.test(t)) { const d = new Date(base); d.setUTCDate(d.getUTCDate() - 1); return iso(d); }
  if (/\banteontem\b/.test(t)) { const d = new Date(base); d.setUTCDate(d.getUTCDate() - 2); return iso(d); }
  if (/\bamanha\b/.test(t)) { const d = new Date(base); d.setUTCDate(d.getUTCDate() + 1); return iso(d); }

  // dd/mm ou dd/mm/aaaa
  let m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    const dia = Number(m[1]); const mes = Number(m[2]) - 1;
    let ano = m[3] ? Number(m[3]) : base.getUTCFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(Date.UTC(ano, mes, dia));
    if (!Number.isNaN(d.getTime())) return iso(d);
  }

  // "dia 15" → dia deste mês (ou próximo mês se já passou)
  m = t.match(/\bdia\s+(\d{1,2})\b/);
  if (m) {
    const dia = Number(m[1]);
    let d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), dia));
    if (d < base) d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, dia));
    return iso(d);
  }

  // Dia da semana → próxima ocorrência (inclui "sexta", "na sexta", "sexta-feira")
  for (const [nome, idx] of Object.entries(DIAS_SEMANA)) {
    if (new RegExp(`\\b${nome}(?:-feira)?\\b`).test(t)) {
      const d = new Date(base);
      let delta = (idx - d.getUTCDay() + 7) % 7;
      if (delta === 0) delta = 7; // "sexta" quando hoje é sexta → próxima
      d.setUTCDate(d.getUTCDate() + delta);
      return iso(d);
    }
  }
  return null;
}

/**
 * Período para consultas: retorna { inicio, fim } em ISO, ou null.
 * hoje/ontem, esta semana, este mês, mês passado, últimos N dias, este ano.
 */
export function extrairPeriodo(texto, hoje = new Date()) {
  const t = normalizar(texto);
  const iso = (d) => d.toISOString().slice(0, 10);
  const base = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));

  if (/\bhoje\b/.test(t)) return { inicio: iso(base), fim: iso(base) };
  if (/\bontem\b/.test(t)) { const d = new Date(base); d.setUTCDate(d.getUTCDate() - 1); return { inicio: iso(d), fim: iso(d) }; }

  let m = t.match(/ultimos?\s+(\d+)\s+dias/);
  if (m) { const d = new Date(base); d.setUTCDate(d.getUTCDate() - Number(m[1])); return { inicio: iso(d), fim: iso(base) }; }

  if (/\b(esta|nesta)\s+semana\b/.test(t)) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const fim = new Date(d); fim.setUTCDate(fim.getUTCDate() + 6);
    return { inicio: iso(d), fim: iso(fim) };
  }
  if (/\b(este|neste)\s+mes\b/.test(t)) {
    const ini = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
    const fim = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    return { inicio: iso(ini), fim: iso(fim) };
  }
  if (/\bmes\s+passado\b/.test(t)) {
    const ini = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - 1, 1));
    const fim = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 0));
    return { inicio: iso(ini), fim: iso(fim) };
  }
  if (/\b(este|neste)\s+ano\b/.test(t)) {
    return { inicio: iso(new Date(Date.UTC(base.getUTCFullYear(), 0, 1))), fim: iso(new Date(Date.UTC(base.getUTCFullYear(), 11, 31))) };
  }
  return null;
}

/**
 * Extrai o nome candidato de lote/fazenda após uma preposição/keyword.
 * Ex.: "no lote Engorda 02" → "Engorda 02". Não resolve; só recorta o texto.
 */
export function extrairNomeApos(texto, palavras = ['lote', 'fazenda']) {
  const stop = 'para|no|na|com|de|dia|hoje|ontem|amanha|por|pesou|pesa|pesagem|reais|kg|quilos?|sacos?|litros?';
  const re = new RegExp(`\\b(?:${palavras.join('|')})\\s+([\\p{L}\\d][\\p{L}\\d\\s]*?)(?:\\s+(?:${stop})\\b|[.,;!?]|$)`, 'iu');
  const m = String(texto || '').match(re);
  return m ? m[1].trim() : null;
}

export { parseNumeroBR };
