
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
  const dataGeracao = formatDate(new Date().toISOString().slice(0, 10));
  const titulo = meta.titulo || 'Relatório Gerencial';
  const fazenda = meta.fazenda || 'Fazenda';


  // Abre uma nova janela do navegador
  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) {
    alert('Não foi possível abrir a janela de impressão. Verifique se pop-ups estão bloqueados.');
    return;
  }

  // Escreve o conteúdo HTML na nova janela
  janela.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${nomeArquivo}</title>
        <style>

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

          /* Sprint 4 — estilos de impressão para o Relatório do Lote e para
             classes já usadas nos demais relatórios (não herdam as variáveis
             CSS do app, pois esta é uma janela/documento à parte). */
          .summary-list { display: grid; gap: 6px; margin-bottom: 12px; }
          .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid #f0f1f3; }
          .summary-row__label { color: #6b7280; }
          .summary-row__value { color: #111827; font-weight: 600; }

          .ui-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #f3f4f6; color: #374151; }
          .ui-badge-dot { display: none; }

          .report-note { display: flex; gap: 10px; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; background: #f9fafb; margin-bottom: 12px; }
          .report-note--warning { border-color: #fcd34d; background: #fffbeb; }
          .report-note--success { border-color: #86efac; background: #f0fdf4; }
          .report-note--info { border-color: #93c5fd; background: #eff6ff; }

          .saude-lote { border-left: 4px solid #9ca3af; background: #f9fafb; padding: 10px 12px; border-radius: 8px; margin: 8px 0; }
          .saude-lote--saudavel { border-left-color: #22c55e; }
          .saude-lote--atencao { border-left-color: #f59e0b; }
          .saude-lote--risco { border-left-color: #f97316; }
          .saude-lote--critico, .saude-lote--indisponivel { border-left-color: #ef4444; }
          .saude-lote__badge { margin-left: 8px; font-weight: 700; }
          .saude-lote__explicacoes { margin: 6px 0 0; padding-left: 18px; color: #4b5563; font-size: 12px; }

          .decisoes-lista, .relatorio-lote-preview__decisoes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
          .relatorio-lote-preview__decisoes { list-style: disc; padding-left: 18px; }
          .decisoes-item { border-left: 4px solid #9ca3af; background: #f9fafb; padding: 8px 10px; border-radius: 8px; }
          .decisoes-item__titulo { color: #111827; }
          .decisoes-item__linha { margin: 4px 0 0; color: #4b5563; font-size: 12px; }
          .decisoes-vazio { color: #6b7280; font-size: 13px; }

          .relatorio-lote-preview__cabecalho { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px; }
          .relatorio-lote-preview__marca { color: #16a34a; font-weight: 800; letter-spacing: 0.08em; font-size: 11px; text-transform: uppercase; }
          .relatorio-lote-preview__rodape { border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 10px; color: #6b7280; font-size: 11px; text-align: center; }
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

        <footer class="pdf-foot">
          <span>${nomeArquivo}</span>
          <span>Página 1</span>
        </footer>
      </body>
    </html>
  `);


  janela.document.close(); // Fecha o fluxo de escrita do documento
  janela.focus(); // Foca na nova janela
  janela.print(); // Invoca a caixa de diálogo de impressão do navegador
  // janela.close(); // Opcional: fecha a janela após a impressão (pode não funcionar em todos os navegadores ou ser indesejável)
}
