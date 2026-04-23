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
    id: 'rebanho',
    title: 'Rebanho',
    items: [
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'pesagens', label: 'Pesagem', icon: Scale },
    ],
  },
  {
    id: 'manejo',
    title: 'Manejo',
    items: [
      { id: 'sanitario', label: 'Sanitário', icon: Syringe },
      { id: 'suplementacao', label: 'Suplementação', icon: ShieldPlus },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays },
    ],
  },
  {
    id: 'financeiro_estoque',
    title: 'Financeiro & Estoque',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
      { id: 'estoque', label: 'Estoque', icon: Package },
    ],
  },
  {
    id: 'analises_relatorios',
    title: 'Análises & Relatórios',
    items: [
      { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
    ],
  },
  {
    id: 'cadastros_configuracoes',
    title: 'Cadastros & Configurações',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
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
