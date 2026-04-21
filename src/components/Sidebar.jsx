import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Beef,
  ChevronDown,
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
  CalendarDays, // Use CalendarDays para o calendário operacional
  DollarSign, // Mantido para financeiro
} from 'lucide-react';
import { obterPerfilDoUsuario, permissoesPorPagina } from '../auth/perfis';
import UserAvatar from './ui/UserAvatar';

// Reorganização das seções de navegação
const navSections = [
  {
    id: 'main',
    title: '', // Sem título para a seção principal
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    id: 'rebanho',
    title: 'Rebanho',
    items: [
      { id: 'lotes', label: 'Lotes', icon: Beef },
      { id: 'animais', label: 'Animais', icon: ClipboardList },
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
  // Estado para controlar a abertura/fechamento das seções da sidebar
  const [openSections, setOpenSections] = useState(() => {
    // Inicializa todas as seções como abertas por padrão
    const initialOpenState = {};
    navSections.forEach(section => {
      initialOpenState[section.id] = true;
    });
    return initialOpenState;
  });
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const dropdownRef = useRef(null);

  const usuarioLogado = {
    id: user?.id || null,
    nome: user?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário',
    email: user?.email || '',
    perfil: user?.perfil || obterPerfilDoUsuario(user) || 'Visualizador',
    foto_url: user?.foto_url || user?.user_metadata?.avatar_url || null,
  };

  // Filtra as seções e itens com base nas permissões
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
        .filter((section) => section.items.length > 0) // Remove seções sem itens permitidos
        .map((section) => ({
          ...section,
          isOpen: openSections[section.id] ?? true, // Usa o estado local para abrir/fechar
        })),
    [hasPermission, openSections]
  );

  // Efeitos para controle do menu mobile e dropdown
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
    const fecharDropdown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
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
            </div>
            <div>
              <div className="sidebar-logo-text">HERDON</div>
              <div className="sidebar-logo-sub">Gestão Inteligente</div>
            </div>
          </div>
          {/* Botão de fechar para mobile */}
          <button type="button" className="sidebar-collapse-btn mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar menu de navegação">
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="sidebar-content sb-sec">
          {sections.map((section) => (
            <div key={section.id} className="sidebar-section"> {/* Adicionada classe para a seção */}
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
              {section.isOpen && (
                <div id={`nav-section-${section.id}`} className="nav-sublist" style={{ borderTop: section.title ? undefined : 'none', marginTop: 0, paddingTop: 0 }}>
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
                          setIsMobileMenuOpen(false); // Fecha o menu mobile ao navegar
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                      >
                        <ItemIcon size={16} className="nav-icon" aria-hidden="true" />
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

        {/* Seção do usuário */}
        <div className="sidebar-user-wrap" ref={dropdownRef}>
          <div className="sidebar-user sb-foot" onClick={() => setDropdownAberto((prev) => !prev)} aria-haspopup="menu" aria-expanded={dropdownAberto} aria-label="Menu do usuário">
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
              aria-hidden="true"
            />
          </div>

          {dropdownAberto && (
            <div className="user-dropdown" role="menu">
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
          )}
        </div>
      </aside>
    </>
  );
}