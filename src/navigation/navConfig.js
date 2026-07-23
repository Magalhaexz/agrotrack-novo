import {
  Activity,
  AlertTriangle,
  BarChart3,
  Beef,
  BellRing,
  Building2,
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
  PieChart,
  Receipt,
  RefreshCw,
  Repeat,
  Scale,
  Settings,
  ShieldPlus,
  Sprout,
  Syringe,
  Tractor,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

// Sprint Visual 2 — sidebar simplificada em 6 áreas principais, na
// linguagem do pecuarista, em vez das 7 seções técnicas anteriores.
// Grupo "painel" é standalone (item direto, sem submenu/accordion);
// os outros 5 abrem e fecham (accordion) em Sidebar.jsx. Contas/sistema
// saíram da navegação principal — ver accountNavItems mais abaixo.
export const navGroups = [
  {
    id: 'painel',
    title: 'Painel Geral',
    icon: LayoutDashboard,
    standalone: true,
    items: [{ id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard }],
  },
  {
    id: 'rebanho',
    title: 'Rebanho',
    icon: Beef,
    items: [
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
    ],
  },
  {
    id: 'manejo',
    title: 'Manejo',
    icon: Tractor,
    items: [
      { id: 'pastagens', label: 'Pastos', icon: Sprout },
      { id: 'sanitario', label: 'Sanidade', icon: Syringe },
      { id: 'suplementacao', label: 'Nutrição', icon: Leaf },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays },
      { id: 'rotina', label: 'Rotinas da Equipe', icon: Repeat },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    icon: Wallet,
    items: [
      { id: 'estoque', label: 'Estoque', icon: Package },
      { id: 'financeiro', label: 'Financeiro', icon: Receipt },
      { id: 'fluxoCaixa', label: 'Fluxo de Caixa', icon: TrendingUp },
      { id: 'custos', label: 'Custos por Lote', icon: DollarSign },
      { id: 'custosCompartilhados', label: 'Rateio de Custos', icon: Layers },
      { id: 'resultados', label: 'Resultados', icon: BarChart3 },
      { id: 'decisoesFazenda', label: 'Decisões', icon: ListChecks },
      { id: 'cenarios', label: 'Simulador de Decisão', icon: Calculator },
    ],
  },
  {
    id: 'acompanhamento',
    title: 'Acompanhamento',
    icon: BellRing,
    items: [
      { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
      { id: 'indicadores', label: 'Indicadores', icon: Activity },
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      { id: 'relatoriosGerenciais', label: 'Painel Gerencial', icon: PieChart },
      { id: 'comparativo', label: 'Comparativo de Lotes', icon: GitCompare },
      { id: 'evolucaoRebanho', label: 'Evolução do Rebanho', icon: LineChart },
    ],
  },
  {
    id: 'administracao',
    title: 'Administração',
    icon: Building2,
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
      { id: 'equipeAcessos', label: 'Equipe e Acessos', icon: ShieldPlus },
      { id: 'importacao', label: 'Importação', icon: FileUp },
    ],
  },
];

// Conta/sistema — não competem com as áreas operacionais: aparecem no
// rodapé da sidebar / menu do usuário, nunca como abas principais.
export const accountNavItems = [
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
  { id: 'minhaAssinatura', label: 'Planos e Assinatura', icon: CreditCard },
  { id: 'sincronizacao', label: 'Sincronização', icon: RefreshCw },
  { id: 'guiaCriador', label: 'Guia do Criador', icon: HelpCircle },
];

// Mapa pageId -> groupId, usado para abrir automaticamente o grupo
// correspondente ao entrar numa página interna (ex.: entrar em Pesagens
// abre o grupo Rebanho e marca Rebanho como contexto ativo).
export const groupIdByPageId = navGroups.reduce((acc, group) => {
  for (const item of group.items) {
    acc[item.id] = group.id;
  }
  return acc;
}, {});

export const navLabelMap = [...navGroups.flatMap((group) => group.items), ...accountNavItems].reduce(
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
