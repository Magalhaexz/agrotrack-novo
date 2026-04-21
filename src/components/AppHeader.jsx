import { Bell, ChevronDown, Clock3, LogOut, Menu, Settings, User } from 'lucide-react';
import { useState } from 'react';
import Button from './ui/Button';

export default function AppHeader({
  farmName = 'Fazenda Modelo',
  userName = 'Usuário',
  notifications = 0,
  alerts = [],
  onResolveAlert,
  onSnoozeAlert,
  onAlertNavigate,
  onSignOut,
  onOpenMenu,
}) {
  const [open, setOpen] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);

  return (
    <header className="top-header">
      <div className="top-header-left">
        <button type="button" className="mobile-menu-inline sem-impressao" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={18} />
        </button>
        <strong>{farmName}</strong>
      </div>
      <div className="top-header-actions">
        <div className="user-menu-wrap">
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

        <div className="user-menu-wrap">
          <button type="button" className="user-menu-btn" onClick={() => setOpen((v) => !v)}>
            <span className="avatar">{userName.slice(0, 2).toUpperCase()}</span>
            <span>{userName}</span>
            <ChevronDown size={14} />
          </button>
          {open ? (
            <div className="user-menu-dropdown">
              <button type="button"><User size={14} /> Perfil</button>
              <button type="button"><Settings size={14} /> Configurações</button>
              <Button variant="ghost" icon={<LogOut size={14} />} onClick={onSignOut}>Sair</Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
