// Janelas de dias usadas pelos alertas (Sprint 16) — documentação + fonte
// única para os pontos onde já era seguro consolidar sem mudar o valor.
//
// A Sprint 13 apontou que financeiro (7 dias) e carência sanitária (3 dias)
// usam janelas diferentes. Auditado nesta sprint: são JANELAS DIFERENTES DE
// PROPÓSITO, não um bug — carência é um risco de segurança alimentar (janela
// mais curta e conservadora), contas a pagar/lote-saída são planejamento
// operacional (janela mais longa). Os valores NÃO foram alterados (mudar um
// número aqui muda o que aparece como alerta para o produtor, e a regra pede
// para não alterar isso sem teste dedicado) — só nomeados e centralizados
// onde já era seguro fazer isso (`alertasUnificados.js`).
//
// Constantes de outros arquivos (`hojeNaFazenda.js`, `alertasInteligentes.js`)
// são só documentadas aqui como referência — não foram importadas/religadas,
// para não tocar em código fora do escopo desta sprint.

export const HOJE = 0;
export const PROXIMOS_7_DIAS = 7;
export const PROXIMOS_30_DIAS = 30;

/** Janela de carência sanitária "vencendo em breve" — deliberadamente mais curta que PROXIMOS_7_DIAS (risco de segurança alimentar). */
export const CARENCIA_CRITICA_DIAS = 3;

// ── Referência (não usadas por import — documentação das janelas que já existem alhures) ──
// hojeNaFazenda.js: PESAGEM_LIMITE_DIAS = 30 (lote sem pesagem recente)
// hojeNaFazenda.js: FINANCEIRO_PROXIMO_DIAS = 3 (dashboard "hoje na fazenda" — janela própria, distinta do PROXIMOS_7_DIAS usado em alertasUnificados.js)
// alertasInteligentes.js: JANELA_CONSUMO_ESTOQUE_DIAS = 30, ESTOQUE_DIAS_CRITICO = 7, ESTOQUE_DIAS_ATENCAO = 15
// alertasInteligentes.js: TAREFA_DIAS_ALTO = 2, TAREFA_DIAS_CRITICO = 7
// alertasInteligentes.js: SANIDADE_DIAS_PADRAO_ANTES = 7, JANELA_CUSTO_DIAS = 30
