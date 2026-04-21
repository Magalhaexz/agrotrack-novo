import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FazendaCard from '../components/fazendas/FazendaCard';
import FazendaModal from '../components/fazendas/FazendaModal';
import { gerarNovoId } from '../utils/id';

export default function FazendasPage({ db, setDb }) {
  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];

  const cards = useMemo(
    () => fazendas.map((fazenda) => ({
      ...fazenda,
      lotesVinculados: lotes.filter((l) => Number(l.faz_id) === Number(fazenda.id)).length,
    })),
    [fazendas, lotes]
  );

  function salvarFazenda(payload) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
        fazendas: (prev.fazendas || []).map((f) => Number(f.id) === Number(editando.id) ? { ...f, ...payload } : f),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        fazendas: [...(prev.fazendas || []), { id: gerarNovoId(prev.fazendas || []), ...payload }],
      }));
    }
    setOpenModal(false);
    setEditando(null);
  }

  return (
    <div className="page">
      <PageHeader
        title="Fazendas"
        subtitle="Gestão completa das propriedades e suas capacidades"
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>+ Nova Fazenda</Button>}
      />

      {cards.length === 0 ? (
        <div className="ui-card"><strong>Nenhuma fazenda cadastrada.</strong></div>
      ) : (
        <div className="grid-3">
          {cards.map((fazenda) => (
            <FazendaCard key={fazenda.id} fazenda={fazenda} lotesVinculados={fazenda.lotesVinculados} onClick={() => { setEditando(fazenda); setOpenModal(true); }} />
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
