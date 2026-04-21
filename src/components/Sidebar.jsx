import { useEffect, useMemo, useState } from 'react';
import {
  Beef,
  ChevronDown,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  Menu,
  Package,
  Scale,
  MapPin,
  Settings,
  ShieldPlus,
  Syringe,
  Users,
  X,
  ClipboardList,
  CheckSquare,
} from 'lucide-react';
import { obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';

const navSections = [
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
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
      { id: 'pesagens', label: 'Pesagem', icon: Scale },
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate, alertCount = 0, user = null, hasPermission = () => true }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ main: true, rebanho: true, gestao: true });

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'er482354';
  const perfil = obterPerfilDoUsuario(user) || 'Visualizador';

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
          isOpen: openSections[section.id] ?? true,
        })),
    [hasPermission, openSections]
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
        <div className="sidebar-logo-text">HERDON</div>
      </div>
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`sidebar sb ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: 'var(--color-primary-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(34,197,94,0.2)',
              }}
            >
              <span style={{ color: 'var(--color-primary)', fontWeight: 900, fontSize: '1rem' }}>H</span>
            </div>
            <div>
              <div className="sidebar-logo-text">HERDON</div>
              <div className="sidebar-logo-sub">Gestão Inteligente</div>
            </div>
          </div>
          <button type="button" className="sidebar-collapse-btn mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            {isMobileMenuOpen ? <X size={14} /> : <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />}
          </button>
        </div>

        <div className="sidebar-content sb-sec">
          {sections.map((section) => (
            <div key={section.id}>
              {section.title ? (
                <button
                  type="button"
                  className="sidebar-group-label nav-group-toggle"
                  onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                >
                  <span>{section.title}</span>
                  <ChevronDown size={14} className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`} />
                </button>
              ) : null}
              {section.isOpen && (
                <div className="nav-sublist" style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`sidebar-item nav subnav ${currentPage === item.id ? 'active on' : ''}`}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ItemIcon size={16} className="nav-icon" />
                        <span>{item.label}</span>
                        {item.id === 'dashboard' && alertCount > 0 ? <span className="sidebar-badge nav-badge">{alertCount}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-user sb-foot">
          <div className="avatar">{String(userName).slice(0, 2).toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name u-name">{userName}</div>
            <div className="sidebar-user-role u-role">{perfil}</div>
          </div>
          <ChevronDown size={14} color="var(--color-text-secondary)" />
        </div>
      </aside>
    </>
  );
}
