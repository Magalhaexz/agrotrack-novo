// Formatador puro do Relatório Diário via Telegram (Sprint 6).
//
// Recebe a lista já padronizada por `gerarAlertasUnificados()`
// (Sprint 5 — src/domain/alertasUnificados.js) e devolve texto simples pronto
// para `sendMessage` do Telegram. Não busca dados, não calcula nada — só
// formata o que o motor único já produziu.
//
// Cuidado deliberado de privacidade: a mensagem usa só os totais/títulos já
// resumidos (ex.: "2 contas estão vencidas"), nunca valores em R$ linha a
// linha, nomes de fornecedor ou descrição de despesa individual — mesmo que
// o alerta tenha uma `descricao` mais detalhada, ela não entra aqui.

const PRIORIDADE_LABEL = {
  critico: { emoji: '🔴', titulo: 'CRÍTICO' },
  atencao: { emoji: '🟡', titulo: 'ATENÇÃO' },
  decisao: { emoji: '🟢', titulo: 'DECISÃO' },
};

const ORDEM_GRUPOS = ['critico', 'atencao', 'decisao'];
const LIMITE_ITENS_POR_GRUPO = 6;

function formatarDataBR(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

/**
 * Gera o texto do relatório diário. `alertas` deve vir de
 * `gerarAlertasUnificados(db)` — itens com `prioridade: 'informativo'` são
 * ignorados aqui (mesma densidade visual já usada no Dashboard, Sprint 4/5).
 */
export function gerarRelatorioDiarioTelegram(alertas = [], opcoes = {}) {
  const agora = opcoes.agora || new Date();
  const nomeConta = opcoes.nomeConta ? ` — ${opcoes.nomeConta}` : '';
  const lista = Array.isArray(alertas) ? alertas : [];

  const grupos = { critico: [], atencao: [], decisao: [] };
  lista.forEach((alerta) => {
    if (grupos[alerta?.prioridade]) grupos[alerta.prioridade].push(alerta);
  });

  const linhas = [`📋 HERDON — Relatório de hoje (${formatarDataBR(agora)})${nomeConta}`, ''];
  const totalExibido = ORDEM_GRUPOS.reduce((soma, chave) => soma + grupos[chave].length, 0);

  if (totalExibido === 0) {
    linhas.push('✅ Nenhuma prioridade pendente hoje.');
  } else {
    ORDEM_GRUPOS.forEach((chave) => {
      const itens = grupos[chave];
      if (itens.length === 0) return;

      const { emoji, titulo } = PRIORIDADE_LABEL[chave];
      linhas.push(`${emoji} ${titulo}`);
      itens.slice(0, LIMITE_ITENS_POR_GRUPO).forEach((item) => {
        linhas.push(`• ${item.titulo}`);
      });
      if (itens.length > LIMITE_ITENS_POR_GRUPO) {
        linhas.push(`• +${itens.length - LIMITE_ITENS_POR_GRUPO} outro(s) alerta(s) nesta faixa`);
      }
      linhas.push('');
    });
  }

  linhas.push('Abra o HERDON para ver detalhes e agir.');

  return linhas.join('\n').trim();
}
