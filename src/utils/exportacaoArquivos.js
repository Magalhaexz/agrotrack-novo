// Camada de I/O para exportação de relatórios (download/impressão) — Sprint 19.
// Só lida com o navegador (Blob, window.open, window.print); nenhuma regra
// de negócio ou formatação de dado mora aqui — isso é
// `src/domain/exportacaoRelatorios.js`.
//
// O projeto já tinha `src/utils/exportarPDF.js` (impressão via `window.print`
// a partir de um elemento DOM já renderizado — usado por `AcoesRelatorio.jsx`
// em Lotes/Resultado do Lote/Relatórios) e `src/utils/exportadores.js`
// (download de CSV/XLS). `abrirRelatorioParaImpressao` complementa o
// primeiro: gera a própria tabela HTML a partir de colunas/linhas, para
// páginas (Sanidade, Central de Alertas) que não têm um bloco de preview já
// pronto para imprimir.
import { gerarCsv, formatarDataExportacao } from '../domain/exportacaoRelatorios';

/** Baixa um texto como arquivo — função genérica reaproveitada por `baixarCsv`. */
export function baixarTextoComoArquivo({ conteudo, nomeArquivo, mimeType = 'text/plain;charset=utf-8;' }) {
  const blob = new Blob([conteudo], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** CSV com BOM UTF-8 (Excel abre acentuação corretamente) e nome de arquivo já resolvido. */
const BOM_UTF8 = String.fromCharCode(0xfeff);

export function baixarCsv({ colunas, linhas, nomeArquivo, delimitador = ';' }) {
  const csv = gerarCsv({ colunas, linhas, delimitador });
  baixarTextoComoArquivo({
    conteudo: `${BOM_UTF8}${csv}`,
    nomeArquivo,
    mimeType: 'text/csv;charset=utf-8;',
  });
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function celulaTexto(coluna, linha) {
  const bruto = typeof coluna.accessor === 'function' ? coluna.accessor(linha) : linha?.[coluna.key];
  return escaparHtml(bruto ?? '—');
}

/**
 * Abre uma janela de impressão (PDF via "Salvar como PDF" do navegador) a
 * partir de colunas/linhas — sem depender de um elemento DOM pré-renderizado.
 * `metadados` (opcional) vira uma lista "chave: valor" acima da tabela (ex.:
 * período do filtro, fazenda ativa).
 */
export function abrirRelatorioParaImpressao({ titulo, subtitulo, colunas = [], linhas = [], metadados = {} }) {
  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) {
    window.alert('Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.');
    return;
  }

  const dataGeracao = formatarDataExportacao(new Date().toISOString());
  const metaLinhas = Object.entries(metadados || {})
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .map(([chave, valor]) => `<span><strong>${escaparHtml(chave)}:</strong> ${escaparHtml(valor)}</span>`)
    .join('');

  const cabecalhoTabela = colunas.map((coluna) => `<th>${escaparHtml(coluna.label ?? coluna.key)}</th>`).join('');
  const linhasTabela = linhas.length
    ? linhas.map((linha) => `<tr>${colunas.map((coluna) => `<td>${celulaTexto(coluna, linha)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${colunas.length || 1}" class="print-empty">Não há dados para este relatório.</td></tr>`;

  janela.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escaparHtml(titulo || 'Relatório HERDON')}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid #d1d5db; padding-bottom: 10px; }
          .print-head h1 { margin: 0; font-size: 1.4em; color: #1f2937; }
          .print-head p { margin: 4px 0 0; color: #4b5563; font-size: 0.9em; }
          .print-head .print-marca { color: #16a34a; font-weight: 800; letter-spacing: 0.08em; font-size: 11px; text-transform: uppercase; }
          .print-meta { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 14px; font-size: 12px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .print-empty { text-align: center; color: #6b7280; padding: 20px; }
          .print-foot { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 20px; color: #6b7280; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <header class="print-head">
          <div>
            <span class="print-marca">HERDON</span>
            <h1>${escaparHtml(titulo || 'Relatório HERDON')}</h1>
            ${subtitulo ? `<p>${escaparHtml(subtitulo)}</p>` : ''}
          </div>
          <div><strong>Gerado em</strong> ${dataGeracao}</div>
        </header>
        ${metaLinhas ? `<div class="print-meta">${metaLinhas}</div>` : ''}
        <table>
          <thead><tr>${cabecalhoTabela}</tr></thead>
          <tbody>${linhasTabela}</tbody>
        </table>
        <footer class="print-foot">Relatório gerado pelo HERDON</footer>
      </body>
    </html>
  `);

  janela.document.close();
  janela.focus();
  janela.print();
}
