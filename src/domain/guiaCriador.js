function arr(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Checklist de primeiros passos do HERDON. Não depende de nenhuma tabela
 * nova — cada item é derivado de dados que já existem em `db`.
 */
export function construirChecklistPrimeirosPassos(db = {}) {
  const fazendas = arr(db?.fazendas);
  const pastagens = arr(db?.pastagens);
  const lotesAtivos = arr(db?.lotes).filter((l) => l?.status === 'ativo');
  const pesagens = arr(db?.pesagens);
  const movimentacoes = arr(db?.movimentacoes_financeiras);

  const temFazenda = fazendas.length > 0;
  const temLote = lotesAtivos.length > 0;
  const temPesagem = pesagens.length > 0;
  const temFinanceiro = movimentacoes.length > 0;

  const itens = [
    {
      id: 'fazenda',
      texto: 'Cadastre sua fazenda',
      concluidoTexto: 'Fazenda cadastrada',
      concluido: temFazenda,
      rota: 'fazendas',
    },
    {
      id: 'pastos',
      texto: 'Cadastre seus pastos',
      concluidoTexto: 'Pastos cadastrados',
      concluido: pastagens.length > 0,
      rota: 'pastagens',
    },
    {
      id: 'lotes',
      texto: 'Cadastre seus lotes',
      concluidoTexto: 'Lotes cadastrados',
      concluido: temLote,
      rota: 'lotes',
    },
    {
      id: 'pesagens',
      texto: 'Registre ou importe suas pesagens',
      concluidoTexto: 'Pesagens registradas',
      concluido: temPesagem,
      rota: 'pesagens',
    },
    {
      id: 'financeiro',
      texto: 'Lance custos e receitas',
      concluidoTexto: 'Financeiro iniciado',
      concluido: temFinanceiro,
      rota: 'financeiro',
    },
    {
      id: 'hoje',
      texto: 'Acompanhe o Hoje na Fazenda',
      concluidoTexto: 'Acompanhando o Hoje na Fazenda',
      concluido: temFazenda && temLote,
      rota: 'dashboard',
    },
    {
      id: 'relatorios',
      texto: 'Gere relatórios',
      concluidoTexto: 'Relatórios disponíveis',
      concluido: temPesagem && temFinanceiro,
      rota: 'relatorios',
    },
  ];

  const totalConcluido = itens.filter((item) => item.concluido).length;
  const proximoPasso = itens.find((item) => !item.concluido) || null;

  return {
    itens,
    totalItens: itens.length,
    totalConcluido,
    proximoPasso,
    concluido: totalConcluido === itens.length,
  };
}
