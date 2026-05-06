import {
  Beef,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  MapPin,
  Package,
  Scale,
  Settings,
  ShieldPlus,
  Syringe,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

export const navSections = [
  {
    id: 'main',
    title: '',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'cadastros',
    title: 'Cadastros',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
    ],
  },
  {
    id: 'nutricao',
    title: 'Nutrição / Suplementação',
    items: [
      { id: 'suplementacao', label: 'Nutrição e Suplementação', icon: ShieldPlus },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    items: [
      { id: 'estoque', label: 'Estoque Geral', icon: Package },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    ],
  },
  {
    id: 'operacao',
    title: 'Operação',
    items: [
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
      { id: 'sanitario', label: 'Sanitário', icon: Syringe },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays },
    ],
  },
  {
    id: 'analises_relatorios',
    title: 'Análises e Relatórios',
    items: [
      { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    items: [
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export const secondaryNavItems = [
  { id: 'perfil', label: 'Meu Perfil', icon: User },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

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
