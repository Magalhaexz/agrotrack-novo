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

// ── Assistente por regras do Bot do Telegram (Sprint 8) ─────────────────────
//
// Sem IA generativa nesta sprint: cada função abaixo só filtra/formata a
// lista que `gerarAlertasUnificados()` já produziu (Sprint 5) — nenhum
// cálculo novo, nenhuma chamada externa. Quando a tabela de origem está
// vazia (conta nova, sem nenhum registro), respondemos que não há dados
// suficientes em vez de fingir que "está tudo certo".
const MSG_DADOS_INSUFICIENTES = 'Não encontrei dados suficientes no HERDON para responder isso agora.';

export function gerarRespostaAjudaTelegram() {
  return [
    'HERDON — Comandos disponíveis',
    '',
    '/relatorio — relatório diário completo',
    '/prioridades — principais pendências agora',
    '/pagamentos — contas vencidas e a vencer',
    '/estoque — itens de estoque em atenção',
    '/tarefas — tarefas atrasadas e de hoje',
    '/lotes — GMD, pesagem e decisão de venda',
    '/ajuda — esta mensagem',
    '',
    'Ou pergunte com suas palavras, por exemplo:',
    '"O que preciso fazer hoje?"',
    '"Tem conta vencida?"',
    '"Tem produto acabando?"',
    '"Qual lote está pior?"',
    '"Tenho lote pronto para venda?"',
    '"Tem tarefa atrasada?"',
  ].join('\n');
}

/** `/prioridades` — as N pendências mais urgentes, na ordem que `gerarAlertasUnificados` já prioriza. */
export function gerarRespostaPrioridadesTelegram(alertas = [], limite = 6) {
  const lista = (Array.isArray(alertas) ? alertas : []).filter((a) => a?.prioridade !== 'informativo');
  if (lista.length === 0) {
    return '✅ Nenhuma prioridade pendente agora. Fazenda em dia.';
  }

  const linhas = ['📋 Prioridades HERDON', ''];
  lista.slice(0, limite).forEach((alerta) => {
    const emoji = PRIORIDADE_LABEL[alerta.prioridade]?.emoji || '•';
    linhas.push(`${emoji} ${alerta.titulo}`);
  });
  return linhas.join('\n');
}

/** `/pagamentos` — reaproveita os alertas de origem financeira já agrupados (contas vencidas/vencendo/custo alto). */
export function gerarRespostaPagamentosTelegram(alertas = [], { temMovimentacoes = true } = {}) {
  if (!temMovimentacoes) return MSG_DADOS_INSUFICIENTES;

  const financeiros = (Array.isArray(alertas) ? alertas : []).filter((a) => a?.origem === 'financeiro');
  if (financeiros.length === 0) {
    return '✅ Nenhuma conta vencida ou vencendo em breve.';
  }

  const linhas = ['💰 Pagamentos HERDON', ''];
  financeiros.forEach((alerta) => {
    linhas.push(`• ${alerta.titulo}${alerta.descricao ? `: ${alerta.descricao}` : ''}`);
  });
  return linhas.join('\n');
}

/** `/estoque` — reaproveita os alertas de origem estoque (zerado/abaixo do mínimo/perto do mínimo). */
export function gerarRespostaEstoqueTelegram(alertas = [], { temEstoque = true } = {}) {
  if (!temEstoque) return MSG_DADOS_INSUFICIENTES;

  const itens = (Array.isArray(alertas) ? alertas : []).filter((a) => a?.origem === 'estoque');
  if (itens.length === 0) {
    return '✅ Estoque sem itens em atenção agora.';
  }

  const linhas = ['📦 Estoque HERDON', ''];
  itens.forEach((alerta) => {
    linhas.push(`• ${alerta.titulo}${alerta.descricao ? `: ${alerta.descricao}` : ''}`);
  });
  return linhas.join('\n');
}

/** `/tarefas` — reaproveita os alertas de origem tarefas (atrasadas + vencendo hoje). */
export function gerarRespostaTarefasTelegram(alertas = [], { temTarefas = true } = {}) {
  if (!temTarefas) return MSG_DADOS_INSUFICIENTES;

  const tarefas = (Array.isArray(alertas) ? alertas : []).filter((a) => a?.origem === 'tarefas');
  if (tarefas.length === 0) {
    return '✅ Nenhuma tarefa atrasada ou para hoje.';
  }

  const linhas = ['✅ Tarefas HERDON', ''];
  tarefas.forEach((alerta) => {
    linhas.push(`• ${alerta.titulo}${alerta.descricao ? `: ${alerta.descricao}` : ''}`);
  });
  return linhas.join('\n');
}

const TIPOS_LOTES = new Set(['gmd', 'peso_alvo', 'sem-pesagem', 'pronto-venda', 'custo-alto-arroba']);

/** `/lotes` — reaproveita só os alertas de GMD, pesagem e decisão de venda (não inclui pasto/sanidade). */
export function gerarRespostaLotesTelegram(alertas = [], { temLotes = true } = {}) {
  if (!temLotes) return MSG_DADOS_INSUFICIENTES;

  const doLote = (Array.isArray(alertas) ? alertas : []).filter((a) => TIPOS_LOTES.has(a?.tipo));
  if (doLote.length === 0) {
    return '✅ Nenhuma pendência de GMD, pesagem ou decisão de venda agora.';
  }

  const linhas = ['🐂 Lotes HERDON', ''];
  doLote.forEach((alerta) => {
    linhas.push(`• ${alerta.titulo}${alerta.descricao ? `: ${alerta.descricao}` : ''}`);
  });
  return linhas.join('\n');
}
