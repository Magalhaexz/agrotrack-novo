import { Activity, AlertTriangle, Bell, ChevronDown, Clock3, Loader2, LogOut, Menu, Package, Settings, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { obterLabelPerfil } from '../auth/perfis';
import { getNavLabel } from '../navigation/navConfig';
import Button from './ui/Button';
import UserAvatar from './ui/UserAvatar';

function useDropdown(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEsc(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return [ref, isOpen, setIsOpen];
}

function formatSyncTime(value) {
  if (!value) return 'Aguardando nuvem';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Sincronizado';
  }
}

function getCloudState(syncStatus) {
  const source = syncStatus?.dataSource || 'signed_out';
  const message = syncStatus?.dataError?.message || '';

  if (syncStatus?.isSyncing || source === 'syncing') {
    return {
      tone: 'syncing',
      icon: 'loading',
      label: 'Sincronizando',
      detail: 'Atualizando dados',
      title: 'Sincronizacao em andamento',
      disabled: true,
    };
  }

  if (source === 'supabase') {
    return {
      tone: 'online',
      icon: 'cloud',
      label: 'Nuvem ativa',
      detail: formatSyncTime(syncStatus?.lastSyncAt),
      title: 'Dados carregados do Supabase',
      disabled: false,
    };
  }

  if (source === 'offline_circuit_open' || source === 'fallback_error' || source === 'fallback_timeout') {
    return {
      tone: 'warning',
      icon: 'warning',
      label: 'Dados locais',
      detail: message || 'Nuvem instavel',
      title: message || 'Sincronizacao instavel. Dados locais disponiveis.',
      disabled: false,
    };
  }

  if (source === 'offline_disabled') {
    return {
      tone: 'muted',
      icon: 'local',
      label: 'Nuvem pausada',
      detail: 'Sincronizacao desativada',
      title: 'A sincronizacao com Supabase esta desativada neste navegador',
      disabled: false,
    };
  }

  return {
    tone: 'local',
    icon: 'local',
    label: 'Dados locais',
    detail: 'Clique para sincronizar',
    title: 'Sincronizacao manual disponivel',
    disabled: false,
  };
}

export default function AppHeader({
  farmName = 'Fazenda Santa Rita',
  usuarioLogado = null,
  notifications = 0,
  alerts = [],
  onResolveAlert,
  onSnoozeAlert,
  onAlertNavigate,
  onSignOut,
  onOpenMenu,
  onNavigateProfile,
  onNavigateSettings,
  onConfirmAction,
  tabAtiva = 'geral',
  onTabChange,
  fazendas = [],
  fazendaSelecionada = null,
  onSelectFazenda,
  syncStatus = null,
}) {
  const [userMenuRef, openUserMenu, setOpenUserMenu] = useDropdown(false);
  const [notifRef, openNotif, setOpenNotif] = useDropdown(false);
  const [farmsRef, openFarms, setOpenFarms] = useDropdown(false);
  const notifButtonRef = useRef(null);
  const [notifPosition, setNotifPosition] = useState({
    top: 0,
    left: 0,
    width: 430,
    maxHeight: 520,
    mobile: false,
  });

  async function handleLogout() {
    const confirmado = await onConfirmAction?.({
      title: 'Sair da conta',
      message: 'Deseja realmente sair da sua conta?',
      tone: 'danger',
    });

    if (confirmado) {
      onSignOut?.();
    }

    setOpenUserMenu(false);
  }

  function getAlertTone(alert) {
    const prioridade = String(alert?.priority || alert?.prioridade || '').toLowerCase();
    const texto = `${alert?.title || alert?.titulo || ''} ${alert?.description || alert?.mensagem || ''}`.toLowerCase();

    if (prioridade.includes('alta') || texto.includes('venc') || texto.includes('crit')) return 'danger';
    if (prioridade.includes('media') || texto.includes('atras') || texto.includes('alerta')) return 'warning';
    if (texto.includes('estoque') || texto.includes('pesagem')) return 'info';
    return 'success';
  }

  const nomeExibicao = usuarioLogado?.nome || 'Usuario';
  const perfilExibicao = obterLabelPerfil(usuarioLogado?.perfilLabel || usuarioLogado?.perfil);
  const cloudState = getCloudState(syncStatus);

  useEffect(() => {
    if (!openNotif) return undefined;

    const updateNotifPosition = () => {
      if (!notifButtonRef.current) return;

      const rect = notifButtonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth <= 900;
      const viewportPadding = 14;
      const dropdownWidth = isMobile
        ? Math.max(280, window.innerWidth - viewportPadding * 2)
        : Math.min(430, Math.max(320, window.innerWidth - 28));
      const nextLeft = isMobile
        ? viewportPadding
        : Math.min(
            Math.max(viewportPadding, rect.right - dropdownWidth),
            Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding)
          );
      const top = rect.bottom + 12;
      const maxHeight = Math.max(240, window.innerHeight - top - viewportPadding);

      setNotifPosition({
        top,
        left: nextLeft,
        width: dropdownWidth,
        maxHeight,
        mobile: isMobile,
      });
    };

    updateNotifPosition();

    window.addEventListener('resize', updateNotifPosition);
    window.addEventListener('scroll', updateNotifPosition, true);

    return () => {
      window.removeEventListener('resize', updateNotifPosition);
      window.removeEventListener('scroll', updateNotifPosition, true);
    };
  }, [openNotif]);

  return (
    <header className="header top-header">
      <button type="button" className="mobile-menu-inline sem-impressao" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu size={18} />
      </button>

      <div className="farm-selector-wrap" ref={farmsRef}>
        <button
          type="button"
          className="header-farm-selector"
          onClick={() => setOpenFarms((value) => !value)}
          aria-expanded={openFarms}
          aria-controls="farm-dropdown-menu"
        >
          <div className="header-farm-copy">
            <small>Fazenda ativa</small>
            <strong>{fazendaSelecionada?.nome || farmName}</strong>
          </div>
          <ChevronDown
            size={14}
            style={{ transform: openFarms ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </button>

        {openFarms && (
          <div id="farm-dropdown-menu" className="header-farm-dropdown">
            {fazendas.length === 0 ? (
              <div className="header-farm-item-empty">Nenhuma fazenda cadastrada.</div>
            ) : (
              fazendas.map((fazenda) => (
                <button
                  key={fazenda.id}
                  type="button"
                  className={`header-farm-item ${Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'active' : ''}`}
                  onClick={() => {
                    onSelectFazenda?.(fazenda);
                    setOpenFarms(false);
                  }}
                  aria-current={Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'page' : undefined}
                >
                  <span>{fazenda.nome}</span>
                  <small>{fazenda.cidade} / {fazenda.estado}</small>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <nav className="header-tabs header-tabs-shell">
        {['geral', 'estoque', 'alertas'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`header-tab ${tabAtiva === tab ? 'active' : ''}`}
            onClick={() => onTabChange?.(tab)}
            aria-selected={tabAtiva === tab}
            role="tab"
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <div className="top-header-actions">
        <div className={`header-sync-chip header-sync-chip--${cloudState.tone}`} title={cloudState.title}>
          <span className="header-sync-icon" aria-hidden="true">
            {cloudState.icon === 'loading' ? (
              <Loader2 size={15} className="ui-spin" />
            ) : cloudState.icon === 'warning' ? (
              <AlertTriangle size={15} />
            ) : cloudState.icon === 'local' ? (
              <Package size={15} />
            ) : (
              <Activity size={15} />
            )}
          </span>
          <span className="header-sync-copy">
            <strong>{cloudState.label}</strong>
            <small>{cloudState.detail}</small>
          </span>
          <button
            type="button"
            className="header-sync-refresh"
            onClick={syncStatus?.onSyncNow}
            disabled={cloudState.disabled}
            aria-label="Sincronizar agora"
          >
            <Clock3 size={13} className={cloudState.disabled ? 'ui-spin' : ''} />
          </button>
        </div>

        <div className="user-menu-wrap" ref={notifRef}>
          <button
            type="button"
            className="header-notification-btn notif-btn"
            ref={notifButtonRef}
            aria-label={`Notificacoes: ${notifications} ${notifications === 1 ? 'alerta' : 'alertas'} pendentes`}
            onClick={() => setOpenNotif((value) => !value)}
            aria-expanded={openNotif}
            aria-controls="notification-dropdown-menu"
          >
            <Bell size={16} />
            {notifications > 0 && <span className="notification-badge notif-badge">{notifications}</span>}
          </button>
        </div>

        <div className="user-menu-wrap" ref={userMenuRef}>
          <button
            type="button"
            className="header-user-btn user-menu-btn"
            onClick={() => setOpenUserMenu((value) => !value)}
            aria-expanded={openUserMenu}
            aria-controls="user-dropdown-menu"
          >
            <UserAvatar usuario={usuarioLogado} size={32} />
            <div className="header-user-copy">
              <span className="header-user-name">{nomeExibicao.split(' ')[0]}</span>
              <small>{perfilExibicao}</small>
            </div>
            <ChevronDown
              size={14}
              style={{ transform: openUserMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            />
          </button>

          {openUserMenu && (
            <div id="user-dropdown-menu" className="header-user-dropdown">
              <div className="user-dropdown-header">
                <UserAvatar usuario={usuarioLogado} size={44} />
                <div>
                  <p className="user-dropdown-name">{nomeExibicao}</p>
                  <p className="user-dropdown-email">{usuarioLogado?.email || 'sem-email@herdon.app'}</p>
                  <span className="user-dropdown-badge">{perfilExibicao}</span>
                </div>
              </div>
              <div className="user-dropdown-divider" />
              <button type="button" className="user-dropdown-item" onClick={() => { onNavigateProfile?.(); setOpenUserMenu(false); }}>
                <User size={15} />
                Meu Perfil
              </button>
              <button type="button" className="user-dropdown-item" onClick={() => { onNavigateSettings?.(); setOpenUserMenu(false); }}>
                <Settings size={15} />
                Configuracoes
              </button>
              <div className="user-dropdown-divider" />
              <button type="button" className="user-dropdown-item logout" onClick={handleLogout}>
                <LogOut size={15} />
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>

      {openNotif
        ? createPortal(
            <>
              <button
                type="button"
                className="notif-overlay"
                aria-label="Fechar notificacoes"
                onClick={() => setOpenNotif(false)}
              />
              <div
                id="notification-dropdown-menu"
                className={`notif-dropdown ${notifPosition.mobile ? 'notif-dropdown--mobile' : ''}`}
                style={{
                  position: 'fixed',
                  top: `${notifPosition.top}px`,
                  left: `${notifPosition.left}px`,
                  width: `${notifPosition.width}px`,
                  maxHeight: `${notifPosition.maxHeight}px`,
                }}
              >
                <div className="notif-panel-header">
                  <div>
                    <span className="notif-panel-kicker">Central de alertas</span>
                    <strong>{notifications > 0 ? `${notifications} pendentes` : 'Tudo em dia'}</strong>
                    <small>Alertas operacionais, sanitarios, estoque e lembretes do HERDON.</small>
                  </div>
                  <span className="notif-panel-pill">{notifications}</span>
                </div>

                {alerts.length === 0 ? (
                  <p className="notif-empty">Sem alertas ativos no momento.</p>
                ) : (
                  <div className="notif-list">
                    {alerts.map((alert) => {
                      const tone = getAlertTone(alert);
                      const destino = getNavLabel(alert?.route || 'dashboard');

                      return (
                        <div key={alert.ackKey || alert.id} className={`notif-item notif-item--${tone}`}>
                          <div className="notif-item-head">
                            <div className={`notif-item-dot notif-item-dot--${tone}`} aria-hidden="true" />
                            <div className="notif-item-copy">
                              <strong>{alert.title || alert.titulo}</strong>
                              <span className="notif-item-meta">{destino}</span>
                            </div>
                            <span className={`notif-item-tag notif-item-tag--${tone}`}>
                              {tone === 'danger' ? 'Critico' : tone === 'warning' ? 'Atencao' : tone === 'info' ? 'Monitorar' : 'Operacional'}
                            </span>
                          </div>
                          <small>{alert.description || alert.mensagem}</small>
                          <div className="notif-actions">
                            <Button size="sm" variant="outline" onClick={() => { onResolveAlert?.(alert); setOpenNotif(false); }}>Resolver</Button>
                            <Button size="sm" variant="ghost" icon={<Clock3 size={12} />} onClick={() => { onSnoozeAlert?.(alert); setOpenNotif(false); }}>Adiar</Button>
                            <Button size="sm" variant="ghost" onClick={() => { onAlertNavigate?.(alert); setOpenNotif(false); }}>Abrir</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>,
            document.body
          )
        : null}
    </header>
  );
}
