import { Bell, ChevronDown, Clock3, LogOut, Menu, Settings, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from './ui/Button';

export default function AppHeader({
  farmName = 'Fazenda Modelo',
  userName = 'Usuário',
  userEmail = '',
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
}) {
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setOpenUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setOpenNotif(false);
      }
    }

    function handleEsc(event) {
      if (event.key === 'Escape') {
        setOpenUserMenu(false);
        setOpenNotif(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  async function handleLogout() {
    const confirmado = onConfirmAction
      ? await onConfirmAction({
          title: 'Sair da conta',
          message: 'Deseja realmente sair da sua conta?',
          tone: 'danger',
        })
      : window.confirm('Deseja realmente sair da sua conta?');

    if (!confirmado) return;

    onSignOut?.();
    setOpenUserMenu(false);
  }

  const iniciais = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button type="button" className="mobile-menu-inline sem-impressao" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <strong>{farmName}</strong>
      </div>

      <div className="top-header-actions">
        <div className="user-menu-wrap" ref={notifRef}>
          <button type="button" className="notif-btn" aria-label="Notificações" onClick={() => setOpenNotif((v) => !v)}>
            <Bell size={16} />
            {notifications > 0 ? <span className="notif-badge">{notifications}</span> : null}
          </button>
          {openNotif ? (
            <div className="notif-dropdown">
              {alerts.length === 0 ? <p>Sem alertas.</p> : alerts.map((alert) => (
                <div key={alert.ackKey || alert.id} className="notif-item">
                  <strong>{alert.title}</strong>
                  <small>{alert.description}</small>
                  <div className="notif-actions">
                    <Button size="sm" variant="outline" onClick={() => onResolveAlert?.(alert)}>Resolver</Button>
                    <Button size="sm" variant="ghost" icon={<Clock3 size={12} />} onClick={() => onSnoozeAlert?.(alert)}>Adiar</Button>
                    <Button size="sm" variant="ghost" onClick={() => onAlertNavigate?.(alert)}>Abrir</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="user-menu-wrap" ref={userMenuRef}>
          <button type="button" className="user-menu-btn" onClick={() => setOpenUserMenu((v) => !v)}>
            <span className="avatar">{iniciais || 'US'}</span>
            <span>{userName}</span>
            <ChevronDown size={14} />
          </button>

          <div className={`user-menu-dropdown user-menu-dropdown--themed ${openUserMenu ? 'open' : ''}`}>
            <div className="user-menu-meta">
              <strong>{userName}</strong>
              <small>{userEmail || 'sem-email@agrotrack'}</small>
            </div>
            <button
              type="button"
              onClick={() => {
                onNavigateProfile?.();
                setOpenUserMenu(false);
              }}
            >
              <User size={14} /> Meu Perfil
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateSettings?.();
                setOpenUserMenu(false);
              }}
            >
              <Settings size={14} /> Configurações
            </button>
            <div className="user-menu-divider" />
            <button type="button" className="user-menu-logout" onClick={handleLogout}>
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
