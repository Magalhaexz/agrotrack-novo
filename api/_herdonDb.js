// Monta o `db` operacional de UMA conta (owner_user_id) para as funções puras
// de domínio (`gerarAlertasUnificados`, `buildRelatorioFinanceiro` etc.) —
// extraído do Sprint 7 (`telegram-relatorio-diario.js`) para ser reaproveitado
// também pelo Bot do Telegram (Sprint 8, `telegram-webhook.js`). Só leitura,
// sempre filtrada por `owner_user_id` — nunca lê outra conta.

// Tabelas que `gerarAlertasUnificados` precisa para montar o `db` — mesma
// lista de fontes já auditada no Sprint 5, nada além disso é lido.
export const TABELAS_NECESSARIAS = [
  // `fazendas` alimenta o recorte por fazenda (nome nos títulos, seleção e o
  // rótulo multi-fazenda dos alertas do Sprint 28, que sem isto ficava vazio).
  'fazendas',
  'lotes',
  'animais',
  'pesagens',
  'movimentacoes_financeiras',
  'estoque',
  'movimentacoes_estoque',
  'tarefas',
  'sanitario',
  'pastagens',
  // Sprint 16: tratativa da Central de Alertas — sem isso, o bot mostraria
  // alertas já resolvidos/ignorados/adiados como se ainda fossem prioridade.
  'alertas_tratativas',
  // Bot operacional (Sprint): resolução de responsável por nome ao cadastrar
  // tarefa por linguagem natural.
  'funcionarios',
  // Sprint de expansão do bot operacional: consumo de suplementação
  // (registrar_consumo_suplementacao escreve aqui).
  'consumo_suplementacao',
];

export async function montarDbDaConta(client, ownerUserId) {
  const resultados = await Promise.all(
    TABELAS_NECESSARIAS.map((tabela) => client.from(tabela).select('*').eq('owner_user_id', ownerUserId))
  );

  const db = {};
  TABELAS_NECESSARIAS.forEach((tabela, index) => {
    const { data, error } = resultados[index];
    if (error) throw error;
    db[tabela] = Array.isArray(data) ? data : [];
  });
  return db;
}
