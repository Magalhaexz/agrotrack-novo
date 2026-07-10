// Resolvedores de nome → registro para o Bot do Telegram (Partes 6, 18). Puro,
// sem I/O. Nomes vêm do usuário (grafia livre); aqui casamos de forma
// acento-insensível e detectamos ambiguidade em vez de adivinhar (Parte 19).
//
// Contrato: as listas já chegam recortadas pela fazenda ativa/permitida — o
// resolvedor nunca busca fora do escopo que o webhook passou.

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
export function normalizarChave(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve um nome para exatamente uma fazenda da lista.
 * @returns {{ status: 'ok'|'nao_encontrado'|'ambiguo', fazenda?: object, candidatas?: object[] }}
 */
export function resolverFazendaPorNome(fazendas, nome) {
  const lista = Array.isArray(fazendas) ? fazendas : [];
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatas: [] };

  const exatas = lista.filter((f) => normalizarChave(f?.nome) === alvo);
  if (exatas.length === 1) return { status: 'ok', fazenda: exatas[0] };
  if (exatas.length > 1) return { status: 'ambiguo', candidatas: exatas };

  // Sem match exato: tenta "começa com" (ex.: "Boa" → "Boa Vista"), mas só
  // resolve se for único — nomes semelhantes viram desambiguação numerada.
  const parciais = lista.filter((f) => normalizarChave(f?.nome).startsWith(alvo));
  if (parciais.length === 1) return { status: 'ok', fazenda: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatas: parciais };
  return { status: 'nao_encontrado', candidatas: [] };
}

/**
 * Resolve um nome para exatamente um lote. Casa com e sem o prefixo "lote "
 * (o interpretador já removeu a palavra-chave "lote"; aqui reforçamos casando
 * tanto "A" quanto "Lote A"). `somenteAtivos` filtra lotes encerrados.
 * @returns {{ status: 'ok'|'nao_encontrado'|'ambiguo', lote?: object, candidatos?: object[] }}
 */
export function resolverLotePorNome(lotes, nome, { somenteAtivos = false } = {}) {
  let lista = Array.isArray(lotes) ? lotes : [];
  if (somenteAtivos) {
    lista = lista.filter((l) => String(l?.status || 'ativo').toLowerCase() !== 'encerrado');
  }
  const alvo = normalizarChave(nome);
  if (!alvo) return { status: 'nao_encontrado', candidatos: [] };

  const casa = (l) => {
    const chave = normalizarChave(l?.nome);
    return chave === alvo || chave === `lote ${alvo}`;
  };
  const exatos = lista.filter(casa);
  if (exatos.length === 1) return { status: 'ok', lote: exatos[0] };
  if (exatos.length > 1) return { status: 'ambiguo', candidatos: exatos };

  const parciais = lista.filter((l) => normalizarChave(l?.nome).includes(alvo));
  if (parciais.length === 1) return { status: 'ok', lote: parciais[0] };
  if (parciais.length > 1) return { status: 'ambiguo', candidatos: parciais };
  return { status: 'nao_encontrado', candidatos: [] };
}
