import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { initialDb } from './data/mockData';
import { useAuth } from './auth/useAuth';
import { permissoesPorPagina } from './auth/perfis';
import AppHeader from './components/AppHeader';
import ConfirmModal from './components/ConfirmModal';
import MobileBottomNav from './components/MobileBottomNav';
import MobileFab from './components/MobileFab';
import RotaProtegida from './components/RotaProtegida';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Modal from './components/ui/Modal';
import {
  gerarAlertasCalendario,
  gerarAlertasEstoque,
  gerarAlertasLote,
  gerarAlertasPesagem,
  ordenarAlertas,
} from './domain/alertas';
import { useOperationalData } from './hooks/useOperationalData';
import { useToast } from './hooks/useToast';
import {
  HERDON_LOGOUT_CHANNEL,
  HERDON_LOGOUT_EVENT_KEY,
  limparPersistenciaSessao,
  publicarEventoLogout,
  supabase,
} from './lib/supabase';
import { secondaryNavItems, navSections } from './navigation/navConfig';
import {
  registrarEntradaAnimal,
  registrarEntradaEstoque,
  registrarSaidaAnimal,
  registrarSaidaEstoque,
} from './services/movimentacoes';
import { createOperationalRecord } from './services/operationalPersistence';
import { buildAlerts } from './utils/alerts';
import './styles/app.css';
import './styles/ui.css';


const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FazendasPage = lazy(() => import('./pages/FazendasPage'));
const LotesPage = lazy(() => import('./pages/LotesPage'));
const CalendarioOperacionalPage = lazy(() => import('./pages/CalendarioOperacionalPage'));
const ComparativoPage = lazy(() => import('./pages/ComparativoPage'));
const AnimaisPage = lazy(() => import('./pages/AnimaisPage'));
const SuplementacaoPage = lazy(() => import('./pages/SuplementacaoPage'));
const SanitarioPage = lazy(() => import('./pages/SanitarioPage'));
const CustosPage = lazy(() => import('./pages/CustosPage'));
const ResultadosPage = lazy(() => import('./pages/ResultadosPage'));
const FinanceiroPage = lazy(() => import('./pages/FinanceiroPage'));
const EstoquePage = lazy(() => import('./pages/EstoquePage'));
const PesagensPage = lazy(() => import('./pages/PesagensPage'));
const AcompanhamentoPesoPage = lazy(() => import('./pages/AcompanhamentoPesoPage'));
const RotinaPage = lazy(() => import('./pages/RotinaPage'));
const FuncionariosPage = lazy(() => import('./pages/FuncionariosPage'));
const TarefasPage = lazy(() => import('./pages/TarefasPage'));
const PerfilPage = lazy(() => import('./pages/PerfilPage'));
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));

const pageMap = {
  dashboard: DashboardPage,
  fazendas: FazendasPage,
  lotes: LotesPage,
  calendarioOperacional: CalendarioOperacionalPage,
  comparativo: ComparativoPage,
  funcionarios: FuncionariosPage,
  rotina: RotinaPage,
  tarefas: TarefasPage,
  perfil: PerfilPage,
  configuracoes: ConfiguracoesPage,
  animais: AnimaisPage,
  suplementacao: SuplementacaoPage,
  sanitario: SanitarioPage,
  estoque: EstoquePage,
  pesagens: PesagensPage,
  acompanhamentoPeso: AcompanhamentoPesoPage,
  custos: CustosPage,
  resultados: ResultadosPage,
  financeiro: FinanceiroPage,
};


