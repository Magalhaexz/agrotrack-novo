import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';
<<<<<<< HEAD
// Assuming useToast is available
// import { useToast } from '../hooks/useToast';

/**
 * Página de Fazendas, para gerenciar as propriedades.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Callback opcional para ações de confirmação.
 */
export default function FazendasPage({ db, setDb, onConfirmAction }) {
  // const { showToast } = useToast(); // Se usar useToast

=======

export default function FazendasPage({ db, setDb }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

<<<<<<< HEAD
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
=======
  const cards = useMemo(
    () => fazendas.map((fazenda) => ({
      ...fazenda,
      lotesVinculados: lotes.filter((l) => Number(l.faz_id) === Number(fazenda.id)).length,
    })),
    [fazendas, lotes]
  );

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  function salvarFazenda(payload) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
<<<<<<< HEAD
        fazendas: prev.fazendas.map((f) =>
          f.id === editando.id ? { ...f, ...payload } : f
        ),
      }));
      // showToast({ type: 'success', message: 'Fazenda atualizada com sucesso!' });
    } else {
      setDb((prev) => ({
        ...prev,
        fazendas: [
          ...prev.fazendas,
          {
            id: gerarNovoId(prev.fazendas),
            ...payload,
          },
        ],
      }));
      // showToast({ type: 'success', message: 'Fazenda adicionada com sucesso!' });
=======
        fazendas: (prev.fazendas || []).map((f) => Number(f.id) === Number(editando.id) ? { ...f, ...payload } : f),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        fazendas: [...(prev.fazendas || []), { id: gerarNovoId(prev.fazendas || []), ...payload }],
      }));
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
    }
    setOpenModal(false);
    setEditando(null);
  }

<<<<<<< HEAD
  /**
   * Exclui uma fazenda após confirmação.
   * @param {number} id - O ID da fazenda a ser excluída.
   */
  async function excluirFazenda(id) {
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

    setDb((prev) => ({
      ...prev,
      fazendas: prev.fazendas.filter((f) => f.id !== id),
    }));
    // showToast({ type: 'success', message: 'Fazenda excluída com sucesso!' });
  }

=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  return (
    <div className="page">
      <PageHeader
        title="Fazendas"
        subtitle="Gestão completa das propriedades e suas capacidades"
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>+ Nova Fazenda</Button>}
      />

      {cards.length === 0 ? (
<<<<<<< HEAD
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
=======
        <div className="ui-card"><strong>Nenhuma fazenda cadastrada.</strong></div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <FazendaCard key={fazenda.id} fazenda={fazenda} lotesVinculados={fazenda.lotesVinculados} onClick={() => { setEditando(fazenda); setOpenModal(true); }} />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
