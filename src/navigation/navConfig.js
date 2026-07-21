import {
  Activity,
  BarChart3,
  Beef,
  BellRing,
  Calculator,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileBarChart,
  FileUp,
  GitCompare,
  HelpCircle,
  Layers,
  Leaf,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Repeat,
  Scale,
  Settings,
  ShieldPlus,
  Syringe,
  Tractor,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

// Sprint de reorganização estratégica da sidebar — grupos seguem o fluxo real
// de trabalho do produtor (ver o que está acontecendo → operar a fazenda →
// organizar a rotina → controlar custos → analisar e decidir → administrar a
// conta), não a ordem em que os módulos foram construídos historicamente.
// Detalhes e critérios em docs/SPRINT_REORGANIZACAO_SIDEBAR_HERDON.md.
export const navSections = [
  {
    id: 'inicio',
    title: 'Início',
    items: [
      { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
      { id: 'alertas', label: 'Central de Alertas', icon: BellRing },
    ],
  },
  {
    id: 'rebanhoCampo',
    title: 'Rebanho e Campo',
    items: [
      { id: 'pastagens', label: 'Pastos', icon: Tractor },
      { id: 'lotes', label: 'Lotes e Rebanho', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
      { id: 'suplementacao', label: 'Nutrição e Suplementação', icon: Leaf },
      { id: 'sanitario', label: 'Sanidade', icon: Syringe },
      // Antes era o único item do grupo isolado "Estoque" — nenhum grupo
      // deve ter um item só, e Produtos e Insumos é parte do fluxo de campo.
      { id: 'estoque', label: 'Produtos e Insumos', icon: Package },
    ],
  },
  {
    id: 'rotina',
    title: 'Rotina',
    items: [
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays },
      { id: 'rotina', label: 'Rotinas da Equipe', icon: Repeat },
    ],
  },
  {
    id: 'financas',
    title: 'Finanças',
    items: [
      { id: 'financeiro', label: 'Visão Financeira', icon: Receipt },
      { id: 'fluxoCaixa', label: 'Fluxo de Caixa', icon: TrendingUp },
      { id: 'custos', label: 'Custos por Lote', icon: DollarSign },
      { id: 'custosCompartilhados', label: 'Rateio de Custos', icon: Layers },
      // "Relatórios Financeiros" saiu daqui: já é um card de acesso claro
      // dentro do hub "Relatórios" (RelatoriosPage.jsx) — dois pontos de
      // entrada para o mesmo relatório só duplicavam o menu. A rota
      // /relatorio-financeiro continua funcionando normalmente.
    ],
  },
  {
    id: 'analisesDecisao',
    title: 'Análises e Decisão',
    items: [
      { id: 'resultados', label: 'Resultado dos Lotes', icon: BarChart3 },
      { id: 'comparativo', label: 'Comparativo de Lotes', icon: GitCompare },
      { id: 'evolucaoRebanho', label: 'Evolução do Rebanho', icon: LineChart },
      { id: 'indicadores', label: 'Indicadores', icon: Activity },
      { id: 'cenarios', label: 'Simulador de Decisão', icon: Calculator },
      // Mantida: agrupa lotes abaixo da meta, estoque crítico e sanidade
      // próxima por categoria, com ranking de saúde de lote e assistente
      // HERDON embutido — conteúdo que a Central de Alertas não replica.
      { id: 'decisoesFazenda', label: 'Decisões da Fazenda', icon: ListChecks },
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      // "Painel Gerencial" (relatoriosGerenciais) VOLTA para a sidebar.
      // A deduplicação anterior ficou pela metade: tirou a entrada de menu
      // desta página por duplicar DashboardPremiumPage, mas DashboardPremium
      // também não tinha entrada — resultado: as duas ficaram inacessíveis,
      // e "Relatórios avançados" é vendido no plano PRO (domain/planos.js),
      // ou seja, o cliente pagava por uma tela sem caminho até ela.
      // Agora DashboardPremiumPage foi removida (era subconjunto estrito:
      // mesmos 12 campos, enquanto esta tem 17 — inclui margem/cabeça,
      // margem/ha, arrobas vendidas, kg vivo/ha e área total de pastagem).
      { id: 'relatoriosGerenciais', label: 'Painel Gerencial', icon: FileBarChart },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      // "Equipe e Acessos" (profiles/invites) = quem tem LOGIN na conta.
      // "Funcionários" (tabela funcionarios) = peões/vaqueiros SEM login,
      // atribuíveis a tarefas. São entidades distintas, não duplicadas.
      { id: 'equipeAcessos', label: 'Equipe e Acessos', icon: ShieldPlus },
      // FuncionariosPage é o ÚNICO lugar que cria funcionário
      // (createOperationalRecord('funcionarios')). Sem entrada no menu, o
      // seletor de responsável de Tarefas, Sanidade e Rotinas ficava sempre
      // vazio — não havia como cadastrar ninguém.
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
      { id: 'importacao', label: 'Importação', icon: FileUp },
    ],
  },
  {
    id: 'contaSistema',
    title: 'Conta e Sistema',
    items: [
      { id: 'perfil', label: 'Perfil', icon: User },
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
      { id: 'minhaAssinatura', label: 'Planos e Assinatura', icon: CreditCard },
      // "Sincronização" saiu do meio dos itens operacionais de Gestão e veio
      // para o rodapé de conta/sistema (é uma função técnica, não do dia a
      // dia). Continua como item de sidebar (não só dentro de Configurações)
      // porque a permissão de configuracoes:ver não cobre visualizador, que
      // hoje acessa sincronização por ter dashboard:ver — escondê-la só
      // dentro de Configurações tiraria esse acesso. ConfiguracoesPage.jsx
      // também ganhou uma seção "Sincronização e dados" com atalho.
      { id: 'sincronizacao', label: 'Sincronização', icon: RefreshCw },
      { id: 'guiaCriador', label: 'Guia do Criador', icon: HelpCircle },
    ],
  },
];

export const secondaryNavItems = [];

export const navLabelMap = [...navSections.flatMap((section) => section.items), ...secondaryNavItems].reduce(
  (acc, item) => {
    acc[item.id] = item.label;
    return acc;
  },
  {}
);

export function getNavLabel(pageId) {
  if (navLabelMap[pageId]) {
    return navLabelMap[pageId];
  }

  return String(pageId || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
