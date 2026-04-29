import { useMemo, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import {
  checkSupabaseCloudConnection,
  createOperationalRecord,
  deleteOperationalRecord,
  syncFazendasWithCloud,
  updateOperationalRecord,
} from '../services/operationalPersistence';
import { runSupabaseConnectivityDiagnostics } from '../services/supabaseDiagnostics';

export default function FazendasPage({ db, setDb, onConfirmAction }) {
  const { showToast, dismissToast } = useToast();
  const { hasPermission, session, user } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sincronizandoFazendas, setSincronizandoFazendas] = useState(false);
  const [diagnosticandoNuvem, setDiagnosticandoNuvem] = useState(false);
  const loadingToastRef = useRef(null);
  const isAdmin = String(user?.perfil || '').toLowerCase() === 'admin' || hasPermission('configuracoes:editar');
  const podeVerDiagnostico = Boolean(import.meta.env.DEV || isAdmin);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  const lotesByFazendaMap = useMemo(() => {
    const map = new Map();
    lotes.forEach((lote) => {
      const fazendaId = Number(lote.faz_id);
      if (!map.has(fazendaId)) {
        map.set(fazendaId, []);
      }
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
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Alteração salva apenas localmente.' });
      }
    } else {
      const persisted = await createOperationalRecord('fazendas', payload, session);
      setDb((prev) => ({
        ...prev,
        fazendas: [
          ...prev.fazendas,
          persisted.data || {
            id: gerarNovoId(prev.fazendas),
            ...payload,
          },
        ],
      }));
      if (!persisted.persisted) {
        showToast({ type: 'warning', message: 'Cadastro salvo apenas localmente.' });
      }
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
    setDb((prev) => ({
      ...prev,
      fazendas: prev.fazendas.filter((f) => f.id !== id),
    }));
    if (!persisted.persisted) {
      showToast({ type: 'warning', message: 'Exclusão aplicada apenas localmente.' });
    }
  }

  function getResumoDiagnostico(classification) {
    switch (classification) {
      case 'missing_api_key_header':
      case 'config_error':
      case 'env_missing':
      case 'invalid_url':
        return 'Configuração da nuvem incompleta. Verifique as variáveis do Supabase.';
      case 'auth_error':
        return 'Sessão expirada. Entre novamente para sincronizar com a nuvem.';
      case 'auth_or_rls_error':
        return 'Sem permissão para acessar estes dados na nuvem.';
      case 'schema_error':
      case 'rls_or_policy_error':
        return 'Estrutura da nuvem incompleta. Verifique a tabela fazendas no Supabase.';
      case 'network_error':
      case 'timeout':
      case 'cors_or_fetch_blocked':
        return 'Projeto Supabase inacessível pela rede.';
      case 'ok':
        return 'Conexão com a nuvem validada.';
      default:
        return 'Não foi possível validar a conectividade com a nuvem.';
    }
  }

  async function executarDiagnosticoNuvem() {
    if (!podeVerDiagnostico || diagnosticandoNuvem) return;
    setDiagnosticandoNuvem(true);
    try {
      const result = await runSupabaseConnectivityDiagnostics({ session });
      showToast({
        type: result?.ok ? 'success' : 'warning',
        message: getResumoDiagnostico(result?.classification),
      });

      if (import.meta.env.DEV || isAdmin) {
        console.info('[HERDON_CLOUD_DIAGNOSTIC]', {
          stage: result?.stage || null,
          classification: result?.classification || null,
          ok: Boolean(result?.ok),
          safeDetails: result?.safeDetails || null,
        });
      }
    } catch (error) {
      showToast({
        type: 'warning',
        message: 'Nao foi possivel executar o diagnostico da nuvem.',
      });
      if (import.meta.env.DEV) {
        console.warn('[HERDON_CLOUD_DIAGNOSTIC]', {
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

  async function sincronizarFazendasComNuvem() {
    if (sincronizandoFazendas) return;

    if (!session?.user?.id) {
      showToast({ type: 'warning', message: 'Faça login para sincronizar com a nuvem.' });
      return;
    }

    setSincronizandoFazendas(true);
    loadingToastRef.current = showToast({
      id: 'fazendas-sync-loading',
      type: 'info',
      message: 'Sincronizando fazendas...',
      persist: true,
    });

    try {
      const health = await checkSupabaseCloudConnection({ session });
      if (!health?.ok) {
        showToast({
          type: 'warning',
          message: health?.message || 'Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente.',
        });
        return;
      }

      const result = await syncFazendasWithCloud({
        fazendas,
        session,
      });

      if (Array.isArray(result?.data)) {
        setDb((prev) => ({
          ...prev,
          fazendas: result.data,
        }));
      }

      if (result?.ok && ((result?.syncedCount || 0) > 0 || (result?.selectedCount || 0) > 0)) {
        showToast({ type: 'success', message: 'Fazendas sincronizadas com sucesso.' });
      } else if ((result?.failedCount || 0) > 0 && (result?.syncedCount || 0) > 0) {
        showToast({
          type: 'warning',
          message: result?.message || 'Algumas fazendas não foram sincronizadas. Seus dados locais continuam disponíveis.',
        });
      } else {
        showToast({
          type: 'warning',
          message: result?.message || 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.',
        });
      }
    } catch {
      showToast({
        type: 'warning',
        message: 'Não foi possível sincronizar fazendas. Seus dados locais continuam disponíveis.',
      });
    } finally {
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
              disabled={sincronizandoFazendas || diagnosticandoNuvem}
            >
              {sincronizandoFazendas ? 'Sincronizando fazendas...' : 'Sincronizar fazendas com a nuvem'}
            </Button>
            {podeVerDiagnostico ? (
              <Button
                variant="ghost"
                onClick={executarDiagnosticoNuvem}
                disabled={sincronizandoFazendas || diagnosticandoNuvem}
              >
                {diagnosticandoNuvem ? 'Diagnosticando nuvem...' : 'Diagnosticar nuvem'}
              </Button>
            ) : null}
            <Button onClick={() => {
              if (!hasPermission('fazendas:editar')) {
                showToast({ type: 'error', message: mensagemSemPermissao });
                return;
              }
              setEditando(null); setOpenModal(true);
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
