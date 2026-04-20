import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import DashboardPage from './pages/DashboardPage';
import FazendasPage from './pages/FazendasPage';
import LotesPage from './pages/LotesPage';
import AnimaisPage from './pages/AnimaisPage';
import SuplementacaoPage from './pages/SuplementacaoPage';
import SanitarioPage from './pages/SanitarioPage';
import CustosPage from './pages/CustosPage';
import ResultadosPage from './pages/ResultadosPage';
import FinanceiroPage from './pages/FinanceiroPage';
import EstoquePage from './pages/EstoquePage';
import PesagensPage from './pages/PesagensPage';
import AcompanhamentoPesoPage from './pages/AcompanhamentoPesoPage';
import RotinaPage from './pages/RotinaPage';
import FuncionariosPage from './pages/FuncionariosPage';
import LoginPage from './pages/LoginPage';

import { initialDb } from './data/mockData';
import { buildAlerts } from './utils/alerts';
import { supabase } from './lib/supabase';
import {
  registrarEntradaAnimal,
  registrarEntradaEstoque,
  registrarSaidaAnimal,
  registrarSaidaEstoque,
} from './services/movimentacoes';
import { useToast } from './hooks/useToast';

import './styles/app.css';

const pageMap = {
  dashboard: DashboardPage,
  fazendas: FazendasPage,
  lotes: LotesPage,
  funcionarios: FuncionariosPage,
  rotina: RotinaPage,
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

const pageTransitionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [db, setDb] = useState(() => ({
    ...initialDb,
    alertas_resolvidos: Array.isArray(initialDb?.alertas_resolvidos)
      ? initialDb.alertas_resolvidos
      : [],
  }));
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { toasts, showToast, removeToast } = useToast();
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'danger',
    resolver: null,
  });

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Erro ao obter sessão:', error);
        }

        if (ativo) {
          setSession(data?.session ?? null);
          setLoadingAuth(false);
        }
      } catch (err) {
        console.error('Erro inesperado ao obter sessão:', err);

        if (ativo) {
          setSession(null);
          setLoadingAuth(false);
        }
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      setSession(sessionAtual ?? null);
      setLoadingAuth(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      const texto = String(message || '');
      const lower = texto.toLowerCase();
      const tipo = lower.includes('sucesso')
        ? 'success'
        : lower.includes('erro') || lower.includes('insuficiente')
          ? 'error'
          : 'warning';
      showToast({ type: tipo, message: texto });
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [showToast]);

  const user = session?.user ?? null;

  const alertasResolvidos = Array.isArray(db?.alertas_resolvidos)
    ? db.alertas_resolvidos
    : [];

  const rawAlerts = useMemo(() => buildAlerts(db), [db]);

  const alerts = useMemo(() => {
    return rawAlerts.filter(
      (alert) => !alertasResolvidos.includes(alert.ackKey || alert.id)
    );
  }, [rawAlerts, alertasResolvidos]);

  function marcarAlertaComoFeito(alert) {
    const chave = alert?.ackKey || alert?.id;
    if (!chave) return;

    setDb((prev) => ({
      ...prev,
      alertas_resolvidos: Array.from(
        new Set([...(prev?.alertas_resolvidos || []), chave])
      ),
    }));
  }

  const handleRegistrarEntradaAnimal = (dados) =>
    setDb((prev) => registrarEntradaAnimal(prev, dados));

  const handleRegistrarSaidaAnimal = (dados) =>
    setDb((prev) => registrarSaidaAnimal(prev, dados));

  const handleRegistrarEntradaEstoque = (dados) =>
    setDb((prev) => registrarEntradaEstoque(prev, dados));

  const handleRegistrarSaidaEstoque = (dados) =>
    setDb((prev) => registrarSaidaEstoque(prev, dados));

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

  const ActivePage = pageMap[currentPage] || DashboardPage;

  if (loadingAuth) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#061106',
          color: '#d9f7c8',
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        alertCount={alerts.length}
        user={user}
      />

      <main className="main">
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            style={{
              background: '#163016',
              color: '#dff9cc',
              border: '1px solid rgba(150,255,150,0.15)',
              borderRadius: 12,
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Sair
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageTransitionVariants}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="page-wrapper"
          >
            <ActivePage
              db={db}
              setDb={setDb}
              alerts={alerts}
              onNavigate={setCurrentPage}
              onResolveAlert={marcarAlertaComoFeito}
              onRegistrarEntradaAnimal={handleRegistrarEntradaAnimal}
              onRegistrarSaidaAnimal={handleRegistrarSaidaAnimal}
              onRegistrarEntradaEstoque={handleRegistrarEntradaEstoque}
              onRegistrarSaidaEstoque={handleRegistrarSaidaEstoque}
              onConfirmAction={onConfirmAction}
            />
          </motion.div>
        </AnimatePresence>
      </main>

      <div
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'grid',
          gap: 10,
          zIndex: 1400,
        }}
      >
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
