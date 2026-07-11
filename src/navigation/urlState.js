// Sincronização de estado de sub-navegação (item selecionado, aba, filtros
// leves) com a query string da URL atual — Seção 9/10 do sprint de
// fechamento. Estratégia REUTILIZÁVEL: qualquer página com o padrão "lista →
// detalhe com abas" (Lotes, Estoque, Calendário Operacional, Resultados,
// Minha Assinatura — todas usam esse mesmo padrão hoje, com useState local
// nunca refletido na URL) usa as mesmas duas funções puras abaixo através do
// hook `useUrlState` (useUrlState.js).
//
// Puro, sem I/O: só transforma entre `URLSearchParams`/string e objeto de
// estado tipado. O hook cuida do pushState/popstate real.

/**
 * Lê o estado a partir da query string, tipando cada campo conforme `schema`
 * (`{ campo: 'string'|'number' }`) e caindo para `defaults` quando ausente ou
 * inválido. Nunca lança — uma URL corrompida/editada à mão só usa os defaults.
 */
export function parseNavStateFromSearch(search, schema, defaults = {}) {
  const params = new URLSearchParams(search || '');
  const estado = { ...defaults };

  for (const [campo, tipo] of Object.entries(schema || {})) {
    if (!params.has(campo)) continue;
    const bruto = params.get(campo);
    if (tipo === 'number') {
      const n = Number(bruto);
      if (Number.isFinite(n)) estado[campo] = n;
      continue;
    }
    // 'string': string vazia é tratada como "ausente" (cai no default).
    if (bruto !== '') estado[campo] = bruto;
  }
  return estado;
}

/**
 * Serializa o estado para query string, omitindo campos iguais ao default
 * (URL limpa quando não há seleção) e campos null/undefined/''.
 */
export function buildSearchFromNavState(state, defaults = {}) {
  const params = new URLSearchParams();
  for (const [campo, valor] of Object.entries(state || {})) {
    if (valor === null || valor === undefined || valor === '') continue;
    if (valor === defaults[campo]) continue;
    params.set(campo, String(valor));
  }
  const texto = params.toString();
  return texto ? `?${texto}` : '';
}
