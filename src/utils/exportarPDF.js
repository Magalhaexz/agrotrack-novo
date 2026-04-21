import { formatDate } from './calculations';

export function exportarRelatorio(elemento, nomeArquivo = 'relatorio', meta = {}) {
  if (!elemento) return;

  const conteudo = elemento.innerHTML;
  const dataGeracao = formatDate(new Date().toISOString().slice(0, 10));
  const titulo = meta.titulo || 'Relatório Gerencial';
  const fazenda = meta.fazenda || 'Fazenda';

  const janela = window.open('', '_blank', 'width=1024,height=768');
  if (!janela) return;

  janela.document.write(`
    <html>
      <head>
        <title>${nomeArquivo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
          .pdf-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #d1d5db; padding-bottom:8px; }
          .pdf-foot { position:fixed; bottom:10px; left:24px; right:24px; font-size:12px; color:#6b7280; display:flex; justify-content:space-between; }
          .card, .ui-card { break-inside: avoid; page-break-inside: avoid; }
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
        <footer class="pdf-foot"><span>${nomeArquivo}</span><span>Página 1</span></footer>
      </body>
    </html>
  `);

  janela.document.close();
  janela.focus();
  janela.print();
}
