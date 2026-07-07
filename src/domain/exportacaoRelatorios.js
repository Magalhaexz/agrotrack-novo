// Funções puras de exportação de relatórios (CSV/impressão) — Sprint 19.
//
// Sem I/O: só transformam dados já calculados em texto/objetos prontos para
// download ou impressão. A camada de I/O (download de arquivo, abrir janela
// de impressão) fica em `src/utils/exportacaoArquivos.js`.
//
// O projeto já tinha um helper de CSV equivalente (`src/utils/exportadores.js`,
// usado por EstoquePage/ResultadosPage) — mantido intacto para não arriscar
// páginas já em produção. Este módulo é a versão testável (Etapa 4) usada
// pelas integrações novas desta sprint (Sanidade, Central de Alertas) e por
// qualquer exportação futura — ver docs/HERDON_RELATORIOS_EXPORTACOES.md.

const CASAS_DECIMAIS_PADRAO = 2;

/** Trata null/undefined/NaN/Infinity e remove quebra de linha perigosa para célula de CSV. */
export function sanitizarValorExportacao(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : '';
  }
  return String(valor).replace(/[\r\n]+/g, ' ').trim();
}

function escaparCelulaCsv(valor, delimitador) {
  const texto = String(sanitizarValorExportacao(valor));
  const precisaAspas = texto.includes(delimitador) || texto.includes('"') || texto.includes('\n') || texto.includes('\r');
  if (!precisaAspas) return texto;
  return `"${texto.replace(/"/g, '""')}"`;
}

/**
 * Gera o texto CSV (cabeçalho + linhas), sem BOM e sem acionar download —
 * isso fica em `baixarCsv` (`exportacaoArquivos.js`). Delimitador padrão
 * ";" (convenção brasileira, Excel PT-BR trata "," como separador decimal).
 */
export function gerarCsv({ colunas = [], linhas = [], delimitador = ';' } = {}) {
  const cabecalho = colunas.map((coluna) => escaparCelulaCsv(coluna.label ?? coluna.key, delimitador)).join(delimitador);
  const corpo = linhas.map((linha) => colunas.map((coluna) => {
    const bruto = typeof coluna.accessor === 'function' ? coluna.accessor(linha) : linha?.[coluna.key];
    return escaparCelulaCsv(bruto, delimitador);
  }).join(delimitador));
  return [cabecalho, ...corpo].join('\r\n');
}

export function formatarMoedaExportacao(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'R$ 0,00';
  return `R$ ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatarNumeroExportacao(valor, casas = CASAS_DECIMAIS_PADRAO) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '0';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** dd/mm/aaaa; string vazia se a data for ausente/inválida (nunca "Invalid Date"). */
export function formatarDataExportacao(valor) {
  if (!valor) return '';
  const texto = String(valor);
  const data = new Date(texto.length <= 10 ? `${texto}T00:00:00` : texto);
  if (Number.isNaN(data.getTime())) return '';
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Nome de arquivo seguro, ex.: herdon-resultado-lote-fazenda-sao-joao-2026-07-07.csv */
export function montarNomeArquivo({ prefixo, fazendaNome, data } = {}) {
  const partes = ['herdon', slugify(prefixo) || 'relatorio'];
  if (fazendaNome) {
    const slugFazenda = slugify(fazendaNome);
    if (slugFazenda) partes.push(slugFazenda);
  }
  const dataRef = data ? new Date(data) : new Date();
  const dataSegura = Number.isNaN(dataRef.getTime()) ? new Date() : dataRef;
  partes.push(dataSegura.toISOString().slice(0, 10));
  return `${partes.join('-')}.csv`;
}

/** Objeto padronizado consumido tanto por `gerarCsv` (via colunas/linhas) quanto pela impressão. */
export function montarTabelaRelatorio({ titulo, subtitulo, colunas = [], linhas = [], metadados = {} } = {}) {
  return {
    titulo: titulo || 'Relatório HERDON',
    subtitulo: subtitulo || '',
    colunas,
    linhas,
    metadados,
  };
}
