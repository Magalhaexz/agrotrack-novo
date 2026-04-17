import { useMemo, useState } from 'react';
import Icon from './Icon';
import logoAgrotrack from '../assets/logo_app1.png';

const navSections = [
  {
    id: 'dashboard-section',
    title: 'Dashboard',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: 'grid' }],
  },
  {
    id: 'fazenda-section',
    title: 'Fazenda',
    items: [
      { id: 'fazendas', label: 'Fazendas', icon: 'home' },
      { id: 'funcionarios', label: 'Funcionários', icon: 'userBadge' },
      { id: 'rotina', label: 'Rotina', icon: 'checklist' },
    ],
  },
  {
    id: 'operacao-section',
    title: 'Operação',
    items: [
      { id: 'lotes', label: 'Lotes', icon: 'briefcase' },
      { id: 'animais', label: 'Animais', icon: 'users' },
      { id: 'estoque', label: 'Estoque', icon: 'package' },
      { id: 'suplementacao', label: 'Suplementação', icon: 'flask' },
      { id: 'sanitario', label: 'Manejo Sanitário', icon: 'shield' },
    ],
  },
  {
    id: 'acompanhamento-section',
    title: 'Acompanhamento',
    items: [
      { id: 'pesagens', label: 'Pesagens', icon: 'scale' },
      { id: 'acompanhamentoPeso', label: 'Acompanhamento de Peso', icon: 'chart' },
    ],
  },
  {
    id: 'financeiro-section',
    title: 'Financeiro',
    items: [
      { id: 'custos', label: 'Custos Operacionais', icon: 'dollar' },
      { id: 'resultados', label: 'Resultados', icon: 'activity' },
    ],
  },
];

function obterNomeUsuario(user) {
  if (!user) return 'Usuário';

  const metadata = user.user_metadata || {};

  return (
    metadata.nome ||
    metadata.full_name ||
    metadata.name ||
    user.email?.split('@')[0] ||
    'Usuário'
  );
}

function obterSubtituloUsuario(user) {
  if (!user) return 'Conta conectada';
  return user.email || 'Conta conectada';
}

function obterIniciais(nome) {
  if (!nome) return 'U';

  const partes = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!partes.length) return 'U';

  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

function formatarNomeBonito(nome) {
  if (!nome) return 'Usuário';

  return nome
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

export default function Sidebar({
  currentPage,
  onNavigate,
  alertCount = 0,
  user = null,
}) {
  const [openSections, setOpenSections] = useState({
    'dashboard-section': true,
    'fazenda-section': true,
    'operacao-section': true,
    'acompanhamento-section': true,
    'financeiro-section': true,
  });

  const sections = useMemo(() => {
    return navSections.map((section) => {
      const hasActiveItem = section.items.some((item) => item.id === currentPage);

      return {
        ...section,
        hasActiveItem,
        isOpen: openSections[section.id] ?? true,
      };
    });
  }, [currentPage, openSections]);

  const nomeUsuario = formatarNomeBonito(obterNomeUsuario(user));
  const subtituloUsuario = obterSubtituloUsuario(user);
  const iniciaisUsuario = obterIniciais(nomeUsuario);

  function toggleSection(sectionId) {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }

  return (
    <aside className="sb">
      <div
        className="sb-logo"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: 16,
        }}
      >
        <img
          src={logoAgrotrack}
          alt="AgroTrack"
          style={{
            width: '150px',
            maxWidth: '100%',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      <div className="sb-sec">
        <div className="sb-sec-lbl">Navegação</div>

        {sections.map((section) => (
          <div key={section.id} className="nav-group">
            <button
              type="button"
              className={`nav-group-toggle ${section.hasActiveItem ? 'active' : ''}`}
              onClick={() => toggleSection(section.id)}
            >
              <span>{section.title}</span>
              <span className={`nav-group-arrow ${section.isOpen ? 'open' : ''}`}>
                ▾
              </span>
            </button>

            {section.isOpen ? (
              <div className="nav-sublist">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav subnav ${currentPage === item.id ? 'on' : ''}`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon name={item.icon} className="nav-icon" />
                    <span>{item.label}</span>

                    {item.id === 'dashboard' && alertCount > 0 ? (
                      <span className="nav-badge">{alertCount}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        className="sb-foot"
        style={{
          marginTop: 18,
          padding: '14px 12px',
          borderRadius: 18,
          background:
            'linear-gradient(180deg, rgba(20,45,26,0.92) 0%, rgba(11,28,16,0.96) 100%)',
          border: '1px solid rgba(120, 255, 140, 0.10)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.24)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          className="avatar"
          style={{
            width: 46,
            height: 46,
            minWidth: 46,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            color: '#dff9cc',
            background:
              'linear-gradient(135deg, rgba(86, 196, 88, 0.95) 0%, rgba(38, 111, 52, 0.95) 100%)',
            boxShadow: '0 6px 18px rgba(68, 176, 84, 0.22)',
            border: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          {iniciaisUsuario}
        </div>

        <div
          style={{
            minWidth: 0,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            className="u-name"
            title={nomeUsuario}
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#f1ffd8',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              textTransform: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {nomeUsuario}
          </div>

          <div
            className="u-role"
            title={subtituloUsuario}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              fontSize: 12,
              color: 'rgba(219, 243, 201, 0.75)',
              fontWeight: 500,
            }}
          >
            {subtituloUsuario}
          </div>
        </div>
      </div>
    </aside>
  );
}