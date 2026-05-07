import { Activity, AlertTriangle, Bell, ChevronDown, Loader2, LogOut, Menu, MoreHorizontal, Package, Settings, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { obterLabelPerfil } from '../auth/perfis';
import { getNavLabel } from '../navigation/navConfig';
import UserAvatar from './ui/UserAvatar';

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

function messageIsSessionError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('sessao expirada') || text.includes('sessao invalida');
}

function getCloudState(syncStatus) {
  const source = syncStatus?.dataSource || 'signed_out';
  const message = syncStatus?.dataError?.message || '';
  const pendingCount = Number(syncStatus?.pendingCount || 0);

  if (syncStatus?.isSyncing || source === 'syncing') {
    return {
      tone: 'syncing',
      icon: 'loading',
      label: 'Sincronizando...',
      detail: syncStatus?.lastSyncAt ? `Ultima sync: ${formatSyncTime(syncStatus.lastSyncAt)}` : 'Sincronizacao em andamento',
      title: 'Sincronizacao em andamento',
      disabled: true,
    };
  }

  if (pendingCount > 0) {
    const schemaTables = Array.isArray(syncStatus?.schemaErrorTables) ? syncStatus.schemaErrorTables : [];
    const devDetail = schemaTables.length ? `schema_error em ${schemaTables.join('/')}` : null;
    return {
      tone: 'warning',
      icon: 'loading',
      label: 'Sincronizacao pendente',
      detail: import.meta.env.DEV && devDetail
        ? devDetail
        : (pendingCount === 1 ? '1 pendencia de sync' : `${pendingCount} pendencias de sync`),
      title: 'Pendencias serao sincronizadas automaticamente.',
      disabled: false,
    };
  }

  if (syncStatus?.cloudVerified) {
    return {
      tone: 'online',
      icon: 'cloud',
      label: 'Nuvem ativa',
      detail: syncStatus?.lastSyncAt ? `Ultima sync: ${formatSyncTime(syncStatus.lastSyncAt)}` : 'Conexao validada',
      title: syncStatus?.cloudVerifiedMessage || 'Nuvem conectada pelo servidor.',
      disabled: false,
    };
  }

  if (messageIsSessionError(message)) {
    return {
      tone: 'warning',
      icon: 'warning',
      label: 'Modo local',
      detail: 'Sessao expirada',
      title: 'Sessao expirada. Reconecte para voltar a sincronizar.',
      disabled: false,
    };
  }

  if (source === 'supabase') {
    return {
      tone: 'online',
      icon: 'cloud',
      label: 'Nuvem ativa',
      detail: formatSyncTime(syncStatus?.lastSyncAt),
      title: 'Dados sincronizados com o Supabase',
      disabled: false,
    };
  }

  if (source === 'offline_circuit_open' || source === 'fallback_error' || source === 'fallback_timeout') {
    return {
      tone: 'warning',
      icon: 'warning',
      label: 'Modo local',
      detail: message || 'Nuvem indisponivel no momento',
      title: message || 'Falha de nuvem detectada. O modo local continua ativo.',
      disabled: false,
    };
  }

  if (source === 'offline_disabled') {
    return {
      tone: 'muted',
      icon: 'local',
      label: 'Nuvem pausada',
      detail: 'Modo local ativo',
      title: 'Sincronizacao com Supabase desativada neste navegador',
      disabled: false,
    };
  }

  return {
    tone: 'local',
    icon: 'local',
    label: 'Modo local',
    detail: 'Nuvem nao verificada',
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
  getAlertAckKey = (alert) => alert?.ackKey || alert?.id || 'alerta-sem-chave',
  alertDebugState = null,
}) {
  const [userMenuRef, openUserMenu, setOpenUserMenu] = useDropdown(false);
  const [openNotif, setOpenNotif] = useState(false);
  const notifRef = useRef(null);
  const notifPanelRef = useRef(null);
  const [farmsRef, openFarms, setOpenFarms] = useDropdown(false);
  const [cloudMenuRef, openCloudMenu, setOpenCloudMenu] = useDropdown(false);
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

  const nomeExibicao = usuarioLogado?.nome || 'UsuÃ¡rio';
  const perfilExibicao = obterLabelPerfil(usuarioLogado?.perfilLabel || usuarioLogado?.perfil);
  const cloudState = getCloudState(syncStatus);
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
          <div className="header-sync-menu-wrap" ref={cloudMenuRef}>
            <button
              type="button"
              className="header-sync-refresh header-sync-menu-trigger"
              onClick={() => setOpenCloudMenu((value) => !value)}
              aria-expanded={openCloudMenu}
              aria-controls="cloud-dropdown-menu"
              aria-label="Acoes de nuvem"
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>

            {openCloudMenu && (
              <div id="cloud-dropdown-menu" className="header-sync-dropdown" role="menu" aria-label="Acoes de nuvem">
                <button
                  type="button"
                  className="header-sync-dropdown-item"
                  onClick={() => {
                    syncStatus?.onTestCloud?.();
                    setOpenCloudMenu(false);
                  }}
                  disabled={Boolean(syncStatus?.testingCloud)}
                  role="menuitem"
                >
                  Testar conexao</button>
                <button
                  type="button"
                  className="header-sync-dropdown-item"
                  onClick={() => {
                    syncStatus?.onSyncNow?.();
                    setOpenCloudMenu(false);
                  }}
                  disabled={Boolean(syncStatus?.syncingCloud) || cloudState.disabled}
                  role="menuitem"
                >
                  Sincronizar
                </button>
                <button
                  type="button"
                  className="header-sync-dropdown-item"
                  onClick={() => {
                    syncStatus?.onReconnectCloud?.();
                    setOpenCloudMenu(false);
                  }}
                  disabled={Boolean(syncStatus?.reconnectingCloud)}
                  role="menuitem"
                >
                  Reconectar
                </button>
              </div>
            )}
          </div>
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
                                ConfiguraÃ§Ãµes
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
              aria-label="Fechar notificaÃ§Ãµes"
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
                  <small>Alertas operacionais, sanitÃ¡rios, estoque e lembretes do HERDON.</small>
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
                            {tone === 'danger' ? 'CrÃ­tico' : tone === 'warning' ? 'AtenÃ§Ã£o' : tone === 'info' ? 'Monitorar' : 'Operacional'}
                          </span>
                        </div>
                        <small>{alert.description || alert.mensagem}</small>
                        {import.meta.env.DEV ? (
                          <small className="notif-debug-line">ackKey: {ackKey} | resolved: {isResolved ? 'sim' : 'nÃ£o'} | adiado: {isSnoozed ? 'sim' : 'nÃ£o'} | route found: {hasRoute ? 'sim' : 'nÃ£o'}</small>
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