export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { toasts, showToast, removeToast } = useToast();
  const {
    session,
    user,
    loadingAuth,
    hasPermission,
    forceLocalSignOut,
  } = useAuth();
  const {
    db,
    setDb,
    dataReady,
    dataSource,
    dataError,
  } = useOperationalData(initialDb, session, {
    enabled: Boolean(session?.user?.id) && !loadingAuth,
  });
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [menuExtraAberto, setMenuExtraAberto] = useState(false);
  const [tabAtiva, setTabAtiva] = useState('geral');
  const [fazendaSelecionada, setFazendaSelecionada] = useState(null);
  const [forcarTelaLogin, setForcarTelaLogin] = useState(false);
  const [showBootRecovery, setShowBootRecovery] = useState(false);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'danger',
    resolver: null,
  });
  const deniedToastRef = useRef({ permission: '', timestamp: 0 });

  if (import.meta.env.DEV) {
    console.debug('[HERDON_AUTH_BOOT]', {
      loadingAuth,
      hasSession: Boolean(session),
    });
    console.debug('[HERDON_DATA_BOOT]', {
      dataReady,
      dataSource,
      dataErrorMessage: dataError?.message || null,
    });
  }

  const isBootLoading = loadingAuth;
  const isOperationalSyncing = Boolean(session) && (dataSource === 'syncing' || (session && !dataReady));

  useEffect(() => {
    if (!isBootLoading) {
      setShowBootRecovery(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowBootRecovery(true);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [isBootLoading]);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      const texto = String(message || '');
      const lower = texto.toLowerCase();
      const type = lower.includes('sucesso')
        ? 'success'
        : lower.includes('erro') || lower.includes('insuficiente')
          ? 'error'
          : lower.includes('atencao') || lower.includes('alerta')
            ? 'warning'
            : 'info';
      showToast({ type, message: texto });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  useEffect(() => {
    if (!user) {
      setUsuarioLogado(null);
      return;
    }

    if (forcarTelaLogin) {
      return;
    }

    setForcarTelaLogin(false);
    setUsuarioLogado((prev) => ({
      id: user.id || prev?.id || null,
      nome: user?.nome || prev?.nome || user?.user_metadata?.name || user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Usuário',
      email: user.email || prev?.email || '',
      perfil: user?.perfil || prev?.perfil || 'visualizador',
      perfilLabel: user?.perfilLabel || prev?.perfilLabel || 'Visualizador',
      foto_url: user?.foto_url ?? prev?.foto_url ?? user?.user_metadata?.avatar_url ?? null,
      telefone: user?.telefone ?? prev?.telefone ?? '',
      cargo: user?.cargo ?? prev?.cargo ?? '',
    }));
  }, [forcarTelaLogin, user]);

  useEffect(() => {
    function aplicarLogoutForcado() {
      forceLocalSignOut();
      setForcarTelaLogin(true);
      setUsuarioLogado(null);
      setCurrentPage('dashboard');
    }

    function onStorage(event) {
      if (event.key !== HERDON_LOGOUT_EVENT_KEY || !event.newValue) return;
      aplicarLogoutForcado();
    }

    let authChannel = null;
    function onBroadcast(event) {
      if (event?.data?.type !== 'logout') return;
      aplicarLogoutForcado();
    }

    window.addEventListener('storage', onStorage);
    try {
      authChannel = new BroadcastChannel(HERDON_LOGOUT_CHANNEL);
      authChannel.addEventListener('message', onBroadcast);
    } catch {
      authChannel = null;
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (authChannel) {
        authChannel.removeEventListener('message', onBroadcast);
        authChannel.close();
      }
    };
  }, [forceLocalSignOut]);

  useEffect(() => {
    const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
    if (!fazendas.length) {
      setFazendaSelecionada(null);
      return;
    }

    setFazendaSelecionada((prev) => {
      if (prev && fazendas.some((fazenda) => Number(fazenda.id) === Number(prev.id))) {
        return fazendas.find((fazenda) => Number(fazenda.id) === Number(prev.id));
      }
      return fazendas[0];
    });
  }, [db?.fazendas]);

  const dbDashboard = useMemo(() => {
    const start = import.meta.env.DEV ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : 0;
    if (!fazendaSelecionada?.id) {
      if (import.meta.env.DEV) {
        const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
        console.debug('[HERDON_DASHBOARD_TIMING]', {
          stage: 'dbDashboard_all_farms',
          durationMs: Number((end - start).toFixed(1)),
        });
      }
      return db;
    }

    const loteIds = new Set(
      (db.lotes || [])
        .filter((lote) => Number(lote.faz_id) === Number(fazendaSelecionada.id))
        .map((lote) => lote.id)
    );

    const scopedDb = {
      ...db,
      lotes: (db.lotes || []).filter((lote) => loteIds.has(lote.id)),
      animais: (db.animais || []).filter((animal) => loteIds.has(animal.lote_id)),
      custos: (db.custos || []).filter((custo) => loteIds.has(custo.lote_id)),
      pesagens: (db.pesagens || []).filter((pesagem) => loteIds.has(pesagem.lote_id)),
      sanitario: (db.sanitario || []).filter((item) => loteIds.has(item.lote_id)),
      tarefas: (db.tarefas || []).filter(
        (tarefa) =>
          !tarefa.fazenda_id ||
          Number(tarefa.fazenda_id) === Number(fazendaSelecionada.id) ||
          loteIds.has(tarefa.lote_id)
      ),
      movimentacoes_animais: (db.movimentacoes_animais || []).filter((movimento) => loteIds.has(movimento.lote_id)),
    };
    if (import.meta.env.DEV) {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.debug('[HERDON_DASHBOARD_TIMING]', {
        stage: 'dbDashboard_scoped',
        durationMs: Number((end - start).toFixed(1)),
        lotes: scopedDb.lotes?.length || 0,
      });
    }
    return scopedDb;
  }, [db, fazendaSelecionada]);

  function atualizarUsuario(dadosAtualizados) {
    setUsuarioLogado((prev) => {
      const base = prev || {
        id: user?.id || null,
        nome: user?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário',
        email: user?.email || '',
        perfil: user?.perfil || 'visualizador',
        perfilLabel: user?.perfilLabel || 'Visualizador',
        foto_url: user?.foto_url || user?.user_metadata?.avatar_url || null,
        telefone: user?.telefone || '',
        cargo: user?.cargo || '',
      };

      const atualizado = {
        ...base,
        ...dadosAtualizados,
        foto_url: dadosAtualizados?.foto_url ?? base.foto_url ?? null,
      };

      localStorage.setItem('herdon_usuario', JSON.stringify(atualizado));
      return atualizado;
    });
  }

  async function handleLogout() {
    forceLocalSignOut();
    setForcarTelaLogin(true);
    setUsuarioLogado(null);

    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('Erro ao finalizar sessão:', error);
      try {
        await supabase.auth.signOut();
      } catch (fallbackError) {
        console.error('Erro ao finalizar sessão (fallback local):', fallbackError);
      }
    } finally {
      limparPersistenciaSessao();
      publicarEventoLogout('manual_logout');
    }

    setCurrentPage('dashboard');
  }

  async function handleClearSessionAndReload() {
    try {
      forceLocalSignOut();
      limparPersistenciaSessao();
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[HERDON_CLEAR_SESSION]', error);
      }
      try {
        await supabase.auth.signOut();
      } catch (fallbackError) {
        if (import.meta.env.DEV) {
          console.warn('[HERDON_CLEAR_SESSION_FALLBACK]', fallbackError);
        }
      }
    } finally {
      publicarEventoLogout('clear_session_reload');
      window.location.reload();
    }
  }

  const alertasResolvidos = Array.isArray(db?.alertas_resolvidos) ? db.alertas_resolvidos : [];

  const rawAlerts = useMemo(() => {
    const start = import.meta.env.DEV ? (typeof performance !== 'undefined' ? performance.now() : Date.now()) : 0;
    const legacy = buildAlerts(db);
    const automaticos = [
      ...gerarAlertasEstoque(db),
      ...gerarAlertasCalendario(db),
      ...gerarAlertasPesagem(db),
      ...gerarAlertasLote(db),
    ];
    const merged = ordenarAlertas([...legacy, ...automaticos]);
    if (import.meta.env.DEV) {
      const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.debug('[HERDON_DASHBOARD_TIMING]', {
        stage: 'rawAlerts',
        durationMs: Number((end - start).toFixed(1)),
        count: merged.length,
      });
    }
    return merged;
  }, [db]);

  const alerts = useMemo(
    () => rawAlerts.filter((alert) => !alertasResolvidos.includes(alert.ackKey || alert.id)),
    [alertasResolvidos, rawAlerts]
  );

  async function marcarAlertaComoFeito(alert) {
    const chave = alert?.ackKey || alert?.id;
    if (!chave) {
      return;
    }

    const persisted = await createOperationalRecord('alertas_resolvidos', { chave }, session);
    setDb((prev) => ({
      ...prev,
      alertas_resolvidos: Array.from(new Set([...(prev?.alertas_resolvidos || []), chave])),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Alerta resolvido apenas localmente.' });
    }
  }

  const userContext = { id: user?.id || null, email: user?.email || '' };
  const persistContext = {
    session,
    persist: true,
    onWarning: (message) => showToast({ type: 'warning', message: message || 'Operação salva parcialmente apenas localmente.' }),
  };

  const handleRegistrarEntradaAnimal = (dados) => setDb((prev) => registrarEntradaAnimal(prev, dados, userContext, persistContext));
  const handleRegistrarSaidaAnimal = (dados) => setDb((prev) => registrarSaidaAnimal(prev, dados, userContext, persistContext));
  const handleRegistrarEntradaEstoque = (dados) => setDb((prev) => registrarEntradaEstoque(prev, dados, userContext));
  const handleRegistrarSaidaEstoque = (dados) => setDb((prev) => registrarSaidaEstoque(prev, dados, userContext));

  const onConfirmAction = ({ title, message, tone = 'danger' }) =>
    new Promise((resolve) => {
      setConfirmState({
        open: true,
        title: title || 'Confirmar ação',
        message,
        tone,
        resolver: resolve,
      });
    });

  function fecharConfirmacao(resultado) {
    if (typeof confirmState.resolver === 'function') {
      confirmState.resolver(resultado);
    }

    setConfirmState({
      open: false,
      title: '',
      message: '',
      tone: 'danger',
      resolver: null,
    });
  }

  function navigateWithPermission(pagina) {
    const permissaoDestino = permissoesPorPagina[pagina];
    if (!permissaoDestino || hasPermission(permissaoDestino)) {
      setCurrentPage(pagina);
      return true;
    }

    const agora = Date.now();
    if (
      deniedToastRef.current.permission !== permissaoDestino ||
      agora - deniedToastRef.current.timestamp > 1800
    ) {
      deniedToastRef.current = { permission: permissaoDestino, timestamp: agora };
      showToast({ type: 'warning', message: 'Seu perfil atual nao tem acesso a esta area.' });
    }

    return false;
  }

  function handleMobileQuickAction(acao) {
    const action = String(acao || '').toLowerCase();

    if (action.includes('pesagem')) {
      navigateWithPermission('pesagens');
      return;
    }

    if (action.includes('movimenta') || action.includes('lote')) {
      navigateWithPermission('lotes');
      return;
    }

    if (action.includes('entrada') || action.includes('saida') || action.includes('item')) {
      navigateWithPermission('estoque');
      return;
    }

    if (action.includes('receita') || action.includes('despesa') || action.includes('fluxo')) {
      navigateWithPermission('financeiro');
      return;
    }

    showToast({ type: 'info', message: `Acao rapida disponivel: ${acao}` });
  }

  const paginaValida = currentPage in pageMap;
  const permissaoAtual = permissoesPorPagina[currentPage] || null;
  const podeAcessarPaginaAtual = paginaValida && (!permissaoAtual || hasPermission(permissaoAtual));
  const pageKey = podeAcessarPaginaAtual ? currentPage : 'dashboard';
  const ActivePage = pageMap[pageKey] || DashboardPage;
  const permissaoPaginaAtual = permissoesPorPagina[pageKey] || null;

  const mobileNavGroups = useMemo(() => {
    const grupos = navSections
      .map((section) => ({
        id: section.id,
        title: section.title || 'Principal',
        items: section.items.filter((item) => {
          const permissao = permissoesPorPagina[item.id];
          return !permissao || hasPermission(permissao);
        }),
      }))
      .filter((section) => section.items.length > 0);

    const conta = secondaryNavItems.filter((item) => {
      const permissao = permissoesPorPagina[item.id];
      return !permissao || hasPermission(permissao);
    });

    if (conta.length) {
      grupos.push({
        id: 'conta',
        title: 'Conta',
        items: conta,
      });
    }

    return grupos;
  }, [hasPermission]);

  if (isBootLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-panel">
          <span className="app-loading-pill">HERDON</span>
          <strong>Verificando seu acesso...</strong>
          <p>Estamos validando sua sessão para iniciar o sistema.</p>
          <div className="app-loading-bars" aria-hidden="true">
            <span className="app-loading-bar" />
            <span className="app-loading-bar" />
            <span className="app-loading-bar" />
          </div>
          {showBootRecovery ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <strong>O carregamento está demorando mais que o normal.</strong>
              <p>Você pode tentar novamente ou limpar a sessão local para voltar ao login.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="ui-button ui-button--outline ui-button--sm" onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={handleClearSessionAndReload}>
                  Limpar sessão e voltar ao login
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (forcarTelaLogin || !session) {
    return (
      <Suspense fallback={<div className="app-loading">Abrindo login...</div>}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <div className="app">
      <Sidebar
        currentPage={pageKey}
        onNavigate={navigateWithPermission}
        alertCount={alerts.length}
        user={usuarioLogado}
        hasPermission={hasPermission}
        onSignOut={handleLogout}
      />

      <main className="main">
        {isOperationalSyncing ? (
          <div style={{ padding: '8px 16px 0', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
            Sincronizando dados da operação...
          </div>
        ) : null}
        {(dataSource === 'fallback_error' || dataSource === 'fallback_timeout') ? (
          <div style={{ padding: '8px 16px 0', fontSize: 12, color: 'var(--text-secondary, #6b7280)' }}>
            Sincronizacao instavel. Seus dados locais continuam disponiveis.
          </div>
        ) : null}
        <AppHeader
          farmName={fazendaSelecionada?.nome || db?.fazendas?.[0]?.nome || 'Fazenda Atual'}
          notifications={alerts.length}
          alerts={alerts}
          onResolveAlert={marcarAlertaComoFeito}
          onSnoozeAlert={(alert) => showToast({ type: 'warning', message: `Alerta adiado: ${alert.title}` })}
          onAlertNavigate={(alert) => {
            if (alert?.route) {
              navigateWithPermission(alert.route);
            }
          }}
          onSignOut={handleLogout}
          onNavigateProfile={() => navigateWithPermission('perfil')}
          onNavigateSettings={() => navigateWithPermission('configuracoes')}
          onConfirmAction={onConfirmAction}
          onOpenMenu={() => window.dispatchEvent(new CustomEvent('agrotrack-open-drawer'))}
          usuarioLogado={usuarioLogado}
          fazendas={db?.fazendas || []}
          fazendaSelecionada={fazendaSelecionada}
          onSelectFazenda={setFazendaSelecionada}
          tabAtiva={tabAtiva}
          onTabChange={setTabAtiva}
        />

        <div key={pageKey} className="page-wrapper">
            <Suspense
              fallback={(
                <div className="skeleton-page">
                  <div className="skeleton-banner" />
                  <div className="skeleton-grid">
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                  </div>
                  <div className="skeleton-table" />
                </div>
              )}
            >
              <RotaProtegida permissao={permissaoPaginaAtual}>
                <ActivePage
                  db={pageKey === 'dashboard' ? dbDashboard : db}
                  setDb={setDb}
                  alerts={alerts}
                  onNavigate={navigateWithPermission}
                  onResolveAlert={marcarAlertaComoFeito}
                  onRegistrarEntradaAnimal={handleRegistrarEntradaAnimal}
                  onRegistrarSaidaAnimal={handleRegistrarSaidaAnimal}
                  onRegistrarEntradaEstoque={handleRegistrarEntradaEstoque}
                  onRegistrarSaidaEstoque={handleRegistrarSaidaEstoque}
                  onConfirmAction={onConfirmAction}
                  usuarioLogado={usuarioLogado}
                  atualizarUsuario={atualizarUsuario}
                  tabAtiva={tabAtiva}
                  setTabAtiva={setTabAtiva}
                  onSignOut={handleLogout}
                />
              </RotaProtegida>
            </Suspense>
        </div>
      </main>

      <MobileBottomNav
        currentPage={pageKey}
        onNavigate={(pagina) => {
          navigateWithPermission(pagina);
        }}
        onOpenMore={() => setMenuExtraAberto(true)}
      />

      <MobileFab
        page={pageKey}
        onAction={handleMobileQuickAction}
      />

      <Modal
        open={menuExtraAberto}
        onClose={() => setMenuExtraAberto(false)}
        title="Mais opções"
        subtitle="Todos os módulos do app continuam acessíveis no mobile"
      >
        <div className="mobile-nav-modal">
          {mobileNavGroups.map((group) => (
            <section key={group.id} className="mobile-nav-group">
              <p className="mobile-nav-group-title">{group.title}</p>
              <div className="mobile-nav-options">
                {group.items.map((item) => {
                  const Icone = item.icon;
                  const isActive = pageKey === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`mobile-nav-option ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        navigateWithPermission(item.id);
                        setMenuExtraAberto(false);
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <div className="mobile-nav-option-icon">
                        <Icone size={16} aria-hidden="true" />
                      </div>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{group.title}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Modal>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        tone={confirmState.tone}
        onCancel={() => fecharConfirmacao(false)}
        onConfirm={() => fecharConfirmacao(true)}
      />
    </div>
  );
}
