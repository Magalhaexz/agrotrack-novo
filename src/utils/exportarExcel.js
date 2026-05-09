/**
 * Escapa um valor para ser usado em um arquivo CSV.
 * Adiciona aspas duplas se o valor contiver ponto e vírgula, aspas duplas ou quebras de linha,
 * e duplica as aspas duplas dentro do valor.
 *
 * @param {*} valor - O valor a ser escapado.
 * @returns {string} O valor escapado.
 */
import { exportarCsvCompatExcel } from './exportadores';

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
  exportarCsvCompatExcel({
    filename: nomeArquivo,
    rows: dados,
    columns: colunas.map((coluna) => ({
      key: coluna.key,
      header: coluna.label,
    })),
  });
}
