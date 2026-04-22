import { Calendar, Home, MoreHorizontal, Package, Tractor } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'lotes', label: 'Rebanho', icon: Tractor },
  { id: 'calendarioOperacional', label: 'Calendário', icon: Calendar },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
];

export default function MobileBottomNav({ currentPage, onNavigate, onOpenMore }) {
  return (
    <nav className="mobile-bottom-nav sem-impressao" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const Icone = item.icon;
        const isMoreButton = item.id === 'mais';
        const isActive = !isMoreButton && currentPage === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => (isMoreButton ? onOpenMore?.() : onNavigate?.(item.id))}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
          >
            <Icone size={18} aria-hidden="true" /> {/* Ícone é decorativo, label no botão */}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
