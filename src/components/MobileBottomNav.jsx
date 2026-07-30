import { NAV_ITEMS } from './mobileBottomNavItems.js';
import { groupIdByPageId } from '../navigation/navConfig.js';

export default function MobileBottomNav({ currentPage, onNavigate, onOpenGroup, onOpenMore }) {
  const activeGroupId = groupIdByPageId[currentPage] || null;

  return (
    <nav className="mobile-bottom-nav sem-impressao" aria-label="Navegação principal">
      {NAV_ITEMS.map((item) => {
        const Icone = item.icon;
        const isActive = item.type === 'page'
          ? currentPage === item.id
          : item.type === 'group'
            ? activeGroupId === item.groupId
            : false;

        function handleClick() {
          if (item.type === 'page') {
            onNavigate?.(item.id);
            return;
          }
          if (item.type === 'group') {
            onOpenGroup?.(item.groupId);
            return;
          }
          onOpenMore?.();
        }

        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={handleClick}
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
