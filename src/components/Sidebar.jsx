import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, LogOut, Menu, X } from 'lucide-react';
import { obterLabelPerfil, obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';
import { TODAS_FAZENDAS } from '../domain/escopoFazenda';
import herdonLogo from '../assets/logo_app1.png';
import { accountNavItems, getNavLabel, groupIdByPageId, navGroups } from '../navigation/navConfig';
import UserAvatar from './ui/UserAvatar';

function useOutsideClose(active, onClose) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    function handlePointer(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose();
      }
    }

    function handleKey(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [active, onClose]);

  return ref;
}

// Flyout usado quando a sidebar está recolhida (84px): grupo e seletor de
// fazenda abrem um popover ao lado do ícone via portal, em vez de expandir
// a sidebar inteira. Mesmo padrão de posicionamento por getBoundingClientRect
// já usado no painel de notificações de AppHeader.jsx.
function useFlyoutPosition(open, triggerRef) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return undefined;

    const update = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({ top: rect.top, left: rect.right + 10 });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, triggerRef]);

  return position;
}

function FarmSelector({ collapsed, fazendas, fazendaSelecionada, onSelectFazenda, farmName }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const wrapRef = useOutsideClose(open, () => setOpen(false));
  const flyoutPosition = useFlyoutPosition(collapsed && open, triggerRef);

  const nomeAtivo = fazendaSelecionada?.todas
    ? 'Todas as fazendas'
    : fazendaSelecionada?.nome || farmName || 'Nenhuma fazenda selecionada';

  function selecionar(fazenda) {
    onSelectFazenda?.(fazenda);
    setOpen(false);
  }

  const lista = (
    <>
      {fazendas.length === 0 ? (
        <div className="header-farm-item-empty">Nenhuma fazenda cadastrada.</div>
      ) : (
        <>
          {fazendas.length > 1 ? (
            <button
              type="button"
              className={`header-farm-item header-farm-item--todas ${fazendaSelecionada?.todas ? 'active' : ''}`}
              onClick={() => selecionar(TODAS_FAZENDAS)}
              aria-current={fazendaSelecionada?.todas ? 'page' : undefined}
            >
              <span>Todas as fazendas</span>
              <small>Visão consolidada</small>
            </button>
          ) : null}
          {fazendas.map((fazenda) => (
            <button
              key={fazenda.id}
              type="button"
              className={`header-farm-item ${!fazendaSelecionada?.todas && Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'active' : ''}`}
              onClick={() => selecionar(fazenda)}
              aria-current={!fazendaSelecionada?.todas && Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'page' : undefined}
            >
              <span>{fazenda.nome}</span>
              <small>{fazenda.cidade} / {fazenda.estado}</small>
            </button>
          ))}
        </>
      )}
    </>
  );

  return (
    <div className={`sidebar-farm-selector-wrap ${collapsed ? 'is-collapsed' : ''}`} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="sidebar-farm-selector"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Fazenda ativa: ${nomeAtivo}`}
        title={collapsed ? nomeAtivo : undefined}
      >
        {fazendaSelecionada?.todas ? (
          <span className="sidebar-farm-consolidada" aria-hidden="true">Σ</span>
        ) : (
          <span className="sidebar-farm-dot" aria-hidden="true" />
        )}
        {!collapsed ? (
          <span className="sidebar-farm-copy">
            <small>Fazenda ativa</small>
            <strong>{nomeAtivo}</strong>
          </span>
        ) : null}
        {!collapsed ? (
          <ChevronDown
            size={14}
            aria-hidden="true"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
          />
        ) : null}
      </button>

      {open && !collapsed ? (
        <div className="header-farm-dropdown sidebar-farm-dropdown" role="menu">
          {lista}
        </div>
      ) : null}

      {open && collapsed
        ? createPortal(
          <div
            className="header-farm-dropdown sidebar-farm-dropdown sidebar-flyout"
            role="menu"
            style={{ position: 'fixed', top: flyoutPosition.top, left: flyoutPosition.left }}
          >
            <p className="sidebar-flyout-title">Fazenda ativa</p>
            {lista}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

function NavGroup({ group, currentPage, onNavigate, isDesktopCollapsed, isOpen, onToggle, closeMobile }) {
  const triggerRef = useRef(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const flyoutRef = useOutsideClose(flyoutOpen, () => setFlyoutOpen(false));
  const flyoutPosition = useFlyoutPosition(isDesktopCollapsed && flyoutOpen, triggerRef);
  const GroupIcon = group.icon;
  const isActiveGroup = groupIdByPageId[currentPage] === group.id;
  const sublistId = `sidebar-group-${group.id}`;

  function handleHeaderClick() {
    if (isDesktopCollapsed) {
      setFlyoutOpen((value) => !value);
      return;
    }
    onToggle(group.id);
  }

  function handleItemClick(itemId) {
    onNavigate(itemId);
    setFlyoutOpen(false);
    closeMobile();
  }

  const itemsList = (onItemClick) => group.items.map((item) => {
    const ItemIcon = item.icon;
    const isActive = currentPage === item.id;
    return (
      <button
        key={item.id}
        type="button"
        className={`sidebar-item sidebar-link nav subnav ${isActive ? 'active on' : ''}`}
        onClick={() => onItemClick(item.id)}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
      >
        <ItemIcon size={16} className="nav-icon" aria-hidden="true" />
        <div className="sidebar-item-copy">
          <span className="sidebar-item-label sidebar-link-label">{item.label}</span>
        </div>
        <span className="sidebar-item-glow" aria-hidden="true" />
      </button>
    );
  });

  return (
    <div className={`sidebar-section ${isActiveGroup ? 'is-active-group' : ''}`} ref={isDesktopCollapsed ? flyoutRef : null}>
      <button
        type="button"
        ref={triggerRef}
        className={`sidebar-group-toggle nav-group-toggle ${isActiveGroup ? 'is-active-group' : ''}`}
        onClick={handleHeaderClick}
        aria-expanded={isDesktopCollapsed ? flyoutOpen : isOpen}
        aria-controls={sublistId}
        title={isDesktopCollapsed ? group.title : undefined}
        aria-label={group.title}
      >
        <GroupIcon size={18} className="nav-icon sidebar-group-icon" aria-hidden="true" />
        {!isDesktopCollapsed ? (
          <>
            <span className="sidebar-group-title-text">{group.title}</span>
            <ChevronRight
              size={14}
              className="nav-group-arrow"
              aria-hidden="true"
              style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
            />
          </>
        ) : null}
      </button>

      {!isDesktopCollapsed ? (
        <div id={sublistId} className={`nav-sublist sidebar-group-body ${isOpen ? 'is-open' : 'is-closed'}`}>
          {itemsList(handleItemClick)}
        </div>
      ) : null}

      {isDesktopCollapsed && flyoutOpen
        ? createPortal(
          <div
            id={sublistId}
            className="nav-sublist sidebar-flyout"
            role="menu"
            style={{ position: 'fixed', top: flyoutPosition.top, left: flyoutPosition.left }}
          >
            <p className="sidebar-flyout-title">{group.title}</p>
            {itemsList(handleItemClick)}
          </div>,
          document.body
        )
        : null}
    </div>
  );
}

export default function Sidebar({
  currentPage,
  onNavigate,
  alertCount = 0,
  user = null,
  hasPermission = () => true,
  onSignOut,
  isCollapsed = false,
  onToggleCollapse = null,
  fazendas = [],
  fazendaSelecionada = null,
  onSelectFazenda = null,
  farmName = '',
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(() => groupIdByPageId[currentPage] || null);
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

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const permissao = permissoesPorPagina[item.id];
            return !permissao || hasPermission(permissao);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [hasPermission]
  );

  // Ao navegar para uma página interna, o grupo correspondente abre
  // automaticamente. Ajuste de estado durante a renderização (não em
  // efeito) seguindo o padrão recomendado para "resetar/ajustar estado
  // quando uma prop muda" — evita o cascading render de um setState em
  // useEffect.
  const [pageParaGrupoAberto, setPageParaGrupoAberto] = useState(currentPage);
  if (currentPage !== pageParaGrupoAberto) {
    setPageParaGrupoAberto(currentPage);
    const groupId = groupIdByPageId[currentPage];
    if (groupId) {
      setOpenGroupId(groupId);
    }
  }

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

  function closeMobile() {
    setIsMobileMenuOpen(false);
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

        {onSelectFazenda ? (
          <FarmSelector
            collapsed={isDesktopCollapsed}
            fazendas={fazendas}
            fazendaSelecionada={fazendaSelecionada}
            onSelectFazenda={onSelectFazenda}
            farmName={farmName}
          />
        ) : null}

        <div className="sidebar-content sidebar-nav sb-sec">
          {visibleGroups.map((group) => {
            if (group.standalone) {
              const item = group.items[0];
              const ItemIcon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <div key={group.id} className="sidebar-section sidebar-section--standalone">
                  <div className="nav-sublist" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                    <button
                      type="button"
                      className={`sidebar-item sidebar-link nav subnav ${isActive ? 'active on' : ''}`}
                      onClick={() => {
                        onNavigate(item.id);
                        closeMobile();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                      title={item.label}
                    >
                      <ItemIcon size={18} className="nav-icon" aria-hidden="true" />
                      <div className="sidebar-item-copy">
                        <span className="sidebar-item-label sidebar-link-label">{item.label}</span>
                      </div>
                      {alertCount > 0 ? <span className="sidebar-badge nav-badge">{alertCount}</span> : null}
                      <span className="sidebar-item-glow" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <NavGroup
                key={group.id}
                group={group}
                currentPage={currentPage}
                onNavigate={onNavigate}
                isDesktopCollapsed={isDesktopCollapsed}
                isOpen={openGroupId === group.id}
                onToggle={(groupId) => setOpenGroupId((prev) => (prev === groupId ? null : groupId))}
                closeMobile={closeMobile}
              />
            );
          })}
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

          {dropdownAberto && !isMobileMenuOpen ? (
            <div className={`user-dropdown ${isDesktopCollapsed ? 'sidebar-flyout user-dropdown--collapsed' : ''}`} role="menu">
              <div className="user-dropdown-header">
                <UserAvatar usuario={usuarioLogado} size={44} />
                <div>
                  <p className="user-dropdown-name">{usuarioLogado?.nome}</p>
                  <p className="user-dropdown-email">{usuarioLogado?.email}</p>
                  <span className="user-dropdown-badge">{perfilExibicao}</span>
                </div>
              </div>

              <div className="user-dropdown-divider" />

              {accountNavItems.filter((item) => {
                const permissao = permissoesPorPagina[item.id];
                return !permissao || hasPermission(permissao);
              }).map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    className="user-dropdown-item"
                    onClick={() => {
                      onNavigate(item.id);
                      setDropdownAberto(false);
                      setIsMobileMenuOpen(false);
                    }}
                    type="button"
                    role="menuitem"
                  >
                    <ItemIcon size={15} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}

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
