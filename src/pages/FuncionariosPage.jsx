import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FuncionarioModal from '../components/funcionarios/FuncionarioModal';
import FuncionarioRow from '../components/funcionarios/FuncionarioRow';
import { gerarNovoId } from '../utils/id';

export default function FuncionariosPage({ db, setDb }) {
  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');

  const funcionarios = Array.isArray(db?.funcionarios) ? db.funcionarios : [];
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];

  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => (status === 'todos' ? true : (f.status || 'ativo') === status))
      .filter((f) => {
        const termo = busca.trim().toLowerCase();
        if (!termo) return true;
        return `${f.nome || ''} ${f.cargo || ''}`.toLowerCase().includes(termo);
      });
  }, [funcionarios, busca, status]);

  function nomeFazenda(id) {
    return fazendas.find((f) => Number(f.id) === Number(id))?.nome || '—';
  }

  function salvarFuncionario(payload) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
        funcionarios: (prev.funcionarios || []).map((f) => Number(f.id) === Number(editando.id) ? { ...f, ...payload } : f),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        funcionarios: [...(prev.funcionarios || []), { id: gerarNovoId(prev.funcionarios || []), ...payload }],
      }));
    }
    setEditando(null);
    setOpenModal(false);
  }

  return (
    <div className="page">
      <PageHeader
        title="Funcionários"
        subtitle="Gestão da equipe por cargo, fazenda e status"
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>+ Cadastrar Funcionário</Button>}
      />

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <input className="ui-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" />
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>Nenhum funcionário encontrado.</p>
          </div>
        ) : (
          lista.map((funcionario) => (
            <FuncionarioRow
              key={funcionario.id}
              funcionario={funcionario}
              fazendaNome={nomeFazenda(funcionario.fazenda_id)}
              onEdit={() => { setEditando(funcionario); setOpenModal(true); }}
            />
          ))
        )}
      </div>

      <FuncionarioModal
        open={openModal}
        initialData={editando}
        fazendas={fazendas}
        onSave={salvarFuncionario}
        onCancel={() => { setOpenModal(false); setEditando(null); }}
      />
    </div>
  );
}
