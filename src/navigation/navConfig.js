import {
  Activity,
  BarChart3,
  Beef,
  Calculator,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileUp,
  HelpCircle,
  Layers,
  Leaf,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Package,
  Receipt,
  RefreshCw,
  Scale,
  Settings,
  ShieldPlus,
  Syringe,
  Tractor,
  TrendingUp,
  User,
  Warehouse,
} from 'lucide-react';

export const navSections = [
  {
    id: 'painel',
    title: 'Painel',
    items: [
      { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
      // "Alertas" não entra aqui nesta fase — evita duplicar pageId com "Decisões da
      // Fazenda" (grupo Decisão) e dois itens de sidebar ativos ao mesmo tempo.
      // Fica para uma Central de Alertas própria (ver auditoria/backlog).
    ],
  },
  {
    id: 'campoRebanho',
    title: 'Campo e Rebanho',
    items: [
      { id: 'lotes', label: 'Lotes e Rebanho', icon: Beef },
      { id: 'pesagens', label: 'Pesagens', icon: Scale },
      { id: 'modoCurral', label: 'Modo Curral', icon: Warehouse },
      { id: 'pastagens', label: 'Pastos', icon: Tractor },
      { id: 'suplementacao', label: 'Nutrição e Suplementação', icon: Leaf },
      { id: 'sanitario', label: 'Sanidade', icon: Syringe },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays },
    ],
  },
  {
    id: 'estoque',
    title: 'Estoque',
    items: [
      { id: 'estoque', label: 'Produtos e Insumos', icon: Package },
    ],
  },
  {
    id: 'financas',
    title: 'Finanças',
    items: [
      { id: 'financeiro', label: 'Visão Financeira', icon: Receipt },
      { id: 'fluxoCaixa', label: 'Fluxo de Caixa', icon: TrendingUp },
      { id: 'custosCompartilhados', label: 'Rateio de Custos', icon: Layers },
      { id: 'relatorioFinanceiro', label: 'Relatórios Financeiros', icon: FileBarChart },
    ],
  },
  {
    id: 'decisao',
    title: 'Decisão',
    items: [
      { id: 'cenarios', label: 'Simulador de Decisão', icon: Calculator },
      { id: 'resultados', label: 'Resultado dos Lotes', icon: BarChart3 },
      { id: 'decisoesFazenda', label: 'Decisões da Fazenda', icon: ListChecks },
      { id: 'indicadores', label: 'Indicadores', icon: Activity },
      { id: 'relatorios', label: 'Relatórios', icon: FileBarChart },
      { id: 'relatoriosGerenciais', label: 'Painel Gerencial', icon: FileBarChart },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      // Ponto de entrada único para Equipe — FuncionariosPage segue registrada (não apagada), ver backlog.
      { id: 'equipeAcessos', label: 'Equipe e Acessos', icon: ShieldPlus },
      { id: 'importacao', label: 'Importação', icon: FileUp },
      { id: 'minhaAssinatura', label: 'Planos e Assinatura', icon: CreditCard },
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
      { id: 'sincronizacao', label: 'Sincronização', icon: RefreshCw },
      { id: 'perfil', label: 'Perfil', icon: User },
    ],
  },
  {
    id: 'ajuda',
    title: 'Ajuda',
    items: [
      { id: 'guiaCriador', label: 'Guia do Criador', icon: HelpCircle },
      // "Suporte" removido da sidebar (decisão aprovada) — rota /suporte e SuportePage seguem intactas.
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
