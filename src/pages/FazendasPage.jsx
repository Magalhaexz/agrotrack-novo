import { useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import { resetSupabaseAuthLocally, validateSupabaseSessionForCloud } from '../lib/supabase';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  getCloudSyncCooldownState,
  syncFazendasWithCloud,
  syncLotesWithCloud,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { runMinimalCloudDiagnostic } from '../services/supabaseDiagnostics';

export default function FazendasPage({ db, setDb, onConfirmAction }) {
  const { showToast, dismissToast } = useToast();
  const { hasPermission, session, user, forceLocalSignOut } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sincronizandoFazendas, setSincronizandoFazendas] = useState(false);
  const [diagnosticandoNuvem, setDiagnosticandoNuvem] = useState(false);
  const [reconectandoNuvem, setReconectandoNuvem] = useState(false);
  const loadingToastRef = useRef(null);
  const manualSyncRef = useRef({ inFlight: false, lastStartAt: 0 });
  const isAdmin = String(user?.perfil || '').toLowerCase() === 'admin' || hasPermission('configuracoes:editar');
  const podeVerDiagnostico = Boolean(import.meta.env.DEV || isAdmin);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  const lotesByFazendaMap = useMemo(() => {
    const map = new Map();
    lotes.forEach((lote) => {
      const fazendaId = Number(lote.faz_id);
      if (!map.has(fazendaId)) map.set(fazendaId, []);
      map.get(fazendaId).push(lote);
    });
    return map;
  }, [lotes]);

  const cards = useMemo(
    () => fazendas.map((fazenda) => ({
      ...fazenda,
      lotesVinculados: (lotesByFazendaMap.get(Number(fazenda.id)) || []).length,
    })),
    [fazendas, lotesByFazendaMap]
  );

  async function salvarFazenda(payload) {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    if (editando) {
      const persisted = await updateOperationalRecord('fazendas', editando.id, payload, session);
      setDb((prev) => ({
        ...prev,
        fazendas: prev.fazendas.map((f) =>
          f.id === editando.id ? { ...f, ...(persisted.data || payload) } : f
        ),
      }));
      if (!persisted.persisted) showToast({ type: 'warning', message: 'Alteração salva apenas localmente.' });
    } else {
      const persisted = await createOperationalRecord('fazendas', payload, session);
      setDb((prev) => ({
        ...prev,
        fazendas: [...prev.fazendas, persisted.data || { id: gerarNovoId(prev.fazendas), ...payload }],
      }));
      if (!persisted.persisted) showToast({ type: 'warning', message: 'Cadastro salvo apenas localmente.' });
    }
    setOpenModal(false);
    setEditando(null);
  }

  async function excluirFazenda(id) {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const fazenda = cards.find((f) => f.id === id);
    if (!fazenda) return;
    if (fazenda.lotesVinculados > 0) {
      alert('Não é possível excluir uma fazenda com lotes vinculados.');
      return;
    }
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
        title: 'Excluir fazenda',
        message: `Deseja realmente excluir a fazenda "${fazenda.nome}"?`,
        tone: 'danger',
      })
      : window.confirm(`Deseja realmente excluir a fazenda "${fazenda.nome}"?`);

    if (!confirmado) return;
    const persisted = await deleteOperationalRecord('fazendas', id, session);
    setDb((prev) => ({ ...prev, fazendas: prev.fazendas.filter((f) => f.id !== id) }));
    if (!persisted.persisted) showToast({ type: 'warning', message: 'Exclusão aplicada apenas localmente.' });
  }

  function traduzirStatusEtapa(step) {
    if (step === 'env_check') return 'Ambiente';
    if (step === 'rest_without_session') return 'REST sem sessão';
    if (step === 'session_check') return 'Sessão';
    if (step === 'rest_with_session') return 'REST com sessão';
    if (step === 'client_select') return 'Supabase client';
    return 'Diagnóstico';
  }

  function traduzirSessaoStatus(status) {
    if (status === 'valid') return 'OK';
    if (status === 'expired') return 'Expirada';
    if (status === 'invalid') return 'Inválida';
    if (status === 'refresh_failed') return 'Inválida';
    return 'Expirada';
  }

  function resumirFalha(item) {
    const status = item?.httpStatus ? String(item.httpStatus) : null;
    const code = item?.postgrestCode ? String(item.postgrestCode).toUpperCase() : null;
    const type = String(item?.failureType || '').toLowerCase();

    if (code === '42501' || type === 'rls') return `${status || code || 'erro'} / RLS`;
    if (code === '42703' || code === 'PGRST204') return `${code} / Coluna ausente`;
    if (code === 'PGRST205' || code === '42P01' || type === 'schema') return `${code || status || '404'} / Tabela ausente`;
    if (type === 'auth' || status === '401') return `${status || '401'} / Sessão inválida`;
    if (type === 'payload' || status === '400') return `${code || status || '400'} / Estrutura incompatível`;
    if (type === 'network_reset' || type === 'http2_protocol_error' || type === 'timeout') return 'Sem resposta / Rede';
    return `${code || status || 'erro'} / ${item?.safeMessage || 'Falha'}`;
  }

  async function executarDiagnosticoNuvem() {
    if (!podeVerDiagnostico || diagnosticandoNuvem) return;
    setDiagnosticandoNuvem(true);
    try {
      const result = await runMinimalCloudDiagnostic({ session, table: 'lotes', timeoutMs: 8000 });
      const steps = Array.isArray(result?.steps) ? result.steps : [];

      steps.forEach((item) => {
        if (item?.step === 'session_check') {
          showToast({
            type: item?.ok ? 'success' : 'warning',
            message: `Sessão: ${item?.ok ? 'OK' : traduzirSessaoStatus(item?.status)}`,
          });
          return;
        }

        if (item?.safeMessage === 'Bloqueado por sessão inválida') {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Bloqueado por sessão inválida`,
          });
          return;
        }

        if (!item?.ok) {
          showToast({
            type: 'warning',
            message: `${traduzirStatusEtapa(item?.step)}: Erro — ${resumirFalha(item)}`,
          });
          return;
        }

        showToast({
          type: item?.ok ? 'success' : 'warning',
          message: `${traduzirStatusEtapa(item?.step)}: ${item?.ok ? 'OK' : 'Erro'}`,
        });
      });

      showToast({
        type: result?.ok ? 'success' : 'warning',
        message: result?.conclusionMessage || 'Falha ao executar diagnóstico da nuvem.',
      });

      if (result?.conclusion === 'session_failure') {
        showToast({
          type: 'warning',
          message: 'Sessão expirada. Use Reconectar à nuvem para entrar novamente.',
        });
      }

      if (import.meta.env.DEV || isAdmin) {
        console.groupCollapsed('[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]');
        console.info({
          appOrigin: result?.appOrigin || window.location.origin,
          supabaseHost: result?.supabaseHost || null,
          envStatus: result?.envStatus || null,
          table: result?.table || 'lotes',
          steps: steps.map((item) => ({
            step: item?.step || null,
            table: item?.table || 'lotes',
            endpointPath: item?.endpointPath || null,
            httpStatus: item?.httpStatus ?? null,
            postgrestCode: item?.postgrestCode ?? null,
            failureType: item?.failureType ?? null,
            safeMessage: item?.safeMessage || null,
          })),
          safeMessage: result?.conclusionMessage || null,
        });
        if (result?.authState) {
          console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
            hasSession: Boolean(result.authState.hasSession),
            hasAccessToken: Boolean(result.authState.hasAccessToken),
            tokenLooksJwt: Boolean(result.authState.tokenLooksJwt),
            tokenExpired: Boolean(result.authState.tokenExpired),
            refreshAttempted: Boolean(result.authState.refreshAttempted),
            refreshSucceeded: Boolean(result.authState.refreshSucceeded),
            safeMessage: result?.conclusionMessage || 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
          });
        }
        const authFailureSteps = steps.filter(
          (item) => ['rest_with_session', 'client_select'].includes(item?.step) && !item?.ok
        );
        authFailureSteps.forEach((item) => {
          console.groupCollapsed('[HERDON_CLOUD_AUTH_REQUEST_DETAIL]');
          console.info({
            step: item?.step || null,
            table: item?.table || 'lotes',
            endpointPath: item?.endpointPath || null,
            httpStatus: item?.httpStatus ?? null,
            postgrestCode: item?.postgrestCode ?? null,
            failureType: item?.failureType ?? null,
            safeMessage: item?.safeMessage || null,
          });
          console.groupEnd();
        });
        console.groupEnd();
      }
    } catch (error) {
      showToast({ type: 'warning', message: 'Não foi possível executar o diagnóstico da nuvem.' });
      if (import.meta.env.DEV) {
        console.warn('[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]', {
          stage: 'diagnostic_exception',
          classification: 'unknown_error',
          errorName: error?.name || null,
          errorMessage: error?.message || null,
        });
      }
    } finally {
      setDiagnosticandoNuvem(false);
    }
  }

  async function reconectarNuvem() {
    if (sincronizandoFazendas || diagnosticandoNuvem || reconectandoNuvem) return;
    setReconectandoNuvem(true);
    try {
      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: false,
          remoteSignOutSkipped: true,
          safeMessage: 'Iniciando limpeza local da sessão Supabase.',
        });
      }

      resetSupabaseAuthLocally();
      forceLocalSignOut?.();

      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: true,
          remoteSignOutSkipped: true,
          safeMessage: 'Sessão local limpa com sucesso.',
        });
      }

      showToast({
        type: 'info',
        message: 'Sessão local limpa. Entre novamente para conectar à nuvem.',
      });
    } catch {
      if (import.meta.env.DEV || isAdmin) {
        console.warn('[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]', {
          action: 'reconnect',
          localCleanupStarted: true,
          localCleanupSucceeded: false,
          remoteSignOutSkipped: true,
          safeMessage: 'Falha ao limpar sessão local. Tentando manter o app utilizável.',
        });
      }
      forceLocalSignOut?.();
      showToast({
        type: 'warning',
        message: 'Sessão local limpa. Entre novamente para conectar à nuvem.',
      });
    } finally {
      setReconectandoNuvem(false);
    }
  }

  async function sincronizarFazendasComNuvem() {
    const now = Date.now();
    if (sincronizandoFazendas || manualSyncRef.current.inFlight) return;
    if (now - manualSyncRef.current.lastStartAt < 1200) return;
    manualSyncRef.current = { inFlight: true, lastStartAt: now };

    if (!session?.user?.id) {
      showToast({ type: 'warning', message: 'Faça login para sincronizar com a nuvem.' });
      manualSyncRef.current.inFlight = false;
      return;
    }

    const sessionValidation = await validateSupabaseSessionForCloud();
    if (!sessionValidation?.ok) {
      showToast({
        type: 'warning',
        message: 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
      });
      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_AUTH_DIAGNOSTIC]', {
          hasSession: Boolean(sessionValidation?.authState?.hasSession),
          hasAccessToken: Boolean(sessionValidation?.authState?.hasAccessToken),
          tokenLooksJwt: Boolean(sessionValidation?.authState?.tokenLooksJwt),
          tokenExpired: Boolean(sessionValidation?.authState?.tokenExpired),
          refreshAttempted: Boolean(sessionValidation?.authState?.refreshAttempted),
          refreshSucceeded: Boolean(sessionValidation?.authState?.refreshSucceeded),
          safeMessage: sessionValidation?.safeMessage || 'Sessão expirada. Entre novamente para sincronizar com a nuvem.',
        });
      }
      manualSyncRef.current.inFlight = false;
      return;
    }

    setSincronizandoFazendas(true);
    loadingToastRef.current = showToast({
      id: 'fazendas-sync-loading',
      type: 'info',
      message: 'Sincronizando fazendas e lotes...',
      persist: true,
    });

    try {
      showToast({ type: 'info', message: 'Fazendas: sincronizando...' });
      const fazendasSync = await syncFazendasWithCloud({ fazendas, session });

      showToast({ type: 'info', message: 'Lotes: sincronizando...' });
      const lotesSync = await syncLotesWithCloud({ lotes, session });

      if (Array.isArray(fazendasSync?.data) || Array.isArray(lotesSync?.data)) {
        setDb((prev) => ({
          ...prev,
          fazendas: Array.isArray(fazendasSync?.data) ? fazendasSync.data : prev.fazendas,
          lotes: Array.isArray(lotesSync?.data) ? lotesSync.data : prev.lotes,
        }));
      }

      if (fazendasSync?.status === 'success' && lotesSync?.status === 'success') {
        showToast({ type: 'success', message: 'Fazendas sincronizadas. Lotes sincronizados.' });
      } else if (fazendasSync?.status === 'success') {
        showToast({ type: 'warning', message: `Fazendas sincronizadas. Falha ao sincronizar lotes: ${lotesSync?.message || 'ver diagnóstico.'}` });
      } else if (lotesSync?.status === 'success') {
        showToast({ type: 'warning', message: `Fazendas: ${fazendasSync?.message || 'erro ao sincronizar.'} Lotes sincronizados.` });
      } else {
        showToast({ type: 'warning', message: `Fazendas: ${fazendasSync?.message || 'erro'} Lotes: ${lotesSync?.message || 'erro'}` });
      }

      if (fazendasSync?.status !== 'success' || lotesSync?.status !== 'success') {
        let supabaseHost = null;
        try {
          supabaseHost = new URL(import.meta.env.VITE_SUPABASE_URL).host;
        } catch {
          supabaseHost = null;
        }
        const primaryModule = fazendasSync?.status !== 'success' ? 'fazendas' : 'lotes';
        const primaryResult = fazendasSync?.status !== 'success' ? fazendasSync : lotesSync;
        console.groupCollapsed('[HERDON_CLOUD_PRODUCTION_DIAGNOSTIC]');
        console.info({
          appOrigin: window.location.origin,
          supabaseHost,
          module: primaryModule,
          table: primaryModule,
          stage: primaryModule === 'fazendas' ? 'manual_sync_fazendas' : 'manual_sync_lotes',
          failureType: primaryResult?.status === 'timeout' ? 'timeout' : 'error',
          httpStatus: primaryResult?.httpStatus ?? null,
          postgrestCode: primaryResult?.code ?? null,
          safeMessage: primaryResult?.message || 'Falha ao sincronizar com a nuvem.',
          cooldownState: {
            fazendas: getCloudSyncCooldownState('fazendas'),
            lotes: getCloudSyncCooldownState('lotes'),
          },
        });
        console.groupEnd();
      }
    } catch {
      showToast({ type: 'warning', message: 'Não foi possível sincronizar fazendas e lotes. Seus dados locais continuam disponíveis.' });
    } finally {
      manualSyncRef.current.inFlight = false;
      if (loadingToastRef.current) {
        dismissToast(loadingToastRef.current);
        loadingToastRef.current = null;
      }
      setSincronizandoFazendas(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Fazendas"
        subtitle="Gestão completa das propriedades e suas capacidades"
        actions={(
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={sincronizarFazendasComNuvem}
              disabled={sincronizandoFazendas || diagnosticandoNuvem || reconectandoNuvem}
            >
              {sincronizandoFazendas ? 'Sincronizando fazendas e lotes...' : 'Sincronizar fazendas e lotes com a nuvem'}
            </Button>
            {podeVerDiagnostico ? (
              <Button
                variant="ghost"
                onClick={executarDiagnosticoNuvem}
                disabled={sincronizandoFazendas || diagnosticandoNuvem || reconectandoNuvem}
              >
                {diagnosticandoNuvem ? 'Testando conexão com a nuvem...' : 'Testar conexão com a nuvem'}
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={reconectarNuvem}
              disabled={sincronizandoFazendas || diagnosticandoNuvem || reconectandoNuvem}
            >
              {reconectandoNuvem ? 'Reconectando...' : 'Reconectar à nuvem'}
            </Button>
            <Button onClick={() => {
              if (!hasPermission('fazendas:editar')) {
                showToast({ type: 'error', message: mensagemSemPermissao });
                return;
              }
              setEditando(null);
              setOpenModal(true);
            }}
            >
              + Nova Fazenda
            </Button>
          </div>
        )}
      />

      {cards.length === 0 ? (
        <div className="ui-card empty-state">
          <strong>Nenhuma fazenda cadastrada.</strong>
          <span>Use o botão "Nova Fazenda" para começar.</span>
        </div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <FazendaCard
              key={fazenda.id}
              fazenda={fazenda}
              lotesVinculados={fazenda.lotesVinculados}
              onClick={() => { setEditando(fazenda); setOpenModal(true); }}
              onDelete={() => excluirFazenda(fazenda.id)}
            />
          ))}
        </div>
      )}

      <FazendaModal
        open={openModal}
        initialData={editando}
        onSave={salvarFazenda}
        onCancel={() => { setOpenModal(false); setEditando(null); }}
      />
    </div>
  );
}
