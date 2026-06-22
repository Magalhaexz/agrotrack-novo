import {
  Activity,
  BarChart3,
  Beef,
  Calculator,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileUp,
  HelpCircle,
  Layers,
  Leaf,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Scale,
  Settings,
  Syringe,
  Tractor,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

export const navSections = [
  {
    id: 'inicio',
    title: '',
    items: [{ id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard }],
  },
  {
    id: 'operacao',
    title: 'Operação',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'pastagens', label: 'Pastos', icon: Tractor },
      { id: 'lotes', label: 'Lotes e Rebanho', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
      { id: 'estoque', label: 'Estoque', icon: Package },
      { id: 'suplementacao', label: 'Suplementação', icon: Leaf },
      { id: 'sanitario', label: 'Sanidade', icon: Syringe },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    items: [
      { id: 'financeiro', label: 'Movimentações Financeiras', icon: Receipt },
      { id: 'fluxoCaixa', label: 'Fluxo de Caixa', icon: TrendingUp },
      { id: 'custosCompartilhados', label: 'Rateio de Custos', icon: Layers },
    ],
  },
  {
    id: 'decisao',
    title: 'Decisão',
    items: [
      { id: 'resultados', label: 'Resultado dos Lotes', icon: BarChart3 },
      { id: 'cenarios', label: 'Simulador de Decisão', icon: Calculator },
      { id: 'indicadores', label: 'Indicadores', icon: Activity },
      { id: 'relatoriosGerenciais', label: 'Painel Gerencial', icon: FileBarChart },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    items: [
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      { id: 'funcionarios', label: 'Equipe', icon: Users },
      { id: 'minhaAssinatura', label: 'Planos e Assinatura', icon: CreditCard },
      { id: 'importacao', label: 'Importação', icon: FileUp },
      { id: 'sincronizacao', label: 'Sincronização', icon: RefreshCw },
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
      { id: 'perfil', label: 'Perfil', icon: User },
    ],
  },
  {
    id: 'ajuda',
    title: 'Ajuda',
    items: [
      { id: 'guiaCriador', label: 'Guia do Criador', icon: HelpCircle },
      { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
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
