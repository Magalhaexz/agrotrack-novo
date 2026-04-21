<<<<<<< HEAD
import { formatDate } from './calculations'; // Assuming calculations.js contains formatDate

/**
 * Exporta um relatório para impressão (geralmente PDF via navegador).
 * Abre uma nova janela com o conteúdo HTML fornecido, adiciona cabeçalho e rodapé,
 * e invoca a função de impressão do navegador.
 *
 * @param {HTMLElement} elemento - O elemento HTML cujo conteúdo será exportado.
 * @param {string} [nomeArquivo='relatorio'] - O título do documento na janela de impressão.
 * @param {object} [meta={}] - Metadados para o cabeçalho do relatório.
 * @param {string} [meta.titulo='Relatório Gerencial'] - Título principal do relatório.
 * @param {string} [meta.fazenda='Fazenda'] - Nome da fazenda ou local.
 */
export function exportarRelatorio(elemento, nomeArquivo = 'relatorio', meta = {}) {
  if (!elemento) {
    console.error('Elemento HTML para exportar não fornecido.');
    return;
  }

  const conteudo = elemento.innerHTML;
  // Obtém a data atual e formata para BR, usando a função importada
=======
import { formatDate } from './calculations';

export function exportarRelatorio(elemento, nomeArquivo = 'relatorio', meta = {}) {
  if (!elemento) return;

  const conteudo = elemento.innerHTML;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const dataGeracao = formatDate(new Date().toISOString().slice(0, 10));
  const titulo = meta.titulo || 'Relatório Gerencial';
  const fazenda = meta.fazenda || 'Fazenda';

<<<<<<< HEAD
  // Abre uma nova janela do navegador
  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) {
    alert('Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.');
    return;
  }

  // Escreve o conteúdo HTML na nova janela
  janela.document.write(`
    <!DOCTYPE html>
=======
  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) return;

  janela.document.write(`
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    <html>
      <head>
        <title>${nomeArquivo}</title>
        <style>
<<<<<<< HEAD
          /* Reset básico para impressão */
          body {
            font-family: Arial, sans-serif;
            padding: 24px;
            color: #1f2937; /* Cor de texto padrão para impressão */
            margin: 0;
            -webkit-print-color-adjust: exact; /* Força a impressão de cores de fundo e texto */
            print-color-adjust: exact;
          }

          /* Estilo do cabeçalho do PDF */
          .pdf-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 8px;
            font-size: 14px;
          }
          .pdf-head h2 {
            margin: 0;
            font-size: 1.5em; /* Título maior */
            color: #1f2937;
          }
          .pdf-head div {
            color: #4b5563;
          }
          .pdf-head div:last-child {
            text-align: right;
          }

          /* Estilo do rodapé do PDF */
          .pdf-foot {
            position: fixed;
            bottom: 10px;
            left: 24px;
            right: 24px;
            font-size: 12px;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
          }

          /* Regras para evitar quebra de elementos na impressão */
          .card, .ui-card {
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 16px; /* Adiciona margem para evitar quebra logo após o card */
          }

          /* Esconde elementos que não devem aparecer na impressão */
          .no-print {
            display: none !important;
          }

          /* Estilos para tabelas, se houver */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
=======
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          .pdf-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #d1d5db; padding-bottom:8px; }
          .pdf-foot { position:fixed; bottom:10px; left:24px; right:24px; font-size:12px; color:#6b7280; display:flex; justify-content:space-between; }
          .card, .ui-card { break-inside: avoid; page-break-inside: avoid; }
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </style>
      </head>
      <body>
        <header class="pdf-head">
          <div>
            <h2>${titulo}</h2>
            <div>${fazenda}</div>
          </div>
          <div>Gerado em ${dataGeracao}</div>
        </header>
        <main>${conteudo}</main>
<<<<<<< HEAD
        <footer class="pdf-foot">
          <span>${nomeArquivo}</span>
          <span>Página 1</span>
        </footer>
=======
        <footer class="pdf-foot"><span>${nomeArquivo}</span><span>Página 1</span></footer>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      </body>
    </html>
  `);

<<<<<<< HEAD
  janela.document.close(); // Fecha o fluxo de escrita do documento
  janela.focus(); // Foca na nova janela
  janela.print(); // Invoca a caixa de diálogo de impressão do navegador
  // janela.close(); // Opcional: fecha a janela após a impressão (pode não funcionar em todos os navegadores ou ser indesejável)
}
=======
  janela.document.close();
  janela.focus();
  janela.print();
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
