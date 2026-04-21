function escaparValor(valor) {
  const texto = String(valor ?? '');
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function exportarParaExcel(dados = [], colunas = [], nomeArquivo = 'relatorio') {
  const header = colunas.map((c) => escaparValor(c.label)).join(';');
  const linhas = dados.map((item) =>
    colunas.map((coluna) => escaparValor(item[coluna.key])).join(';')
  );

  const csv = [header, ...linhas].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${nomeArquivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
