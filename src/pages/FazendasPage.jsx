import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/useAuth';
import {
  createOperationalRecord,
  deleteOperationalRecord,
  syncFazendasWithCloud,
  updateOperationalRecord,
} from '../services/operationalPersistence';

/**
 * Página de Fazendas, para gerenciar as propriedades.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Callback opcional para ações de confirmação.
 */
export default function FazendasPage({ db, setDb, onConfirmAction }) {
  const { showToast } = useToast();
  const { hasPermission, session } = useAuth();
  const mensagemSemPermissao = 'Você não tem permissão para executar esta ação.';

  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [sincronizandoFazendas, setSincronizandoFazendas] = useState(false);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  // Pré-indexar lotes por fazenda_id para busca eficiente
  const lotesByFazendaMap = useMemo(() => {
    const map = new Map();
    lotes.forEach(lote => {
      const fazendaId = Number(lote.faz_id);
      if (!map.has(fazendaId)) {
        map.set(fazendaId, []);
      }
      map.get(fazendaId).push(lote);
    });
    return map;
  }, [lotes]);

  // Calcular cards de fazenda com lotes vinculados (MEMOIZADO)
  const cards = useMemo(
    () => fazendas.map((fazenda) => ({
      ...fazenda,
      lotesVinculados: (lotesByFazendaMap.get(Number(fazenda.id)) || []).length,
    })),
    [fazendas, lotesByFazendaMap]
  );

  /**
   * Salva uma nova fazenda ou atualiza uma existente.
   * @param {object} payload - Os dados da fazenda a serem salvos.
   */
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
      // showToast({ type: 'success', message: 'Fazenda atualizada com sucesso!' });
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
      // showToast({ type: 'success', message: 'Fazenda adicionada com sucesso!' });
    }
    setOpenModal(false);
    setEditando(null);
  }

  /**
   * Exclui uma fazenda após confirmação.
   * @param {number} id - O ID da fazenda a ser excluída.
   */
  async function excluirFazenda(id) {
    if (!hasPermission('fazendas:editar')) {
      showToast({ type: 'error', message: mensagemSemPermissao });
      return;
    }
    const fazenda = cards.find((f) => f.id === id); // Usar 'cards' que já tem lotesVinculados
    if (!fazenda) return;

    if (fazenda.lotesVinculados > 0) {
      // showToast({ type: 'error', message: 'Não é possível excluir uma fazenda com lotes vinculados.' });
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
    // showToast({ type: 'success', message: 'Fazenda excluída com sucesso!' });
  }

  async function sincronizarFazendasComNuvem() {
    if (sincronizandoFazendas) {
      return;
    }

    if (!session?.user?.id) {
      showToast({ type: 'warning', message: 'Faça login para sincronizar com a nuvem.' });
      return;
    }

    setSincronizandoFazendas(true);
    showToast({ type: 'info', message: 'Sincronizando fazendas...' });
    try {
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
              disabled={sincronizandoFazendas}
            >
              {sincronizandoFazendas ? 'Sincronizando fazendas...' : 'Sincronizar fazendas com a nuvem'}
            </Button>
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
        <div className="ui-card empty-state"> {/* Adicionada classe empty-state para estilo */}
          <strong>Nenhuma fazenda cadastrada.</strong>
          <span>Use o botão "Nova Fazenda" para começar.</span> {/* Adicionada uma descrição */}
        </div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <FazendaCard
              key={fazenda.id}
              fazenda={fazenda}
              lotesVinculados={fazenda.lotesVinculados}
              onClick={() => { setEditando(fazenda); setOpenModal(true); }}
              onDelete={() => excluirFazenda(fazenda.id)} // Passa a função de exclusão
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
