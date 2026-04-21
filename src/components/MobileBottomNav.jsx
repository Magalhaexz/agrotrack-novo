import { Calendar, Home, MoreHorizontal, Package, Tractor } from 'lucide-react';

<<<<<<< HEAD
const NAV_ITEMS = [
=======
const itens = [
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'lotes', label: 'Rebanho', icon: Tractor },
  { id: 'calendarioOperacional', label: 'Calendário', icon: Calendar },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
];

export default function MobileBottomNav({ currentPage, onNavigate, onOpenMore }) {
  return (
<<<<<<< HEAD
    <nav className="mobile-bottom-nav sem-impressao" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const Icone = item.icon;
        const isMoreButton = item.id === 'mais';
        const isActive = !isMoreButton && currentPage === item.id;

=======
    <nav className="mobile-bottom-nav sem-impressao">
      {itens.map((item) => {
        const Icone = item.icon;
        const ativo = item.id !== 'mais' && currentPage === item.id;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        return (
          <button
            key={item.id}
            type="button"
<<<<<<< HEAD
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => (isMoreButton ? onOpenMore?.() : onNavigate?.(item.id))}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <Icone size={18} aria-hidden="true" /> {/* Ícone é decorativo, label no botão */}
=======
            className={`mobile-bottom-nav-item ${ativo ? 'active' : ''}`}
            onClick={() => (item.id === 'mais' ? onOpenMore?.() : onNavigate?.(item.id))}
          >
            <Icone size={18} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
