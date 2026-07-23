import { Home, MoreHorizontal } from 'lucide-react';
import { navGroups } from '../navigation/navConfig.js';

// Extraído de MobileBottomNav.jsx para ser importável por testes puros
// node:test (que não sabem processar sintaxe JSX) sem precisar renderizar
// o componente.
//
// Sprint Visual 2: a barra inferior tem no máximo 5 itens. "dashboard" é
// direto (type: 'page'); "rebanho"/"manejo"/"gestao" abrem um bottom sheet
// com os itens do respectivo grupo de navConfig.js (type: 'group', sem
// pageId próprio — não navegam sozinhos); "mais" abre o restante (type:
// 'more').
function groupIcon(groupId) {
  return navGroups.find((group) => group.id === groupId)?.icon || MoreHorizontal;
}

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Painel', icon: Home, type: 'page' },
  { id: 'rebanho', label: 'Rebanho', icon: groupIcon('rebanho'), type: 'group', groupId: 'rebanho' },
  { id: 'manejo', label: 'Manejo', icon: groupIcon('manejo'), type: 'group', groupId: 'manejo' },
  { id: 'gestao', label: 'Gestão', icon: groupIcon('gestao'), type: 'group', groupId: 'gestao' },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal, type: 'more' },
];
