import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Componentes da UI
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import ConfirmModal from './components/ConfirmModal';
import AppHeader from './components/AppHeader';
import LoginPage from './pages/LoginPage';
import RotaProtegida from './components/RotaProtegida';
import MobileBottomNav from './components/MobileBottomNav';
import MobileFab from './components/MobileFab';
import Modal from './components/ui/Modal';
import Button from './components/ui/Button';

// Dados e Utilitários
import { initialDb } from './data/mockData';
import { buildAlerts } from './utils/alerts'; // Alertas legados
import {
  gerarAlertasCalendario,
  gerarAlertasEstoque,
  gerarAlertasLote,
  gerarAlertasPesagem,
  ordenarAlertas,
} from './domain/alertas'; // Novos alertas de domínio
import { supabase } from './lib/supabase';
import { useAuth } from './auth/useAuth';
import { permissoesPorPagina } from './auth/perfis';
import {
  registrarEntradaAnimal,
  registrarEntradaEstoque,
  registrarSaidaAnimal,
  registrarSaidaEstoque,
} from './services/movimentacoes';
import { useToast } from './hooks/useToast';

// Estilos
import './styles/app.css';
import './styles/ui.css';

// Carregamento lazy das páginas
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

// Mapeamento de páginas para carregamento dinâmico
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

