import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import Button from './components/ui/Button';
import { useOperationalData } from './hooks/useOperationalData';
import { useToast } from './hooks/useToast';
import { useCloudControls } from './hooks/useCloudControls';
import { useOfflineQueueStatus } from './hooks/useOfflineQueueStatus';
import { useOfflineAutoSync } from './hooks/useOfflineAutoSync';
import {
  limparPersistenciaSessao,
  limparMarcadoresFluxoAuth,
  signOutLocalSafely,
} from './lib/supabase';
import { secondaryNavItems, navSections } from './navigation/navConfig';
import { getPageFromPathname, getRouteForPage } from './navigation/routes';
import {
  registrarEntradaAnimal,
  registrarEntradaEstoque,
  registrarSaidaAnimal,
  registrarSaidaEstoque,
} from './services/movimentacoes';
import {
  createOperationalRecord,
  getPendingSyncQueueSnapshot,
  processPendingSyncQueue,
} from './services/operationalPersistence';
import {
  getCurrentSubscription,
  canAccessModule,
  getModuleBlockedMessage,
} from './services/subscriptions';
import { buildAccountAccessGate, getWriteBlockedMessage } from './services/accessControl';
import { configureWriteAccess } from './services/writeGuard';
import { useAccountSubscription } from './hooks/useAccountSubscription';
import { obterResumoUso } from './domain/planos';
import { buildAlerts } from './utils/alerts';
import './styles/app.css';
import './styles/ui.css';
import './styles/layout.css';


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
const MinhaAssinaturaPage = lazy(() => import('./pages/MinhaAssinaturaPage'));
const ConfiguracoesPage = lazy(() => import('./pages/ConfiguracoesPage'));
const PastagensPage = lazy(() => import('./pages/PastagensPage'));
const EvolucaoRebanhoPage = lazy(() => import('./pages/EvolucaoRebanhoPage'));
const IndicadoresPage = lazy(() => import('./pages/IndicadoresPage'));
const CenariosPage = lazy(() => import('./pages/CenariosPage'));
const DashboardPremiumPage = lazy(() => import('./pages/DashboardPremiumPage'));
const RelatoriosGerenciaisPage = lazy(() => import('./pages/RelatoriosGerenciaisPage'));
const RelatoriosPage = lazy(() => import('./pages/RelatoriosPage'));
const RelatorioLotePage = lazy(() => import('./pages/RelatorioLotePage'));
const RelatorioPesagensPage = lazy(() => import('./pages/RelatorioPesagensPage'));
const RelatorioFinanceiroPage = lazy(() => import('./pages/RelatorioFinanceiroPage'));
const RelatorioPastagensPage = lazy(() => import('./pages/RelatorioPastagensPage'));
const RelatorioResumoGeralPage = lazy(() => import('./pages/RelatorioResumoGeralPage'));
const GuiaCriadorPage = lazy(() => import('./pages/GuiaCriadorPage'));
const PlanejamentoPage = lazy(() => import('./pages/PlanejamentoPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TermosPage = lazy(() => import('./pages/TermosPage'));
const PrivacidadePage = lazy(() => import('./pages/PrivacidadePage'));
const CobrancaPage = lazy(() => import('./pages/CobrancaPage'));
const SuportePage = lazy(() => import('./pages/SuportePage'));
const CustosCompartilhadosPage = lazy(() => import('./pages/CustosCompartilhadosPage'));
const FluxoCaixaPage = lazy(() => import('./pages/FluxoCaixaPage'));
const ImportacaoPage = lazy(() => import('./pages/ImportacaoPage'));
const SincronizacaoPage = lazy(() => import('./pages/SincronizacaoPage'));
const ModoCurralPage = lazy(() => import('./pages/ModoCurralPage'));

const publicPageMap = {
  termos: TermosPage,
  privacidade: PrivacidadePage,
  cobranca: CobrancaPage,
  suporte: SuportePage,
};

const TODAY_BOOT_ISO = new Date().toISOString().slice(0, 10);
const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para executar esta ação.';
const ALERTAS_RESOLVIDOS_STORAGE_KEY = 'herdon-alertas-resolvidos';
const ALERTAS_ADIADOS_STORAGE_KEY = 'herdon-alertas-adiados';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'herdon-sidebar-collapsed';

function getAlertAckKey(alert) {
  if (alert?.ackKey) return String(alert.ackKey);
  if (alert?.id) return String(alert.id);
  const tipo = String(alert?.type || alert?.tipo || alert?.category || 'geral').trim().toLowerCase();
  const titulo = String(alert?.title || alert?.titulo || '').trim().toLowerCase();
  const rota = String(alert?.route || alert?.rota || alert?.acao?.rota || alert?.pagina || 'dashboard').trim().toLowerCase();
  const referencia = String(
    alert?.date
    || alert?.data
    || alert?.dueDate
    || alert?.proxima
    || alert?.reference
    || alert?.referencia
    || ''
  ).slice(0, 10);
  return `${tipo}-${titulo}-${rota}-${referencia}`;
}

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
  } catch {
    // storage indisponivel
  }
}

function normalizeResolvedAlertEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.chave || item.ackKey || item.id || null;
      return null;
    })
    .filter(Boolean)
    .map((item) => String(item));
}

function normalizeSnoozedAlertEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return null;
      const chave = item.chave || item.ackKey || item.id || null;
      const ate = item.ate || item.snoozeUntil || null;
      if (!chave || !ate) return null;
      return {
        chave: String(chave),
        ate: String(ate),
        snoozeUntil: String(item.snoozeUntil || ate),
      };
    })
    .filter(Boolean);
}

function readSidebarCollapsedState() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

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
  minhaAssinatura: MinhaAssinaturaPage,
  configuracoes: ConfiguracoesPage,
  animais: AnimaisPage,
  suplementacao: SuplementacaoPage,
  sanitario: SanitarioPage,
  estoque: EstoquePage,
  pesagens: PesagensPage,
  acompanhamentoPeso: AcompanhamentoPesoPage,
  custos: CustosPage,
  fluxoCaixa: FluxoCaixaPage,
  custosCompartilhados: CustosCompartilhadosPage,
  resultados: ResultadosPage,
  financeiro: FinanceiroPage,
  pastagens: PastagensPage,
  evolucaoRebanho: EvolucaoRebanhoPage,
  indicadores: IndicadoresPage,
  cenarios: CenariosPage,
  dashboardPremium: DashboardPremiumPage,
  relatoriosGerenciais: RelatoriosGerenciaisPage,
  relatorios: RelatoriosPage,
  relatorioLote: RelatorioLotePage,
  relatorioPesagens: RelatorioPesagensPage,
  relatorioFinanceiro: RelatorioFinanceiroPage,
  relatorioPastagens: RelatorioPastagensPage,
  relatorioResumoGeral: RelatorioResumoGeralPage,
  guiaCriador: GuiaCriadorPage,
  planejamento: PlanejamentoPage,
  importacao: ImportacaoPage,
  sincronizacao: SincronizacaoPage,
  modoCurral: ModoCurralPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState(() => getPageFromPathname(window.location.pathname));
  const [navigationIntent, setNavigationIntent] = useState(null);
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
    lastSyncAt,
    manualSyncInFlight,
    syncNow,
  } = useOperationalData(session, {
    enabled: Boolean(session?.user?.id) && !loadingAuth,
  });
  const accountSubscriptionState = useAccountSubscription(session, {
    enabled: Boolean(session?.user?.id) && !loadingAuth,
  });
  const currentSubscription = useMemo(
    () => accountSubscriptionState.subscription || getCurrentSubscription({ session, user, db }),
    [accountSubscriptionState.subscription, session, user, db]
  );
  const subscriptionGate = useMemo(
    () => buildAccountAccessGate(currentSubscription, {
      user,
      subscriptionLoadError: accountSubscriptionState.error,
    }),
    [currentSubscription, user, accountSubscriptionState.error]
  );
  const subscriptionUsage = useMemo(
    () => obterResumoUso(db, currentSubscription).uso,
    [db, currentSubscription]
  );
  // Paywall de escrita: o usuário SEMPRE entra e visualiza o app; só a gravação
  // exige plano ativo. `podeEscrever` reaproveita o gate de conta.
  const podeEscrever = !subscriptionGate.blocked;
  const writeBlockedRef = useRef(null);
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [menuExtraAberto, setMenuExtraAberto] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readSidebarCollapsedState());
  const [tabAtiva, setTabAtiva] = useState('geral');
  const [fazendaSelecionada, setFazendaSelecionada] = useState(null);
  const [forcarTelaLogin, setForcarTelaLogin] = useState(false);
  const [showBootRecovery, setShowBootRecovery] = useState(false);
  const [cloudDiagnosticState, setCloudDiagnosticState] = useState({ verified: false, checkedAt: null, message: '' });
  const [pendingSyncState, setPendingSyncState] = useState(() => getPendingSyncQueueSnapshot(session));
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'danger',
    resolver: null,
  });
  const deniedToastRef = useRef({ permission: '', timestamp: 0 });
  const cloudControls = useCloudControls({ db, setDb, session, hasPermission, showToast, dismissToast: removeToast, forceLocalSignOut });
  const offlineQueueStatus = useOfflineQueueStatus(session);
  useOfflineAutoSync(session, setDb);
  const showAuthDebug = useMemo(() => {
    try {
      return localStorage.getItem('HERDON_SHOW_AUTH_DEBUG') === 'true';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(sidebarCollapsed));
    } catch {
      // Preferimos manter a UI funcionando mesmo se o storage falhar.
    }
  }, [sidebarCollapsed]);

  // Mantém o serviço central de persistência sabendo se a conta pode gravar.
  // Um ref guarda o handler de redirecionamento sempre atualizado, evitando
  // closures obsoletas quando perfil/assinatura mudam.
  useEffect(() => {
    configureWriteAccess({
      canWrite: podeEscrever,
      reason: subscriptionGate.reason,
      onBlockedWrite: (payload) => writeBlockedRef.current?.(payload),
    });
  }, [podeEscrever, subscriptionGate.reason]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPathname(window.location.pathname));
      setNavigationIntent(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const isBootLoading = loadingAuth
    || (Boolean(session?.user?.id) && !dataReady)
    || (Boolean(session?.user?.id) && !accountSubscriptionState.loaded);
  const isOperationalSyncing = Boolean(session) && (dataSource === 'syncing' || manualSyncInFlight);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const pendingCount = Number(pendingSyncState?.pendingCount || 0);
    const cloudStatus = isOperationalSyncing
      ? 'syncing'
      : pendingCount > 0
        ? 'pending'
        : (dataSource === 'supabase' ? 'active' : 'local');
    console.debug('[HERDON_CLOUD_RUNTIME]', {
      hasSession: Boolean(session),
      hasUserId: Boolean(session?.user?.id),
      envReady: true,
      dataSource: dataSource || null,
      cloudStatus,
      pendingCount,
      syncStatus: cloudStatus === 'active' ? 'cloud_success' : (cloudStatus === 'pending' ? 'pending_sync' : 'local_only'),
      code: dataError?.name || null,
    });
  }, [session, dataSource, dataError, pendingSyncState?.pendingCount, isOperationalSyncing]);

  useEffect(() => {
    if (!isBootLoading) {
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
    const timer = window.setTimeout(() => {
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
    }, 0);

    return () => window.clearTimeout(timer);
  }, [forcarTelaLogin, user]);

  useEffect(() => {
    let retryTimer = null;

    function refreshPendingState() {
      setPendingSyncState(getPendingSyncQueueSnapshot(session));
    }

    async function runRetry() {
      if (!session?.user?.id) return;
      await processPendingSyncQueue(session, { maxItems: 20 });
      refreshPendingState();
    }

    function scheduleRetry(delayMs = 3000) {
      if (retryTimer) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        void runRetry();
      }, delayMs);
    }

    function handlePendingUpdated() {
      refreshPendingState();
      scheduleRetry(5000);
    }

    function handleOnline() {
      scheduleRetry(3000);
    }

    function handleDiagnostic(event) {
      if (event?.detail?.verified) {
        scheduleRetry(3000);
      }
    }

    refreshPendingState();
    if (session?.user?.id) scheduleRetry(3000);
    window.addEventListener('herdon-pending-sync-updated', handlePendingUpdated);
    window.addEventListener('online', handleOnline);
    window.addEventListener('herdon-cloud-diagnostic-state', handleDiagnostic);
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      window.removeEventListener('herdon-pending-sync-updated', handlePendingUpdated);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('herdon-cloud-diagnostic-state', handleDiagnostic);
    };
  }, [session?.user?.id, session]);


  useEffect(() => {
    function handleCloudDiagnosticState(event) {
      const detail = event?.detail || {};
      setCloudDiagnosticState({
        verified: Boolean(detail?.verified),
        checkedAt: Number(detail?.checkedAt) || Date.now(),
        message: String(detail?.message || ''),
      });
    }

    window.addEventListener('herdon-cloud-diagnostic-state', handleCloudDiagnosticState);
    return () => window.removeEventListener('herdon-cloud-diagnostic-state', handleCloudDiagnosticState);
  }, []);


  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    }, 0);

    return () => window.clearTimeout(timer);
  }, [db?.fazendas]);

  const dbDashboard = useMemo(() => {
    if (!fazendaSelecionada?.id) {
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
    setCurrentPage('dashboard');
    limparPersistenciaSessao();

    if (import.meta.env.DEV) {
      console.debug('[HERDON_LOGOUT_BOOT]', {
        stage: 'local_logout_completed',
        localCleanupDone: true,
      });
    }

    void signOutLocalSafely().catch(() => null);
    limparMarcadoresFluxoAuth();
    window.location.replace('/');
  }

  async function handleClearSessionAndReload() {
    forceLocalSignOut();
    limparPersistenciaSessao();
    limparMarcadoresFluxoAuth();
    void signOutLocalSafely().catch(() => null);
    window.location.replace('/');
  }

  const alertasResolvidos = useMemo(
    () => (Array.isArray(db?.alertas_resolvidos) ? db.alertas_resolvidos : []),
    [db]
  );
  const alertasAdiados = useMemo(
    () => (Array.isArray(db?.alertas_adiados) ? db.alertas_adiados : []),
    [db]
  );

  const resolvedAlertKeys = useMemo(() => {
    const storageKeys = normalizeResolvedAlertEntries(readJsonStorage(ALERTAS_RESOLVIDOS_STORAGE_KEY, []));
    const dbKeys = normalizeResolvedAlertEntries(alertasResolvidos);
    return new Set([...storageKeys, ...dbKeys]);
  }, [alertasResolvidos]);

  const snoozedAlerts = useMemo(() => {
    const storageEntries = normalizeSnoozedAlertEntries(readJsonStorage(ALERTAS_ADIADOS_STORAGE_KEY, []));
    const dbEntries = normalizeSnoozedAlertEntries(alertasAdiados);
    const merged = new Map();
    [...storageEntries, ...dbEntries].forEach((item) => {
      if (!item?.chave) return;
      merged.set(item.chave, item);
    });
    return Array.from(merged.values());
  }, [alertasAdiados]);

  const rawAlerts = useMemo(() => {
    return buildAlerts(db).map((alert) => ({
      ...alert,
      route: alert?.pagina || null,
      ackKey: getAlertAckKey(alert),
    }));
  }, [db]);

  const alerts = useMemo(
    () => rawAlerts.filter((alert) => {
      const chave = getAlertAckKey(alert);
      if (resolvedAlertKeys.has(chave)) return false;
      const adiado = snoozedAlerts.find((item) => item?.chave === chave);
      const ate = adiado?.ate || adiado?.snoozeUntil || null;
      if (!ate) return true;
      return String(ate) < TODAY_BOOT_ISO;
    }),
    [rawAlerts, resolvedAlertKeys, snoozedAlerts]
  );

  function logAlertAction(action, ackKey, beforeCount, afterCount) {
    if (!import.meta.env.DEV) return;
    console.info('[HERDON_ALERT_ACTION]', {
      action,
      ackKey,
      beforeCount,
      afterCount,
    });
  }

  async function marcarAlertaComoFeito(alert) {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    const chave = getAlertAckKey(alert);
    if (!chave) {
      return;
    }

    const beforeCount = alerts.length;
    setDb((prev) => {
      const atuais = normalizeResolvedAlertEntries(prev?.alertas_resolvidos || []);
      return {
        ...prev,
        alertas_resolvidos: Array.from(new Set([...atuais, chave])),
      };
    });
    const atuaisStorage = normalizeResolvedAlertEntries(readJsonStorage(ALERTAS_RESOLVIDOS_STORAGE_KEY, []));
    writeJsonStorage(ALERTAS_RESOLVIDOS_STORAGE_KEY, Array.from(new Set([...atuaisStorage, chave])));
    logAlertAction('resolver', chave, beforeCount, Math.max(beforeCount - 1, 0));
    showToast({ type: 'success', message: 'Notificação resolvida.' });

    const persisted = await createOperationalRecord('alertas_resolvidos', {
      chave,
      resolvedAt: new Date().toISOString(),
      origem: 'header_notificacoes',
    }, session);
    setDb((prev) => ({
      ...prev,
      alertas_resolvidos: Array.from(new Set([...normalizeResolvedAlertEntries(prev?.alertas_resolvidos || []), chave])),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Alerta resolvido apenas localmente.' });
    }
  }

  async function adiarAlerta(alert, opcao = '1') {
    if (!hasPermission('tarefas:editar')) {
      showToast({ type: 'error', message: MENSAGEM_SEM_PERMISSAO });
      return;
    }
    const chave = getAlertAckKey(alert);
    if (!chave) return;
    const ate = parseSnoozeDate(opcao);
    if (!ate) {
      showToast({ type: 'warning', message: 'Data inválida para adiamento.' });
      return;
    }
    const payload = { chave, ate, snoozeUntil: ate };
    const beforeCount = alerts.length;
    setDb((prev) => ({
      ...prev,
      alertas_adiados: [
        ...normalizeSnoozedAlertEntries(prev?.alertas_adiados || []).filter((item) => item?.chave !== chave),
        payload,
      ],
    }));
    const storageAtual = normalizeSnoozedAlertEntries(readJsonStorage(ALERTAS_ADIADOS_STORAGE_KEY, []))
      .filter((item) => item?.chave !== chave);
    writeJsonStorage(ALERTAS_ADIADOS_STORAGE_KEY, [...storageAtual, payload]);
    logAlertAction('adiar', chave, beforeCount, Math.max(beforeCount - 1, 0));
    showToast({ type: 'success', message: 'Lembrete adiado.' });
    const persisted = await createOperationalRecord('alertas_adiados', {
      ...payload,
      origem: 'header_notificacoes',
    }, session);
    if (!persisted.persisted) showToast({ type: 'warning', message: 'Lembrete adiado apenas localmente.' });
  }

  const userContext = { id: user?.id || null, email: user?.email || '' };
  const persistContext = {
    session,
    persist: true,
    onWarning: (message) => showToast({ type: 'warning', message: message || 'Operação salva parcialmente apenas localmente.' }),
  };

  function navigateWithPermission(pagina, intent = null) {
    const permissaoDestino = permissoesPorPagina[pagina];
    if (!permissaoDestino || hasPermission(permissaoDestino)) {
      if (!canAccessModule(currentSubscription, pagina)) {
        showToast({
          type: 'warning',
          message: getModuleBlockedMessage(),
        });
        return false;
      }
      setCurrentPage(pagina);
      setNavigationIntent(intent ? { ...intent, page: pagina, at: Date.now() } : null);
      const nextRoute = getRouteForPage(pagina);
      if (nextRoute && window.location.pathname !== nextRoute) {
        window.history.pushState({}, '', nextRoute);
      }
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

  // Paywall central: chamado quando uma gravação é barrada (pelo serviço de
  // persistência ou por um botão guardado). Proprietário vai para a página de
  // planos; subusuário é orientado a acionar o dono da conta.
  function handleWriteBlocked(info = {}) {
    const podeGerenciarAssinatura = hasPermission('assinatura:gerenciar');
    if (podeGerenciarAssinatura) {
      showToast({ type: 'warning', message: getWriteBlockedMessage() });
      navigateWithPermission('minhaAssinatura', { reason: 'write_blocked', feature: info?.feature || null });
      return;
    }
    showToast({
      type: 'warning',
      message: 'Para salvar dados, peça ao proprietário da conta para ativar um plano.',
    });
  }
  useEffect(() => {
    writeBlockedRef.current = handleWriteBlocked;
  });

  // Guarda de escrita para uso na UI (ações rápidas / botões "Novo"): retorna
  // false e redireciona quando a conta está em modo visualização.
  function ensureCanWriteOrRedirect(feature = null) {
    if (podeEscrever) return true;
    handleWriteBlocked({ feature });
    return false;
  }

  const handleRegistrarEntradaAnimal = (dados) => {
    if (!ensureCanWriteOrRedirect('animais.create')) return;
    setDb((prev) => registrarEntradaAnimal(prev, dados, userContext, persistContext));
  };
  const handleRegistrarSaidaAnimal = (dados) => {
    if (!ensureCanWriteOrRedirect('animais.saida')) return;
    setDb((prev) => registrarSaidaAnimal(prev, dados, userContext, persistContext));
  };
  const handleRegistrarEntradaEstoque = (dados) => {
    if (!ensureCanWriteOrRedirect('estoque.create')) return;
    setDb((prev) => registrarEntradaEstoque(prev, dados, userContext));
  };
  const handleRegistrarSaidaEstoque = (dados) => {
    if (!ensureCanWriteOrRedirect('estoque.saida')) return;
    setDb((prev) => registrarSaidaEstoque(prev, dados, userContext));
  };

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

  function handleMobileQuickAction(acao) {
    const action = String(acao || '').toLowerCase();

    // Ação rápida = intenção de criar. Sem plano ativo, redireciona direto
    // para assinatura (Parte 7 do escopo), em vez de abrir o fluxo de cadastro.
    if (!ensureCanWriteOrRedirect(`quick_action.${action}`)) {
      return;
    }

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
          <strong>Estamos carregando seus dados.</strong>
          <p>
            {dataError?.message || 'Aguarde um instante enquanto preparamos seu ambiente.'}
          </p>
          <div className="app-loading-bars" aria-hidden="true">
            <span className="app-loading-bar" />
            <span className="app-loading-bar" />
            <span className="app-loading-bar" />
          </div>
          {showBootRecovery ? (
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              <strong>O carregamento está demorando mais que o normal.</strong>
              <p>Você pode tentar novamente ou entrar novamente para continuar.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="ui-button ui-button--outline ui-button--sm" onClick={() => window.location.reload()}>
                  Tentar novamente
                </button>
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={handleClearSessionAndReload}>
                  Entrar novamente
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (Object.prototype.hasOwnProperty.call(publicPageMap, currentPage)) {
    const PublicPage = publicPageMap[currentPage];
    return (
      <Suspense fallback={<div className="app-loading">Carregando...</div>}>
        <PublicPage />
      </Suspense>
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
    <div className={`app app-shell ${sidebarCollapsed ? 'app-shell--sidebar-collapsed' : ''}`}>
      {showAuthDebug && session ? (
        <div
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            zIndex: 9999,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(17,24,39,0.9)',
            color: '#f9fafb',
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            maxWidth: 320,
          }}
        >
          Debug Auth: perfil={user?.perfil || 'visualizador'} fonte={user?.roleSource || 'fallback'} email={user?.email || 'sem-email'}
        </div>
      ) : null}
      <Sidebar
        currentPage={pageKey}
        onNavigate={navigateWithPermission}
        alertCount={alerts.length}
        user={usuarioLogado}
        hasPermission={hasPermission}
        onSignOut={handleLogout}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <main className={`main${['lotes', 'estoque', 'financeiro'].includes(pageKey) ? ' main-has-fab' : ''}`}>
        {!podeEscrever ? (
          <div
            style={{
              margin: '0 16px 16px',
              padding: '16px',
              borderRadius: 16,
              border: '1px solid rgba(37, 99, 235, 0.22)',
              background: 'linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(255, 255, 255, 0.96))',
              boxShadow: '0 14px 30px rgba(15, 23, 42, 0.06)',
              display: 'grid',
              gap: 10,
            }}
          >
            <strong style={{ fontSize: 15, color: 'var(--color-text)' }}>
              Você está em modo visualização.
            </strong>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Explore o HERDON à vontade. Para cadastrar, salvar ou editar dados da fazenda, escolha um plano.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {hasPermission('assinatura:gerenciar') ? (
                <Button type="button" variant="primary" size="sm" onClick={() => navigateWithPermission('minhaAssinatura', { reason: 'view_mode' })}>
                  Escolher plano
                </Button>
              ) : (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  Peça ao proprietário da conta para ativar um plano.
                </span>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                Sair da conta
              </Button>
            </div>
          </div>
        ) : null}
        {subscriptionGate.warning ? (
          <div
            style={{
              margin: '0 16px 16px',
              padding: '16px',
              borderRadius: 16,
              border: '1px solid rgba(245, 158, 11, 0.25)',
              background: 'linear-gradient(180deg, rgba(255, 247, 237, 0.96), rgba(255, 255, 255, 0.96))',
              boxShadow: '0 14px 30px rgba(15, 23, 42, 0.06)',
              display: 'grid',
              gap: 10,
            }}
          >
            <strong style={{ fontSize: 15, color: 'var(--color-text)' }}>{subscriptionGate.message}</strong>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Regularize sua assinatura para continuar usando o HERDON.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Button type="button" variant="outline" size="sm" onClick={() => navigateWithPermission('minhaAssinatura')}>
                Ver minha assinatura
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
                Sair da conta
              </Button>
            </div>
          </div>
        ) : null}
        <AppHeader
          currentPage={pageKey}
          farmName={fazendaSelecionada?.nome || db?.fazendas?.[0]?.nome || 'Fazenda Atual'}
          notifications={alerts.length}
          alerts={alerts}
          syncStatus={{
            dataSource,
            dataError,
            dataReady,
            isSyncing: isOperationalSyncing,
            lastSyncAt,
            pendingCount: pendingSyncState?.pendingCount || 0,
            schemaErrorTables: pendingSyncState?.schemaErrorTables || [],
            onSyncNow: cloudControls.sincronizarNuvem || syncNow,
            onTestCloud: cloudControls.testarConexaoNuvem,
            onReconnectCloud: cloudControls.reconectarNuvem,
            syncingCloud: cloudControls.sincronizandoNuvem,
            testingCloud: cloudControls.diagnosticandoNuvem,
            reconnectingCloud: cloudControls.reconectandoNuvem,
            cloudVerified: cloudDiagnosticState.verified,
            cloudVerifiedAt: cloudDiagnosticState.checkedAt,
            cloudVerifiedMessage: cloudDiagnosticState.message,
            offlineOnline: offlineQueueStatus.online,
            offlinePendentes: offlineQueueStatus.pendentes,
          }}
          hideSyncTechnicalStatus
          onResolveAlert={marcarAlertaComoFeito}
          onSnoozeAlert={adiarAlerta}
          onAlertNavigate={(alert) => {
            const route = alert?.route || alert?.rota || alert?.acao?.rota || alert?.pagina || null;
            if (route) {
              navigateWithPermission(route);
              return;
            }
            showToast({ type: 'info', message: 'Não há destino configurado para este alerta.' });
          }}
          onSignOut={handleLogout}
          onNavigateProfile={() => navigateWithPermission('perfil')}
          onNavigateSettings={() => navigateWithPermission('configuracoes')}
          onOpenSincronizacao={() => navigateWithPermission('sincronizacao')}
          onConfirmAction={onConfirmAction}
          onOpenMenu={() => window.dispatchEvent(new CustomEvent('agrotrack-open-drawer'))}
          usuarioLogado={usuarioLogado}
          fazendas={db?.fazendas || []}
          fazendaSelecionada={fazendaSelecionada}
          onSelectFazenda={setFazendaSelecionada}
          tabAtiva={tabAtiva}
          onTabChange={setTabAtiva}
          getAlertAckKey={getAlertAckKey}
          alertDebugState={{ resolvedAlertKeys, snoozedAlerts }}
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
                  session={session}
                  fazendaSelecionada={fazendaSelecionada}
                  subscription={currentSubscription}
                  subscriptionUsage={subscriptionUsage}
                  navigationIntent={navigationIntent}
                  alerts={alerts}
                  onNavigate={navigateWithPermission}
                  onResolveAlert={marcarAlertaComoFeito}
                  onSnoozeAlert={adiarAlerta}
                  onAlertNavigate={(alert) => {
                    const route = alert?.route || alert?.rota || alert?.acao?.rota || alert?.pagina || null;
                    if (route) {
                      navigateWithPermission(route);
                      return;
                    }
                    showToast({ type: 'info', message: 'Não há destino configurado para este alerta.' });
                  }}
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

function parseSnoozeDate(option) {
  const clean = String(option || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const dias = Number(clean);
  if (![1, 3, 7].includes(dias)) return null;
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}
