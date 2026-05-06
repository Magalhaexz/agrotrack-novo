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
    description: 'Base da operacao: fazendas, lotes, animais e equipe.',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'funcionarios', label: 'Funcionarios', icon: Users },
    ],
  },
  {
    id: 'nutricao',
    title: 'Nutricao / Suplementacao',
    description: 'Dietas, suplementos e planejamento alimentar dos lotes.',
    items: [
      { id: 'suplementacao', label: 'Nutricao e Suplementacao', icon: ShieldPlus },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    description: 'Medicamentos, vacinas, materiais e insumos gerais.',
    items: [
      { id: 'estoque', label: 'Estoque Geral', icon: Package },
    ],
  },
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Controle de lancamentos, pagamentos e resultado.',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    ],
  },
  {
    id: 'operacao',
    title: 'Operacao',
    description: 'Rotina de manejo, agenda e saude do rebanho.',
    items: [
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
      { id: 'sanitario', label: 'Sanitario', icon: Syringe },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendario', icon: CalendarDays },
    ],
  },
  {
    id: 'analises_relatorios',
    title: 'Analises e Relatorios',
    description: 'Comparativos e relatorios executivos da operacao.',
    items: [
      { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
      { id: 'resultados', label: 'Relatorios', icon: ClipboardList },
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configuracoes',
    items: [
      { id: 'configuracoes', label: 'Configuracoes', icon: Settings },
    ],
  },
];

export const secondaryNavItems = [
  { id: 'perfil', label: 'Meu Perfil', icon: User },
  { id: 'configuracoes', label: 'Configuracoes', icon: Settings },
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
