export const LOTE_TABS = [
  { id: 'visao_geral', label: 'Visão geral' },
  { id: 'animais', label: 'Animais' },
  { id: 'pastagem', label: 'Pasto' },
  { id: 'pesagens', label: 'Pesagens' },
  { id: 'retiradas', label: 'Retiradas' },
  { id: 'nutricao', label: 'Nutrição' },
  { id: 'sanitario', label: 'Sanitário' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'historico', label: 'Histórico' },
];

// Seção 3 do sprint de fechamento: o formulário de retirada oferece só os 3
// tipos que reduzem lote.qtd de fato ('venda'/'morte'/'transferencia_saida' —
// os mesmos valores já usados em todo o domínio, ex.: saudeLote.js,
// evolucaoRebanho.js). Descarte/abate/outro continuam existindo em dados já
// cadastrados e em todos os cálculos, só saem das OPÇÕES deste formulário.
export const RETIRADA_TIPOS = [
  { value: 'venda', label: 'Venda' },
  { value: 'morte', label: 'Morte/perda' },
  { value: 'transferencia_saida', label: 'Transferência de saída' },
];

// As outras 2 ações do menu padronizado (loteAcoesConfig.js) aparecem no MESMO
// dropdown de "tipo" por pedido do sprint, mas nunca viram uma retirada —
// selecioná-las redireciona para o fluxo próprio (RetiradaAnimaisModal trata
// isso via REDIRECIONAMENTO_TIPOS, nunca chama onSubmit para elas).
export const REDIRECIONAMENTO_TIPOS = [
  { value: 'trocar_pasto', label: 'Trocar lote de pasto' },
  { value: 'finalizar_lote', label: 'Finalizar lote' },
];

export const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'vendido', label: 'Vendido' },
];

export const PERIODO_OPTIONS = [
  { value: 'todos', label: 'Todo o período' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
];
