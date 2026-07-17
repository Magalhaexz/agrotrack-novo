import { Home, MoreHorizontal, Package, Receipt, Tractor } from 'lucide-react';

// Extraído de MobileBottomNav.jsx para ser importável por testes puros
// node:test (que não sabem processar sintaxe JSX) sem precisar renderizar
// o componente.
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Início', icon: Home },
  { id: 'lotes', label: 'Rebanho', icon: Tractor },
  { id: 'financeiro', label: 'Financeiro', icon: Receipt },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
];
