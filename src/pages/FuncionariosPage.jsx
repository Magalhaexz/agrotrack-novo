import { useMemo, useState } from 'react';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import FuncionarioModal from '../components/funcionarios/FuncionarioModal';
import FuncionarioRow from '../components/funcionarios/FuncionarioRow';
import { gerarNovoId } from '../utils/id';
<<<<<<< HEAD
// import { useToast } from '../hooks/useToast'; // Se usar useToast

/**
 * Página de Funcionários, para gestão de colaboradores.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 * @param {function} props.setDb - Função para atualizar o banco de dados.
 * @param {function} [props.onConfirmAction] - Callback opcional para ações de confirmação.
 */
export default function FuncionariosPage({ db, setDb, onConfirmAction }) {
  // const { showToast } = useToast(); // Se usar useToast

=======

export default function FuncionariosPage({ db, setDb }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const [openModal, setOpenModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('todos');

  const funcionarios = Array.isArray(db?.funcionarios) ? db.funcionarios : [];
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];

<<<<<<< HEAD
  // Pré-indexar fazendas para busca eficiente de nomes
  const fazendasMap = useMemo(() => {
    return new Map(fazendas.map(f => [f.id, f]));
  }, [fazendas]);

  // Lista de funcionários filtrada e memoizada
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => (status === 'todos' ? true : (f.status || 'ativo') === status))
      .filter((f) => {
        const termo = busca.trim().toLowerCase();
        if (!termo) return true;
        return `${f.nome || ''} ${f.cargo || ''}`.toLowerCase().includes(termo);
      });
  }, [funcionarios, busca, status]);

<<<<<<< HEAD
  /**
   * Retorna o nome da fazenda dado o seu ID.
   * Usa o mapa de fazendas para eficiência.
   * @param {number} id - O ID da fazenda.
   * @returns {string} O nome da fazenda ou '—' se não encontrada.
   */
  function getNomeFazenda(id) {
    return fazendasMap.get(Number(id))?.nome || '—';
  }

  /**
   * Salva um novo funcionário ou atualiza um existente.
   * @param {object} payload - Os dados do funcionário a serem salvos.
   */
=======
  function nomeFazenda(id) {
    return fazendas.find((f) => Number(f.id) === Number(id))?.nome || '—';
  }

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  function salvarFuncionario(payload) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
<<<<<<< HEAD
        funcionarios: prev.funcionarios.map((f) =>
          f.id === editando.id ? { ...f, ...payload } : f
        ),
      }));
      // showToast({ type: 'success', message: 'Funcionário atualizado com sucesso!' });
    } else {
      setDb((prev) => ({
        ...prev,
        funcionarios: [
          ...prev.funcionarios,
          {
            id: gerarNovoId(prev.funcionarios),
            ...payload,
          },
        ],
      }));
      // showToast({ type: 'success', message: 'Funcionário adicionado com sucesso!' });
    }
    setOpenModal(false);
    setEditando(null);
  }

  /**
   * Exclui um funcionário após confirmação.
   * @param {number} id - O ID do funcionário a ser excluído.
   */
  async function excluirFuncionario(id) {
    const funcionario = funcionarios.find((f) => f.id === id);
    if (!funcionario) return;

    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir funcionário',
          message: `Deseja realmente excluir o funcionário "${funcionario.nome}"?`,
          tone: 'danger',
        })
      : window.confirm(`Deseja realmente excluir o funcionário "${funcionario.nome}"?`);

    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      funcionarios: prev.funcionarios.filter((f) => f.id !== id),
    }));
    // showToast({ type: 'success', message: 'Funcionário excluído com sucesso!' });
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  }

  return (
    <div className="page">
      <PageHeader
        title="Funcionários"
<<<<<<< HEAD
        subtitle="Gestão de colaboradores e suas informações"
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>+ Novo Funcionário</Button>}
      />

      <div className="filters-bar ui-card"> {/* Usando ui-card para a barra de filtros */}
=======
        subtitle="Gestão da equipe por cargo, fazenda e status"
        actions={<Button onClick={() => { setEditando(null); setOpenModal(true); }}>+ Cadastrar Funcionário</Button>}
      />

      <div className="grid-3" style={{ marginBottom: 12 }}>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        <input className="ui-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" />
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos</option>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

<<<<<<< HEAD
      <div className="ui-card no-padding"> {/* Adicionada classe no-padding para remover padding padrão */}
        {lista.length === 0 ? (
          <div className="empty-state padded"> {/* Adicionada classe padded para padding interno */}
            <p>Nenhum funcionário encontrado.</p>
            <span>Ajuste os filtros ou adicione um novo funcionário.</span>
=======
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        {lista.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>
            <p>Nenhum funcionário encontrado.</p>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          </div>
        ) : (
          lista.map((funcionario) => (
            <FuncionarioRow
              key={funcionario.id}
              funcionario={funcionario}
<<<<<<< HEAD
              fazendaNome={getNomeFazenda(funcionario.fazenda_id)}
              onEdit={() => { setEditando(funcionario); setOpenModal(true); }}
              onDelete={() => excluirFuncionario(funcionario.id)}
=======
              fazendaNome={nomeFazenda(funcionario.fazenda_id)}
              onEdit={() => { setEditando(funcionario); setOpenModal(true); }}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
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
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
