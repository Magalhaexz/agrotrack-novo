import { Bell, ChevronDown, LogOut, Menu, MoreHorizontal, Settings, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { obterLabelPerfil } from '../auth/perfis';
import { getNavLabel } from '../navigation/navConfig';
import { TODAS_FAZENDAS } from '../domain/escopoFazenda';
import UserAvatar from './ui/UserAvatar';
import ConnectionIndicator from './ConnectionIndicator';

const ALERTAS_RESOLVIDOS_STORAGE_KEY = 'herdon-alertas-resolvidos';
const ALERTAS_ADIADOS_STORAGE_KEY = 'herdon-alertas-adiados';

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

export default function AppHeader({
  currentPage = 'dashboard',
  farmName = '',
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
  hideSyncTechnicalStatus = false,
  getAlertAckKey = (alert) => alert?.ackKey || alert?.id || 'alerta-sem-chave',
  alertDebugState = null,
  onOpenSincronizacao = null,
}) {
  const [userMenuRef, openUserMenu, setOpenUserMenu] = useDropdown(false);
  const [openNotif, setOpenNotif] = useState(false);
  const notifRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [farmsRef, openFarms, setOpenFarms] = useDropdown(false);
  const [mobilePanelRef, openMobilePanel, setOpenMobilePanel] = useDropdown(false);
  const notifButtonRef = useRef(null);
  const [notifPosition, setNotifPosition] = useState({
    top: 0,
    left: 0,
    width: 430,
    maxHeight: 520,
    mobile: false,
  });
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState(() => new Set());
  const lastHandledRef = useRef({ signature: '', timestamp: 0 });

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      if (import.meta.env.DEV) {
        console.debug('[HERDON_ALERT_LOCALSTORAGE]', { key, value });
      }
    } catch {
      // storage indisponivel
    }
  }

  function normalizeResolved(entries = []) {
    return (Array.isArray(entries) ? entries : [])
      .map((item) => (typeof item === 'string' ? item : item?.chave || item?.ackKey || item?.id || null))
      .filter(Boolean)
      .map((item) => String(item));
  }

  function normalizeSnoozed(entries = []) {
    return (Array.isArray(entries) ? entries : [])
      .map((item) => {
        if (!item || typeof item === 'string') return null;
        const chave = item?.chave || item?.ackKey || item?.id || null;
        const ate = item?.ate || item?.snoozeUntil || null;
        if (!chave || !ate) return null;
        return { chave: String(chave), ate: String(ate), snoozeUntil: String(item?.snoozeUntil || ate) };
      })
      .filter(Boolean);
  }

  function parseSnoozeDate(days = 1) {
    const date = new Date();
    date.setDate(date.getDate() + Number(days || 1));
    return date.toISOString().slice(0, 10);
  }

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

  const nomeExibicao = usuarioLogado?.nome || 'Usuário';
  const perfilExibicao = obterLabelPerfil(usuarioLogado?.perfilLabel || usuarioLogado?.perfil);
  const mobilePageTitle = getNavLabel(currentPage);
  const resolvedAlertKeys = alertDebugState?.resolvedAlertKeys || new Set();
  const snoozedAlerts = Array.isArray(alertDebugState?.snoozedAlerts) ? alertDebugState.snoozedAlerts : [];
  const renderedAlerts = alerts.filter((alert) => !dismissedAlertKeys.has(getAlertAckKey(alert)));

  function routeFromAlert(alert, routeFromButton = null) {
    return routeFromButton || alert?.route || alert?.rota || alert?.acao?.rota || alert?.pagina || null;
  }

  function shouldIgnoreDuplicate(action, ackKey) {
    const signature = `${action}:${ackKey}`;
    const now = Date.now();
    if (
      lastHandledRef.current.signature === signature
      && now - lastHandledRef.current.timestamp < 300
    ) {
      return true;
    }
    lastHandledRef.current = { signature, timestamp: now };
    return false;
  }

  function markDismissed(ackKey) {
    setDismissedAlertKeys((previous) => {
      const next = new Set(previous);
      next.add(String(ackKey));
      return next;
    });
  }

  function handleNotificationAction(action, alert, routeHint = null) {
    const ackKey = getAlertAckKey(alert);
    if (!ackKey || shouldIgnoreDuplicate(action, ackKey)) return;
    const route = routeFromAlert(alert, routeHint);

    if (import.meta.env.DEV) {
      console.debug('[HERDON_ALERT_CLICK]', { action, ackKey, route });
    }

    if (action === 'resolve') {
      const current = normalizeResolved(readJsonStorage(ALERTAS_RESOLVIDOS_STORAGE_KEY, []));
      writeJsonStorage(ALERTAS_RESOLVIDOS_STORAGE_KEY, Array.from(new Set([...current, ackKey])));
      markDismissed(ackKey);
      onResolveAlert?.(alert);
      setOpenNotif(false);
      return;
    }

    if (action === 'snooze') {
      const snoozeUntil = parseSnoozeDate(1);
      const payload = { chave: ackKey, ate: snoozeUntil, snoozeUntil };
      const current = normalizeSnoozed(readJsonStorage(ALERTAS_ADIADOS_STORAGE_KEY, []))
        .filter((item) => item?.chave !== ackKey);
      writeJsonStorage(ALERTAS_ADIADOS_STORAGE_KEY, [...current, payload]);
      markDismissed(ackKey);
      onSnoozeAlert?.(alert, '1');
      setOpenNotif(false);
      return;
    }

    if (action === 'open') {
      if (import.meta.env.DEV) {
        console.debug('[HERDON_ALERT_OPEN]', { ackKey, route });
      }
      if (route) onAlertNavigate?.({ ...alert, route });
      else onAlertNavigate?.(alert);
      setOpenNotif(false);
    }
  }

  function handleDelegatedNotificationClick(event) {
    const target = event?.target;
    if (!(target instanceof Element)) return;
    const actionNode = target.closest('[data-alert-action]');
    if (!actionNode) return;

    const action = actionNode.getAttribute('data-alert-action');
    const ackKey = actionNode.getAttribute('data-alert-key');
    const route = actionNode.getAttribute('data-alert-route') || null;
    if (!action || !ackKey) return;

    event.preventDefault();
    event.stopPropagation();

    if (import.meta.env.DEV) {
      console.debug('[HERDON_ALERT_CLICK_CAPTURE]', { action, ackKey, route });
    }

    const alert = renderedAlerts.find((item) => getAlertAckKey(item) === ackKey);
    if (!alert) return;
    handleNotificationAction(action, alert, route);
  }

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

  useEffect(() => {
    if (!openNotif) return undefined;

    function handleOutside(event) {
      const target = event?.target;
      if (!(target instanceof Node)) return;
      if (notifRef.current?.contains(target)) return;
      if (notifPanelRef.current?.contains(target)) return;
      setOpenNotif(false);
    }

    function handleEsc(event) {
      if (event.key === 'Escape') {
        setOpenNotif(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openNotif]);

  return (
    <header className="header top-header">
      <div className="mobile-header-core sem-impressao">
        <button type="button" className="mobile-header-menu-btn" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <div className="mobile-header-brand">
          <strong>HERDON</strong>
          <span>{mobilePageTitle}</span>
        </div>
      </div>

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
            <strong>{fazendaSelecionada?.nome || farmName || 'Nenhuma fazenda selecionada'}</strong>
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
              <>
                {fazendas.length > 1 ? (
                  <button
                    type="button"
                    className={`header-farm-item header-farm-item--todas ${fazendaSelecionada?.todas ? 'active' : ''}`}
                    onClick={() => {
                      onSelectFazenda?.(TODAS_FAZENDAS);
                      setOpenFarms(false);
                    }}
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
                    onClick={() => {
                      onSelectFazenda?.(fazenda);
                      setOpenFarms(false);
                    }}
                    aria-current={!fazendaSelecionada?.todas && Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'page' : undefined}
                  >
                    <span>{fazenda.nome}</span>
                    <small>{fazenda.cidade} / {fazenda.estado}</small>
                  </button>
                ))}
              </>
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
        {(!syncStatus?.offlineOnline || syncStatus?.offlinePendentes > 0) ? (
          <button
            type="button"
            className="connection-indicator-btn"
            onClick={() => onOpenSincronizacao?.()}
          >
            <ConnectionIndicator online={syncStatus?.offlineOnline !== false} pendentes={syncStatus?.offlinePendentes || 0} />
          </button>
        ) : (
          <ConnectionIndicator online={syncStatus?.offlineOnline !== false} pendentes={syncStatus?.offlinePendentes || 0} />
        )}

        {!hideSyncTechnicalStatus ? (
          <button
            type="button"
            className="header-notification-btn"
            onClick={() => syncStatus?.onSyncNow?.()}
            aria-label="Sincronizar dados"
            title="Sincronizar dados"
          >
            <MoreHorizontal size={16} />
          </button>
        ) : null}

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

        <div className="user-menu-wrap mobile-utility-wrap" ref={mobilePanelRef}>
          <button
            type="button"
            className="header-notification-btn mobile-utility-trigger"
            onClick={() => setOpenMobilePanel((value) => !value)}
            aria-expanded={openMobilePanel}
            aria-controls="mobile-header-panel"
            aria-label="Abrir controles do cabecalho"
          >
            <MoreHorizontal size={16} />
          </button>

          {openMobilePanel
            ? createPortal(
              <>
                <button
                  type="button"
                  className="mobile-header-panel-overlay"
                  aria-label="Fechar painel"
                  onClick={() => setOpenMobilePanel(false)}
                />
                <div id="mobile-header-panel" className="mobile-header-panel">
                  <section className="mobile-header-panel-section">
                    <p className="mobile-header-panel-title">Fazenda ativa</p>
                    <div className="mobile-header-panel-list">
                      {fazendas.length === 0 ? (
                        <div className="header-farm-item-empty">Nenhuma fazenda cadastrada.</div>
                      ) : (
                        <>
                          {fazendas.length > 1 ? (
                            <button
                              type="button"
                              className={`header-farm-item header-farm-item--todas ${fazendaSelecionada?.todas ? 'active' : ''}`}
                              onClick={() => {
                                onSelectFazenda?.(TODAS_FAZENDAS);
                                setOpenMobilePanel(false);
                              }}
                            >
                              <span>Todas as fazendas</span>
                              <small>Visão consolidada</small>
                            </button>
                          ) : null}
                          {fazendas.map((fazenda) => (
                            <button
                              key={`mobile-farm-${fazenda.id}`}
                              type="button"
                              className={`header-farm-item ${!fazendaSelecionada?.todas && Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'active' : ''}`}
                              onClick={() => {
                                onSelectFazenda?.(fazenda);
                                setOpenMobilePanel(false);
                              }}
                            >
                              <span>{fazenda.nome}</span>
                              <small>{fazenda.cidade} / {fazenda.estado}</small>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </section>

                  <section className="mobile-header-panel-section">
                    <p className="mobile-header-panel-title">Visao</p>
                    <div className="mobile-header-tabs">
                      {['geral', 'estoque', 'alertas'].map((tab) => (
                        <button
                          key={`mobile-tab-${tab}`}
                          type="button"
                          className={`header-tab ${tabAtiva === tab ? 'active' : ''}`}
                          onClick={() => {
                            onTabChange?.(tab);
                            setOpenMobilePanel(false);
                          }}
                        >
                          {tab[0].toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="mobile-header-panel-section">
                    <p className="mobile-header-panel-title">Conta</p>
                    <div className="mobile-header-account-actions">
                      <button type="button" className="user-dropdown-item" onClick={() => { onNavigateProfile?.(); setOpenMobilePanel(false); }}>
                        <User size={15} />
                        Meu Perfil
                      </button>
                      <button type="button" className="user-dropdown-item" onClick={() => { onNavigateSettings?.(); setOpenMobilePanel(false); }}>
                        <Settings size={15} />
                        Configuracoes
                      </button>
                      <button type="button" className="user-dropdown-item logout" onClick={handleLogout}>
                        <LogOut size={15} />
                        Sair da conta
                      </button>
                    </div>
                  </section>
                </div>
              </>,
              document.body
            )
            : null}
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
                                Configurações
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
              aria-label="Fechar notificações"
              onClick={() => setOpenNotif(false)}
            />
            <div
              id="notification-dropdown-menu"
              ref={notifPanelRef}
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
                  <small>Alertas operacionais, sanitários, estoque e lembretes do HERDON.</small>
                </div>
                <span className="notif-panel-pill">{notifications}</span>
              </div>


              {renderedAlerts.length === 0 ? (
                <p className="notif-empty">Sem alertas ativos no momento.</p>
              ) : (
                <div
                  className="notif-list"
                  onClickCapture={handleDelegatedNotificationClick}
                  onPointerDownCapture={handleDelegatedNotificationClick}
                >
                  {renderedAlerts.map((alert) => {
                    const tone = getAlertTone(alert);
                    const destino = getNavLabel(alert?.route || 'dashboard');
                    const ackKey = getAlertAckKey(alert);
                    const resolvedRoute = routeFromAlert(alert);
                    const hasRoute = Boolean(resolvedRoute);
                    const isResolved = resolvedAlertKeys.has(ackKey);
                    const isSnoozed = snoozedAlerts.some((item) => item?.chave === ackKey);

                    return (
                      <div key={ackKey} className={`notif-item notif-item--${tone}`}>
                        <div className="notif-item-head">
                          <div className={`notif-item-dot notif-item-dot--${tone}`} aria-hidden="true" />
                          <div className="notif-item-copy">
                            <strong>{alert.title || alert.titulo}</strong>
                            <span className="notif-item-meta">{destino}</span>
                          </div>
                          <span className={`notif-item-tag notif-item-tag--${tone}`}>
                            {tone === 'danger' ? 'Crítico' : tone === 'warning' ? 'Atenção' : tone === 'info' ? 'Monitorar' : 'Operacional'}
                          </span>
                        </div>
                        <small>{alert.description || alert.mensagem}</small>
                        {import.meta.env.DEV ? (
                          <small className="notif-debug-line">ackKey: {ackKey} | resolved: {isResolved ? 'sim' : 'não'} | adiado: {isSnoozed ? 'sim' : 'não'} | route found: {hasRoute ? 'sim' : 'não'}</small>
                        ) : null}
                        <div className="notif-actions">
                          <button
                            type="button"
                            className="notif-action-btn notif-action-btn--resolve"
                            data-alert-action="resolve"
                            data-alert-key={ackKey}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleNotificationAction('resolve', alert);
                            }}
                          >
                            Resolver
                          </button>
                          <button
                            type="button"
                            className="notif-action-btn notif-action-btn--snooze"
                            data-alert-action="snooze"
                            data-alert-key={ackKey}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleNotificationAction('snooze', alert);
                            }}
                          >
                            Adiar
                          </button>
                          <button
                            type="button"
                            className="notif-action-btn notif-action-btn--open"
                            data-alert-action="open"
                            data-alert-key={ackKey}
                            data-alert-route={resolvedRoute || ''}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleNotificationAction('open', alert, resolvedRoute);
                            }}
                          >
                            Abrir
                          </button>
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


