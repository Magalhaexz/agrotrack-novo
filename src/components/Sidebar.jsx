import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Beef,
  ChevronDown,
<<<<<<< HEAD
=======
  ChevronRight,
  DollarSign,
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Scale,
  MapPin,
  Settings,
  ShieldPlus,
  Syringe,
  User,
  Users,
  X,
  ClipboardList,
  CheckSquare,
  TrendingUp,
<<<<<<< HEAD
  CalendarDays, // Use CalendarDays para o calendário operacional
  DollarSign, // Mantido para financeiro
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
} from 'lucide-react';
import { obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';
import UserAvatar from './ui/UserAvatar';

<<<<<<< HEAD
// Reorganização das seções de navegação
const navSections = [
  {
    id: 'main',
    title: '', // Sem título para a seção principal
=======
const navSections = [
  {
    id: 'main',
    title: '',
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'rebanho',
    title: 'Rebanho',
    items: [
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
<<<<<<< HEAD
      { id: 'pesagens', label: 'Pesagem', icon: Scale }, // Movido para Rebanho
    ],
  },
  {
    id: 'manejo', // Nova seção de Manejo
    title: 'Manejo',
    items: [
      { id: 'sanitario', label: 'Sanitário', icon: Syringe },
      { id: 'suplementacao', label: 'Suplementação', icon: ShieldPlus },
      { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
      { id: 'calendarioOperacional', label: 'Calendário', icon: CalendarDays }, // Ícone mais específico
    ],
  },
  {
    id: 'financeiro_estoque', // Agrupando Financeiro e Estoque
    title: 'Financeiro & Estoque',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
      { id: 'estoque', label: 'Estoque', icon: Package },
    ],
  },
  {
    id: 'analises_relatorios', // Nova seção de Análises e Relatórios
    title: 'Análises & Relatórios',
    items: [
      { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
    ],
  },
  {
    id: 'cadastros_configuracoes', // Nova seção de Cadastros e Configurações
    title: 'Cadastros & Configurações',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
=======
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
      { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
      { id: 'resultados', label: 'Relatórios', icon: ClipboardList },
      { id: 'fazendas', label: 'Fazendas', icon: MapPin },
      { id: 'funcionarios', label: 'Funcionários', icon: Users },
      { id: 'pesagens', label: 'Pesagem', icon: Scale },
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      { id: 'configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  alertCount = 0,
  user = null,
  hasPermission = () => true,
  onSignOut,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
<<<<<<< HEAD
  // Estado para controlar a abertura/fechamento das seções da sidebar
  const [openSections, setOpenSections] = useState(() => {
    // Inicializa todas as seções como abertas por padrão
    const initialOpenState = {};
    navSections.forEach(section => {
      initialOpenState[section.id] = true;
    });
    return initialOpenState;
  });
=======
  const [openSections, setOpenSections] = useState({ main: true, rebanho: true, gestao: true });
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  const usuarioLogado = {
    id: user?.id || null,
    nome: user?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário',
    email: user?.email || '',
    perfil: user?.perfil || obterPerfilDoUsuario(user) || 'Visualizador',
    foto_url: user?.foto_url || user?.user_metadata?.avatar_url || null,
  };

<<<<<<< HEAD
  // Filtra as seções e itens com base nas permissões
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
        .filter((section) => section.items.length > 0) // Remove seções sem itens permitidos
        .map((section) => ({
          ...section,
          isOpen: openSections[section.id] ?? true, // Usa o estado local para abrir/fechar
=======
        .filter((section) => section.items.length > 0)
        .map((section) => ({
          ...section,
          isOpen: openSections[section.id] ?? true,
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        })),
    [hasPermission, openSections]
  );

<<<<<<< HEAD
  // Efeitos para controle do menu mobile e dropdown
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
    const fecharDropdown = (e) => {
=======
    const fechar = (e) => {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownAberto(false);
      }
    };

<<<<<<< HEAD
    document.addEventListener('mousedown', fecharDropdown);
    return () => document.removeEventListener('mousedown', fecharDropdown);
=======
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }, []);

  function handleLogout() {
    onSignOut?.();
    setDropdownAberto(false);
  }

  return (
    <>
<<<<<<< HEAD
      {/* Topbar para mobile */}
      <div className="mobile-topbar">
        <button type="button" className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)} aria-label="Abrir menu de navegação">
          <Menu size={18} aria-hidden="true" />
        </button>
        <div className="sidebar-logo-text">HERDON</div>
      </div>
      {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />}

      {/* Sidebar principal */}
      <aside className={`sidebar sb ${isMobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-logo">
          <div className="sidebar-logo-content"> {/* Nova div para agrupar logo e texto */}
            <div className="sidebar-logo-icon-wrap"> {/* Nova classe para o ícone do logo */}
              <span className="sidebar-logo-icon">H</span>
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            </div>
            <div>
              <div className="sidebar-logo-text">HERDON</div>
              <div className="sidebar-logo-sub">Gestão Inteligente</div>
            </div>
          </div>
<<<<<<< HEAD
          {/* Botão de fechar para mobile */}
          <button type="button" className="sidebar-collapse-btn mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar menu de navegação">
            <X size={14} aria-hidden="true" />
=======
          <button type="button" className="sidebar-collapse-btn mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            {isMobileMenuOpen ? <X size={14} /> : <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          </button>
        </div>

        <div className="sidebar-content sb-sec">
          {sections.map((section) => (
<<<<<<< HEAD
            <div key={section.id} className="sidebar-section"> {/* Adicionada classe para a seção */}
=======
            <div key={section.id}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              {section.title ? (
                <button
                  type="button"
                  className="sidebar-group-label nav-group-toggle"
                  onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
<<<<<<< HEAD
                  aria-expanded={section.isOpen}
                  aria-controls={`nav-section-${section.id}`}
                >
                  <span>{section.title}</span>
                  <ChevronDown size={14} className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`} aria-hidden="true" />
                </button>
              ) : null}
              {section.isOpen && (
                <div id={`nav-section-${section.id}`} className="nav-sublist" style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPage === item.id;
=======
                >
                  <span>{section.title}</span>
                  <ChevronDown size={14} className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`} />
                </button>
              ) : null}
              {section.isOpen && (
                <div className="nav-sublist" style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}>
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                    return (
                      <button
                        key={item.id}
                        type="button"
<<<<<<< HEAD
                        className={`sidebar-item nav subnav ${isActive ? 'active on' : ''}`}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMobileMenuOpen(false); // Fecha o menu mobile ao navegar
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                      >
                        <ItemIcon size={16} className="nav-icon" aria-hidden="true" />
=======
                        className={`sidebar-item nav subnav ${currentPage === item.id ? 'active on' : ''}`}
                        onClick={() => {
                          onNavigate(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                      >
                        <ItemIcon size={16} className="nav-icon" />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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

<<<<<<< HEAD
        {/* Seção do usuário */}
        <div className="sidebar-user-wrap" ref={dropdownRef}>
          <div className="sidebar-user sb-foot" onClick={() => setDropdownAberto((prev) => !prev)} aria-haspopup="menu" aria-expanded={dropdownAberto} aria-label="Menu do usuário">
=======
        <div className="sidebar-user-wrap" ref={dropdownRef}>
          <div className="sidebar-user sb-foot" onClick={() => setDropdownAberto((prev) => !prev)}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            <UserAvatar usuario={usuarioLogado} size={40} />
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{usuarioLogado?.nome}</p>
              <p className="sidebar-user-role">{usuarioLogado?.perfil}</p>
            </div>
            <ChevronDown
              size={16}
              style={{
                color: 'var(--color-text-muted)',
                transform: dropdownAberto ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
<<<<<<< HEAD
              aria-hidden="true"
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            />
          </div>

          {dropdownAberto && (
<<<<<<< HEAD
            <div className="user-dropdown" role="menu">
=======
            <div className="user-dropdown">
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              <div className="user-dropdown-header">
                <UserAvatar usuario={usuarioLogado} size={44} />
                <div>
                  <p className="user-dropdown-name">{usuarioLogado?.nome}</p>
                  <p className="user-dropdown-email">{usuarioLogado?.email}</p>
                  <span className="user-dropdown-badge">{usuarioLogado?.perfil}</span>
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
<<<<<<< HEAD
                role="menuitem"
              >
                <User size={15} aria-hidden="true" />
=======
              >
                <User size={15} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
                role="menuitem"
              >
                <Settings size={15} aria-hidden="true" />
=======
              >
                <Settings size={15} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                Configurações
              </button>

              <div className="user-dropdown-divider" />

<<<<<<< HEAD
              <button className="user-dropdown-item logout" onClick={handleLogout} type="button" role="menuitem">
                <LogOut size={15} aria-hidden="true" />
=======
              <button className="user-dropdown-item logout" onClick={handleLogout} type="button">
                <LogOut size={15} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
