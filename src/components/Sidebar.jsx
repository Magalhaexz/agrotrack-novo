import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { obterLabelPerfil, obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';
import herdonLogo from '../assets/logo_app1.png';
import { getNavLabel, navSections } from '../navigation/navConfig';
import UserAvatar from './ui/UserAvatar';

export default function Sidebar({
  currentPage,
  onNavigate,
  alertCount = 0,
  user = null,
  hasPermission = () => true,
  onSignOut,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => {
    const initialOpenState = {};
    navSections.forEach((section) => {
      initialOpenState[section.id] = true;
    });
    return initialOpenState;
  });
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  const usuarioLogado = {
    id: user?.id || null,
    nome: user?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario',
    email: user?.email || '',
    perfil: user?.perfil || obterPerfilDoUsuario(user) || 'Visualizador',
    foto_url: user?.foto_url || user?.user_metadata?.avatar_url || null,
  };
  const perfilExibicao = obterLabelPerfil(usuarioLogado?.perfil);

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

  useEffect(() => {
    const fecharDropdown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownAberto(false);
      }
    };

    document.addEventListener('mousedown', fecharDropdown);
    return () => document.removeEventListener('mousedown', fecharDropdown);
  }, []);

  function handleLogout() {
    onSignOut?.();
    setDropdownAberto(false);
  }

  return (
    <>
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menu de navegacao"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <div className="mobile-topbar-brand">
          <div className="shell-logo-mark sidebar-logo-mark mobile-topbar-icon">
            <img src={herdonLogo} alt="HERDON" className="shell-logo-image" />
          </div>
          <div>
            <div className="sidebar-logo-text"><span className="sidebar-logo-text-h">H</span><span className="sidebar-logo-text-rest">ERDON</span></div>
            <div className="mobile-topbar-caption">{getNavLabel(currentPage)}</div>
          </div>
        </div>

        <div className="mobile-topbar-status">
          {alertCount > 0 ? <span className="mobile-topbar-badge">{alertCount}</span> : <span className="mobile-topbar-dot" />}
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
      ) : null}

      <aside className={`sidebar sb ${isMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Navegacao principal">
        <div className="sidebar-logo">
          <div className="sidebar-logo-content">
            <div className="shell-logo-mark sidebar-logo-mark">
              <img src={herdonLogo} alt="HERDON" className="shell-logo-image" />
            </div>
            <div className="sidebar-logo-copy">
              <div className="sidebar-logo-text"><span className="sidebar-logo-text-h">H</span><span className="sidebar-logo-text-rest">ERDON</span></div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-collapse-btn mobile-close-btn"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Fechar menu de navegacao"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-content sb-sec">
          {sections.map((section) => (
            <div key={section.id} className="sidebar-section">
              {section.title ? (
                <button
                  type="button"
                  className="sidebar-group-label nav-group-toggle"
                  onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                  aria-expanded={section.isOpen}
                  aria-controls={`nav-section-${section.id}`}
                >
                  <span>{section.title}</span>
                  <ChevronDown size={14} className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`} aria-hidden="true" />
                </button>
              ) : null}

              {section.isOpen ? (
                <div
                  id={`nav-section-${section.id}`}
                  className="nav-sublist"
                  style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}
                >
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPage === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`sidebar-item nav subnav ${isActive ? 'active on' : ''}`}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                      >
                        <ItemIcon size={16} className="nav-icon" aria-hidden="true" />
                        <div className="sidebar-item-copy">
                          <span className="sidebar-item-label">{item.label}</span>
                        </div>
                        {item.id === 'dashboard' && alertCount > 0 ? <span className="sidebar-badge nav-badge">{alertCount}</span> : null}
                        <span className="sidebar-item-glow" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="sidebar-user-wrap" ref={dropdownRef}>
          <div
            className="sidebar-user sb-foot"
            onClick={() => setDropdownAberto((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={dropdownAberto}
            aria-label="Menu do usuario"
          >
            <UserAvatar usuario={usuarioLogado} size={40} />
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{usuarioLogado?.nome}</p>
              <p className="sidebar-user-role">{perfilExibicao}</p>
            </div>
            <ChevronDown
              size={16}
              style={{
                color: 'var(--color-text-muted)',
                transform: dropdownAberto ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
              aria-hidden="true"
            />
          </div>

          {dropdownAberto ? (
            <div className="user-dropdown" role="menu">
              <div className="user-dropdown-header">
                <UserAvatar usuario={usuarioLogado} size={44} />
                <div>
                  <p className="user-dropdown-name">{usuarioLogado?.nome}</p>
                  <p className="user-dropdown-email">{usuarioLogado?.email}</p>
                  <span className="user-dropdown-badge">{perfilExibicao}</span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              <button
                className="user-dropdown-item"
                onClick={() => {
                  onNavigate('perfil');
                  setDropdownAberto(false);
                  setIsMobileMenuOpen(false);
                }}
                type="button"
                role="menuitem"
              >
                <User size={15} aria-hidden="true" />
                Meu Perfil
              </button>

              <button
                className="user-dropdown-item"
                onClick={() => {
                  onNavigate('configuracoes');
                  setDropdownAberto(false);
                  setIsMobileMenuOpen(false);
                }}
                type="button"
                role="menuitem"
              >
                <Settings size={15} aria-hidden="true" />
                Configuracoes
              </button>

              <div className="user-dropdown-divider" />

              <button className="user-dropdown-item logout" onClick={handleLogout} type="button" role="menuitem">
                <LogOut size={15} aria-hidden="true" />
                Sair da conta
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
