/**
 * Escapa um valor para ser usado em um arquivo CSV.
 * Adiciona aspas duplas se o valor contiver ponto e vírgula, aspas duplas ou quebras de linha,
 * e duplica as aspas duplas dentro do valor.
 *
 * @param {*} valor - O valor a ser escapado.
 * @returns {string} O valor escapado.
 */
function escaparValor(valor) {
  // Converte o valor para string, tratando null/undefined como string vazia
  const texto = String(valor ?? '');

  // Verifica se o texto precisa ser envolvido por aspas
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    // Duplica as aspas duplas existentes e envolve o texto em aspas duplas
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Exporta dados para um arquivo CSV, formatado para ser aberto no Excel.
 * Inclui o BOM (Byte Order Mark) para garantir a correta exibição de caracteres especiais no Excel.
 *
 * @param {Array<object>} dados - Um array de objetos, onde cada objeto representa uma linha.
 * @param {Array<object>} colunas - Um array de objetos, onde cada objeto define uma coluna:
 *                                   `{ key: 'propriedadeDoObjeto', label: 'Nome da Coluna no CSV' }`.
 * @param {string} [nomeArquivo='relatorio'] - O nome do arquivo CSV a ser baixado (sem a extensão).
 */
export function exportarParaExcel(dados = [], colunas = [], nomeArquivo = 'relatorio') {
  // Constrói a linha do cabeçalho usando os labels das colunas
  const header = colunas.map((c) => escaparValor(c.label)).join(';');

  // Constrói as linhas de dados, mapeando cada item para seus valores de coluna
  const linhas = dados.map((item) =>
    colunas.map((coluna) => escaparValor(item[coluna.key])).join(';')
  );

  // Combina o cabeçalho e as linhas de dados em uma única string CSV
  const csv = [header, ...linhas].join('\n');

  // Cria um Blob com o conteúdo CSV.
  // Adiciona '\uFEFF' (BOM) para que o Excel reconheça a codificação UTF-8 corretamente.
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });

  // Cria um link temporário para download
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); // Cria uma URL para o Blob
  link.setAttribute('download', `${nomeArquivo}.csv`); // Define o nome do arquivo para download

  // Adiciona o link ao corpo do documento, clica nele e o remove
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Libera a URL do Blob para evitar vazamentos de memória
  URL.revokeObjectURL(link.href);
}
