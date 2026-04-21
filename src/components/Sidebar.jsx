import { useEffect, useMemo, useState } from 'react';
import {
  Beef,
  ChevronDown,
  DollarSign,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  ShieldPlus,
  Syringe,
  X,
  ClipboardList,
} from 'lucide-react';
import logoAgrotrack from '../assets/logo_app1.png';
import { obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';

const navSections = [
  {
    id: 'main',
    title: 'Principal',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'rebanho',
    title: 'Rebanho',
    items: [
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: Beef },
      { id: 'pesagens', label: 'Movimentações', icon: ClipboardList },
      { id: 'comparativoLotes', label: 'Comparativo', icon: ClipboardList },
    ],
  },
  {
    id: 'gestao',
    title: 'Gestão',
    items: [
      { id: 'sanitario', label: 'Sanitário', icon: Syringe },
      { id: 'calendarioOperacional', label: 'Calendário', icon: ClipboardList },
      { id: 'suplementacao', label: 'Suplementação', icon: ShieldPlus },
      { id: 'estoque', label: 'Estoque', icon: Package },
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
      { id: 'fazendas', label: 'Configurações', icon: Settings },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate, alertCount = 0, user = null, hasPermission = () => true }) {
  const [openSections, setOpenSections] = useState({ main: true, rebanho: true, gestao: true });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário';
  const perfil = obterPerfilDoUsuario(user);

  const sections = useMemo(
    () =>
      navSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => {
            const permissao = permissoesPorPagina[item.id];
            return !permissao || hasPermission(permissao);
          }),
        }))
        .filter((section) => section.items.length > 0)
        .map((section) => ({
          ...section,
          hasActiveItem: section.items.some((item) => item.id === currentPage),
          isOpen: openSections[section.id] ?? true,
        })),
    [currentPage, hasPermission, openSections]
  );

  useEffect(() => {
    const onResize = () => window.innerWidth > 900 && setIsMobileMenuOpen(false);
    const onOpenDrawer = () => setIsMobileMenuOpen(true);
    window.addEventListener('resize', onResize);
    window.addEventListener('agrotrack-open-drawer', onOpenDrawer);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('agrotrack-open-drawer', onOpenDrawer);
    };
  }, []);

  return (
    <>
      <div className="mobile-topbar">
        <button type="button" className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu size={18} />
        </button>
        <img src={logoAgrotrack} alt="AgroTrack" className="mobile-topbar-logo" loading="lazy" />
      </div>
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`sb ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sb-logo">
          <img src={logoAgrotrack} alt="AgroTrack" style={{ width: 140 }} loading="lazy" />
          <button type="button" className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="sb-sec">
          {sections.map((section) => (
            <div key={section.id} className="nav-group">
              <button
                type="button"
                className={`nav-group-toggle ${section.hasActiveItem ? 'active' : ''}`}
                onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
              >
                <span>{section.title}</span>
                <ChevronDown size={14} className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`} />
              </button>

              {section.isOpen && (
                <div className="nav-sublist">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`nav subnav ${currentPage === item.id ? 'on' : ''}`}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ItemIcon size={16} className="nav-icon" />
                        <span>{item.label}</span>
                        {item.id === 'dashboard' && alertCount > 0 ? <span className="nav-badge">{alertCount}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sb-foot">
          <div className="avatar">{String(userName).slice(0, 2).toUpperCase()}</div>
          <div>
            <div className="u-name">{userName}</div>
            <div className="u-role">{perfil}</div>
          </div>
        </div>
      </aside>
    </>
  );
}
