import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, LogOut, Menu, Settings, User, X } from 'lucide-react';
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
  isCollapsed = false,
  onToggleCollapse = null,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  const usuarioLogado = {
    id: user?.id || null,
    nome: user?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário',
    email: user?.email || '',
    perfil: user?.perfil || obterPerfilDoUsuario(user) || 'Visualizador',
    foto_url: user?.foto_url || user?.user_metadata?.avatar_url || null,
  };
  const perfilExibicao = obterLabelPerfil(usuarioLogado?.perfil);
  const isDesktopCollapsed = Boolean(isCollapsed);

  // Seções sempre abertas (fiel ao redesign — só a sidebar inteira colapsa,
  // 272↔84px; não existe mais o recolher por seção individual).
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
        .filter((section) => section.items.length > 0),
    [hasPermission]
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
          onClick={() => {
            setDropdownAberto(false);
            setIsMobileMenuOpen(true);
          }}
          aria-label="Abrir menu de navegação"
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        <div className="mobile-topbar-brand">
          <div className="shell-logo-mark sidebar-logo-mark mobile-topbar-icon">
            <img src={herdonLogo} alt="HERDON" className="shell-logo-image" />
          </div>
          <div>
            <div className="sidebar-logo-text">
              <span className="sidebar-brand-word">
                <span className="sidebar-brand-initial">H</span>
                <span className="sidebar-brand-rest">ERDON</span>
              </span>
            </div>
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

      <aside
        className={`sidebar sb ${isMobileMenuOpen ? 'mobile-open' : ''} ${isDesktopCollapsed ? 'is-collapsed sidebar--collapsed' : ''}`}
        aria-label="Navegação principal"
      >
        <div className="sidebar-logo sidebar-header">
          <div className="sidebar-logo-content sidebar-brand">
            <div className="shell-logo-mark sidebar-logo-mark">
              <img src={herdonLogo} alt="HERDON" className="shell-logo-image" />
            </div>
            <div className="sidebar-logo-copy">
              <div className="sidebar-logo-text sidebar-brand-text">
                <span className="sidebar-brand-word">
                  <span className="sidebar-brand-initial">H</span>
                  <span className="sidebar-brand-rest">ERDON</span>
                </span>
              </div>
            </div>
          </div>

          <div className="sidebar-logo-actions">
            <button
              type="button"
              className="sidebar-collapse-btn desktop-collapse-btn sidebar-toggle sidebar-desktop-toggle"
              onClick={() => {
                setDropdownAberto(false);
                onToggleCollapse?.();
              }}
              aria-label={isDesktopCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              aria-pressed={isDesktopCollapsed}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                style={{ transform: isDesktopCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
              />
            </button>

            <button
              type="button"
              className="sidebar-collapse-btn mobile-close-btn sidebar-mobile-close"
              onClick={() => {
                setDropdownAberto(false);
                setIsMobileMenuOpen(false);
              }}
              aria-label="Fechar menu de navegação"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="sidebar-content sidebar-nav sb-sec">
          {sections.map((section) => (
            <div key={section.id} className="sidebar-section">
              {!isDesktopCollapsed && section.title ? (
                <div className="sidebar-group-label sidebar-section-title">
                  <div className="sidebar-group-copy">
                    <span>{section.title}</span>
                  </div>
                </div>
              ) : null}

              <div
                className={`nav-sublist ${isDesktopCollapsed ? 'is-collapsed' : ''}`}
                style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}
              >
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-item sidebar-link nav subnav ${isActive ? 'active on' : ''}`}
                      onClick={() => {
                        onNavigate(item.id);
                        setIsMobileMenuOpen(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                      title={item.label}
                    >
                      <ItemIcon size={16} className="nav-icon" aria-hidden="true" />
                      <div className="sidebar-item-copy">
                        <span className="sidebar-item-label sidebar-link-label">{item.label}</span>
                      </div>
                      {item.id === 'dashboard' && alertCount > 0 ? <span className="sidebar-badge nav-badge">{alertCount}</span> : null}
                      <span className="sidebar-item-glow" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-user-wrap" ref={dropdownRef}>
          <div
            className="sidebar-user sidebar-user-card sb-foot"
            onClick={() => setDropdownAberto((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={dropdownAberto}
            aria-label="Menu do usuário"
            title={usuarioLogado?.nome}
          >
            <UserAvatar usuario={usuarioLogado} size={40} />
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{usuarioLogado?.nome}</p>
              <p className="sidebar-user-role">{perfilExibicao}</p>
            </div>
            <ChevronDown
              className="sidebar-user-caret"
              size={16}
              style={{
                color: 'var(--color-text-muted)',
                transform: dropdownAberto ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
              aria-hidden="true"
            />
          </div>

          {dropdownAberto && !isDesktopCollapsed && !isMobileMenuOpen ? (
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
                Configurações
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
