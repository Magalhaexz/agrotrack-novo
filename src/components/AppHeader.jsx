import { Bell, ChevronDown, Clock3, LogOut, Menu, Settings, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from './ui/Button';
import UserAvatar from './ui/UserAvatar';

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
}) {
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [openFarms, setOpenFarms] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const farmsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setOpenUserMenu(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setOpenNotif(false);
      if (farmsRef.current && !farmsRef.current.contains(event.target)) setOpenFarms(false);
    }
    function handleEsc(event) {
      if (event.key === 'Escape') {
        setOpenUserMenu(false);
        setOpenNotif(false);
        setOpenFarms(false);
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
      ? await onConfirmAction({ title: 'Sair da conta', message: 'Deseja realmente sair da sua conta?', tone: 'danger' })
      : window.confirm('Deseja realmente sair da sua conta?');
    if (!confirmado) return;
    onSignOut?.();
    setOpenUserMenu(false);
  }

  const nomeExibicao = usuarioLogado?.nome || 'Usuário';

  return (
    <header className="header top-header">
      <button type="button" className="mobile-menu-inline sem-impressao" onClick={onOpenMenu} aria-label="Abrir menu">
        <Menu size={18} />
      </button>

      <div className="farm-selector-wrap" ref={farmsRef}>
        <button type="button" className="header-farm-selector" onClick={() => setOpenFarms((v) => !v)}>
          <strong>{fazendaSelecionada?.nome || farmName}</strong>
          <ChevronDown size={14} style={{ transform: openFarms ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </button>
        {openFarms ? (
          <div className="header-farm-dropdown">
            {(fazendas || []).map((fazenda) => (
              <button
                key={fazenda.id}
                type="button"
                className={`header-farm-item ${Number(fazendaSelecionada?.id) === Number(fazenda.id) ? 'active' : ''}`}
                onClick={() => {
                  onSelectFazenda?.(fazenda);
                  setOpenFarms(false);
                }}
              >
                <span>{fazenda.nome}</span>
                <small>{fazenda.cidade} / {fazenda.estado}</small>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="header-tabs">
        {['geral', 'estoque', 'alertas'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`header-tab ${tabAtiva === tab ? 'active' : ''}`}
            onClick={() => onTabChange?.(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <div className="top-header-actions">
        <div className="user-menu-wrap" ref={notifRef}>
          <button type="button" className="header-notification-btn notif-btn" aria-label="Notificações" onClick={() => setOpenNotif((v) => !v)}>
            <Bell size={16} />
            {notifications > 0 ? <span className="notification-badge notif-badge">{notifications}</span> : null}
          </button>
          {openNotif ? (
            <div className="notif-dropdown">
              {alerts.length === 0
                ? <p>Sem alertas.</p>
                : alerts.map((alert) => (
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
          <button type="button" className="header-user-btn user-menu-btn" onClick={() => setOpenUserMenu((v) => !v)}>
            <UserAvatar usuario={usuarioLogado} size={32} />
            <span className="header-user-name">{nomeExibicao.split(' ')[0]}</span>
            <ChevronDown size={14} style={{ transform: openUserMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>

          {openUserMenu ? (
            <div className="header-user-dropdown">
              <div className="user-dropdown-header">
                <UserAvatar usuario={usuarioLogado} size={44} />
                <div>
                  <p className="user-dropdown-name">{nomeExibicao}</p>
                  <p className="user-dropdown-email">{usuarioLogado?.email || 'sem-email@herdon.app'}</p>
                  <span className="user-dropdown-badge">{usuarioLogado?.perfil || 'Visualizador'}</span>
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
          ) : null}
        </div>
      </div>
    </header>
  );
}
