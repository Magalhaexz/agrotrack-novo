import { Calendar, Home, MoreHorizontal, Package, Tractor } from 'lucide-react';

const itens = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'lotes', label: 'Rebanho', icon: Tractor },
  { id: 'calendarioOperacional', label: 'Calendário', icon: Calendar },
  { id: 'estoque', label: 'Estoque', icon: Package },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
];

export default function MobileBottomNav({ currentPage, onNavigate, onOpenMore }) {
  return (
    <nav className="mobile-bottom-nav sem-impressao">
      {itens.map((item) => {
        const Icone = item.icon;
        const ativo = item.id !== 'mais' && currentPage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav-item ${ativo ? 'active' : ''}`}
            onClick={() => (item.id === 'mais' ? onOpenMore?.() : onNavigate?.(item.id))}
          >
            <Icone size={18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