// Variantes de animação para transição de página
const pageTransitionVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -15 },
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  // Estado do banco de dados simulado, inicializado com dados mock e tratamento de valores padrão
  const [db, setDb] = useState(() => ({
    ...initialDb,
    alertas_resolvidos: Array.isArray(initialDb?.alertas_resolvidos)
      ? initialDb.alertas_resolvidos
      : [],
    funcionarios: Array.isArray(initialDb?.funcionarios)
      ? initialDb.funcionarios
      : [],
    lotes: Array.isArray(initialDb?.lotes)
      ? initialDb.lotes.map((lote) => ({
          ...lote,
          status: lote?.status || 'ativo',
          data_encerramento: lote?.data_encerramento || null,
          data_venda: lote?.data_venda || null,
        }))
      : [],
    fazendas: Array.isArray(initialDb?.fazendas)
      ? initialDb.fazendas
      : [],
    tarefas: Array.isArray(initialDb?.tarefas)
      ? initialDb.tarefas
      : [],
    configuracoes: initialDb?.configuracoes || {
      geral: {
        nome_sistema: 'HERDON',
        moeda: 'BRL',
        formato_data: 'DD/MM/AAAA',
        unidade_peso: 'kg',
        rendimento_carcaca_padrao: 52,
        preco_arroba_padrao: 290,
      },
      notificacoes: {
        estoque_critico: true,
        sanitario_vencido: true,
        pesagem_atrasada: true,
        lote_data_saida: true,
        dias_antecedencia: 3,
      },
    },
    usuarios: Array.isArray(initialDb?.usuarios) ? initialDb.usuarios : [],
  }));

  const { toasts, showToast, removeToast } = useToast(); // Hook para gerenciar toasts
  const { session, user, loadingAuth, hasPermission } = useAuth(); // Hook de autenticação
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [menuExtraAberto, setMenuExtraAberto] = useState(false); // Estado para menu mobile extra
  const [tabAtiva, setTabAtiva] = useState('geral'); // Estado para abas em algumas páginas
  const [fazendaSelecionada, setFazendaSelecionada] = useState(null); // Fazenda atualmente selecionada
  const [forcarTelaLogin, setForcarTelaLogin] = useState(false); // Força a exibição da tela de login
  // Estado para o modal de confirmação genérico
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    tone: 'danger',
    resolver: null, // Função para resolver a Promise do confirm
  });

  // Efeito para substituir window.alert por toasts personalizados
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => {
      const texto = String(message || '');
      const lower = texto.toLowerCase();
      const type = lower.includes('sucesso')
        ? 'success'
        : lower.includes('erro') || lower.includes('insuficiente')
          ? 'error'
          : 'warning';
      showToast({ type, message: texto });
    };

    return () => {
      window.alert = originalAlert; // Restaura o alert original ao desmontar
    };
  }, [showToast]);

  // Efeito para atualizar o usuário logado quando o `user` do Supabase muda
  useEffect(() => {
    if (!user) {
      setUsuarioLogado(null);
      return;
    }

    setForcarTelaLogin(false); // Garante que a tela de login não é forçada se há um usuário

    setUsuarioLogado((prev) => ({
      id: user.id || prev?.id || null,
      nome: prev?.nome || user?.user_metadata?.name || user?.user_metadata?.nome || user?.email?.split('@')[0] || 'Usuário',
      email: user.email || prev?.email || '',
      perfil: prev?.perfil || user?.user_metadata?.perfil || 'visualizador',
      foto_url: prev?.foto_url ?? user?.user_metadata?.avatar_url ?? null,
    }));
  }, [user]);

  // Efeito para gerenciar a fazenda selecionada
  useEffect(() => {
    const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
    if (!fazendas.length) {
      setFazendaSelecionada(null);
      return;
    }

    setFazendaSelecionada((prev) => {
      // Se já houver uma fazenda selecionada e ela ainda existir na lista, mantém
      if (prev && fazendas.some((f) => Number(f.id) === Number(prev.id))) {
        return fazendas.find((f) => Number(f.id) === Number(prev.id));
      }
      // Caso contrário, seleciona a primeira fazenda
      return fazendas[0];
    });
  }, [db?.fazendas]);

  // Memoiza o banco de dados filtrado pela fazenda selecionada para o Dashboard
  const dbDashboard = useMemo(() => {
    if (!fazendaSelecionada?.id) return db; // Se nenhuma fazenda selecionada, retorna o DB completo

    // Filtra lotes pela fazenda selecionada
    const loteIds = new Set((db.lotes || []).filter((l) => Number(l.faz_id) === Number(fazendaSelecionada.id)).map((l) => l.id));

    return {
      ...db,
      lotes: (db.lotes || []).filter((l) => loteIds.has(l.id)),
      animais: (db.animais || []).filter((a) => loteIds.has(a.lote_id)),
      custos: (db.custos || []).filter((c) => loteIds.has(c.lote_id)),
      pesagens: (db.pesagens || []).filter((p) => loteIds.has(p.lote_id)),
      sanitario: (db.sanitario || []).filter((s) => loteIds.has(s.lote_id)),
      // Tarefas podem ser por fazenda ou por lote
      tarefas: (db.tarefas || []).filter((t) => !t.fazenda_id || Number(t.fazenda_id) === Number(fazendaSelecionada.id) || loteIds.has(t.lote_id)),
      movimentacoes_animais: (db.movimentacoes_animais || []).filter((m) => loteIds.has(m.lote_id)),
    };
  }, [db, fazendaSelecionada]);

  // Função para atualizar os dados do usuário logado
  function atualizarUsuario(dadosAtualizados) {
    setUsuarioLogado((prev) => {
      const base = prev || {
        id: user?.id || null,
        nome: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário',
        email: user?.email || '',
        perfil: user?.user_metadata?.perfil || 'visualizador',
        foto_url: user?.user_metadata?.avatar_url || null,
      };
      const atualizado = { ...base, ...dadosAtualizados, foto_url: dadosAtualizados?.foto_url ?? base.foto_url ?? null };
      // Armazena no localStorage para persistência básica
      localStorage.setItem('herdon_usuario', JSON.stringify(atualizado));
      return atualizado;
    });
  }

  // Função para lidar com o logout do usuário
  async function handleLogout() {
    setForcarTelaLogin(true); // Força a tela de login
    setUsuarioLogado(null);
    // Limpa dados de sessão e autenticação
    localStorage.removeItem('herdon_usuario');
    localStorage.removeItem('herdon_user');
    localStorage.removeItem('herdon_token');
    sessionStorage.clear();
    try {
      await supabase.auth.signOut(); // Chama o logout do Supabase
    } catch (error) {
      console.error('Erro ao finalizar sessão:', error);
    }
    setCurrentPage('dashboard'); // Redireciona para o dashboard após logout
  }

  // Extrai alertas resolvidos do DB
  const alertasResolvidos = Array.isArray(db?.alertas_resolvidos)
    ? db.alertas_resolvidos
    : [];

  // Memoiza a geração de alertas brutos (não filtrados por resolvidos)
  const rawAlerts = useMemo(() => {
    const legacy = buildAlerts(db); // Alertas gerados pelo utilitário antigo
    const auto = [ // Novos alertas gerados por domínio
      ...gerarAlertasEstoque(db),
      ...gerarAlertasCalendario(db),
      ...gerarAlertasPesagem(db),
      ...gerarAlertasLote(db),
    ];
    return ordenarAlertas([...legacy, ...auto]); // Combina e ordena todos os alertas
  }, [db]);

  // Memoiza os alertas filtrados (apenas os não resolvidos)
  const alerts = useMemo(() => {
    return rawAlerts.filter(
      (alert) => !alertasResolvidos.includes(alert.ackKey || alert.id)
    );
  }, [rawAlerts, alertasResolvidos]);

  // Função para marcar um alerta como resolvido
  function marcarAlertaComoFeito(alert) {
    const chave = alert?.ackKey || alert?.id;
    if (!chave) return;

    setDb((prev) => ({
      ...prev,
      alertas_resolvidos: Array.from(
        new Set([...(prev?.alertas_resolvidos || []), chave]) // Adiciona a chave aos alertas resolvidos
      ),
    }));
  }

  // Contexto do usuário para funções de movimentação
  const userContext = { id: user?.id || null, email: user?.email || '' };

  // Handlers para registrar movimentações, atualizando o estado do DB
  const handleRegistrarEntradaAnimal = (dados) =>
    setDb((prev) => registrarEntradaAnimal(prev, dados, userContext));

  const handleRegistrarSaidaAnimal = (dados) =>
    setDb((prev) => registrarSaidaAnimal(prev, dados, userContext));

  const handleRegistrarEntradaEstoque = (dados) =>
    setDb((prev) => registrarEntradaEstoque(prev, dados, userContext));

  const handleRegistrarSaidaEstoque = (dados) =>
    setDb((prev) => registrarSaidaEstoque(prev, dados, userContext));

  // Função para abrir o modal de confirmação e retornar uma Promise
  const onConfirmAction = ({ title, message, tone = 'danger' }) =>
    new Promise((resolve) => {
      setConfirmState({
        open: true,
        title: title || 'Confirmar ação',
        message,
        tone,
        resolver: resolve, // Armazena a função resolve da Promise
      });
    });

  // Função para fechar o modal de confirmação e resolver a Promise
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

  // Lógica para verificar permissões de página
  const paginaValida = currentPage in pageMap;
  const permissaoAtual = permissoesPorPagina[currentPage] || null;
  const podeAcessarPaginaAtual = paginaValida && (!permissaoAtual || hasPermission(permissaoAtual));
  const pageKey = podeAcessarPaginaAtual ? currentPage : 'dashboard'; // Redireciona para dashboard se não tiver permissão
  const ActivePage = pageMap[pageKey] || DashboardPage; // Componente da página ativa
  const permissaoPaginaAtual = permissoesPorPagina[pageKey] || null; // Permissão da página ativa

  // Exibe tela de carregamento de autenticação
  if (loadingAuth) {
    return <div className="app-loading">Carregando...</div>;
  }

  // Exibe tela de login se for forçado ou não houver sessão
  if (forcarTelaLogin || !session) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      {/* Sidebar de navegação */}
      <Sidebar
        currentPage={pageKey}
        onNavigate={(pagina) => {
          const permissaoDestino = permissoesPorPagina[pagina];
          if (!permissaoDestino || hasPermission(permissaoDestino)) {
            setCurrentPage(pagina);
            return;
          }
          showToast({ type: 'error', message: 'Acesso não autorizado para esta área.' });
        }}
        alertCount={alerts.length}
        user={usuarioLogado}
        hasPermission={hasPermission}
        onSignOut={handleLogout}
      />

      <main className="main">
        {/* Cabeçalho da aplicação */}
        <AppHeader
          farmName={fazendaSelecionada?.nome || db?.fazendas?.[0]?.nome || 'Fazenda Atual'}
          notifications={alerts.length}
          alerts={alerts}
          onResolveAlert={marcarAlertaComoFeito}
          onSnoozeAlert={(alert) => showToast({ type: 'warning', message: `Alerta adiado: ${alert.title}` })}
          onAlertNavigate={(alert) => alert?.route && setCurrentPage(alert.route)}
          onSignOut={handleLogout}
          onNavigateProfile={() => setCurrentPage('perfil')}
          onNavigateSettings={() => setCurrentPage('configuracoes')}
          onConfirmAction={onConfirmAction}
          onOpenMenu={() => window.dispatchEvent(new CustomEvent('agrotrack-open-drawer'))}
          usuarioLogado={usuarioLogado}
          fazendas={db?.fazendas || []}
          fazendaSelecionada={fazendaSelecionada}
          onSelectFazenda={setFazendaSelecionada}
          tabAtiva={tabAtiva}
          onTabChange={setTabAtiva}
        />

        {/* Área de conteúdo principal com transições de página */}
        <AnimatePresence mode="wait">
          <motion.div
            key={pageKey}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={pageTransitionVariants}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="page-wrapper"
          >
            <Suspense fallback={<div className="skeleton-page"><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div>}>
              {/* Rota Protegida verifica permissões antes de renderizar a página */}
              <RotaProtegida permissao={permissaoPaginaAtual}>
                <ActivePage
                  db={pageKey === 'dashboard' ? dbDashboard : db} // DB filtrado para dashboard, completo para outras
                  setDb={setDb}
                  alerts={alerts}
                  onNavigate={setCurrentPage}
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Barra de navegação inferior para mobile */}
      <MobileBottomNav
        currentPage={pageKey}
        onNavigate={(pagina) => {
          const permissaoDestino = permissoesPorPagina[pagina];
          if (!permissaoDestino || hasPermission(permissaoDestino)) {
            setCurrentPage(pagina);
          }
        }}
        onOpenMore={() => setMenuExtraAberto(true)}
      />

      {/* Botão de ação flutuante para mobile */}
      <MobileFab page={pageKey} onAction={(acao) => showToast({ type: 'warning', message: `Ação rápida: ${acao}` })} />

      {/* Modal para "Mais opções" no mobile */}
      <Modal
        open={menuExtraAberto}
        onClose={() => setMenuExtraAberto(false)}
        title="Mais opções"
      >
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.keys(pageMap).map((pagina) => (
            <Button
              key={pagina}
              variant="outline"
              onClick={() => {
                const permissaoDestino = permissoesPorPagina[pagina];
                if (!permissaoDestino || hasPermission(permissaoDestino)) {
                  setCurrentPage(pagina);
                  setMenuExtraAberto(false);
                }
              }}
            >
              {pagina}
            </Button>
          ))}
        </div>
      </Modal>

      {/* Pilha de Toasts */}
      <div className="toast-stack">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>

      {/* Modal de Confirmação genérico */}
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
