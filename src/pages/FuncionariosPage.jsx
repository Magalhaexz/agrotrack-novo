import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import FuncionarioForm from '../components/FuncionarioForm';
import { gerarNovoId } from '../utils/id';
import { formatDate } from '../utils/calculations';

export default function FuncionariosPage({ db, setDb, onConfirmAction }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const funcionarios = Array.isArray(db?.funcionarios) ? db.funcionarios : [];
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];

  const lista = useMemo(() => {
    return funcionarios
      .filter((f) => {
        if (filtroStatus === 'todos') return true;
        return (f.status || 'ativo') === filtroStatus;
      })
      .filter((f) => {
        const termo = busca.trim().toLowerCase();
        if (!termo) return true;
        return (
          String(f.nome || '').toLowerCase().includes(termo) ||
          String(f.cargo || '').toLowerCase().includes(termo)
        );
      });
  }, [busca, filtroStatus, funcionarios]);

  function nomeFazenda(id) {
    return fazendas.find((f) => Number(f.id) === Number(id))?.nome || '—';
  }

  function abrirCadastro() {
    setEditando(null);
    setAberto(true);
  }

  function salvarFuncionario(dados) {
    if (editando) {
      setDb((prev) => ({
        ...prev,
        funcionarios: (prev.funcionarios || []).map((f) =>
          Number(f.id) === Number(editando.id) ? { ...f, ...dados } : f
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        funcionarios: [
          ...(prev.funcionarios || []),
          {
            id: gerarNovoId(prev.funcionarios || []),
            ...dados,
            created_at: new Date().toISOString(),
          },
        ],
      }));
    }

    setAberto(false);
    setEditando(null);
  }

  async function alternarStatus(funcionario) {
    const novoStatus = (funcionario.status || 'ativo') === 'ativo' ? 'inativo' : 'ativo';
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: `${novoStatus === 'ativo' ? 'Ativar' : 'Desativar'} funcionário`,
          message: `Deseja ${novoStatus === 'ativo' ? 'ativar' : 'desativar'} ${funcionario.nome}?`,
          tone: 'warning',
        })
      : true;
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      funcionarios: (prev.funcionarios || []).map((f) =>
        Number(f.id) === Number(funcionario.id) ? { ...f, status: novoStatus } : f
      ),
    }));
  }

  async function excluirFuncionario(funcionario) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir funcionário',
          message: `Deseja excluir ${funcionario.nome}?`,
          tone: 'danger',
        })
      : true;

    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      funcionarios: (prev.funcionarios || []).filter((f) => Number(f.id) !== Number(funcionario.id)),
    }));
  }

  return (
    <div className="page">
      <PageHeader
        title="Funcionários"
        subtitle="Gestão de equipe, vínculo por fazenda e status operacional."
        actions={<Button onClick={abrirCadastro}>+ Cadastrar Funcionário</Button>}
      />

      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="ui-input-wrap">
          <label className="ui-input-label">Busca</label>
          <input className="ui-input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo" />
        </div>

        <div className="ui-input-wrap">
          <label className="ui-input-label">Status</label>
          <select className="ui-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="ui-card">
          <strong>Nenhum funcionário cadastrado</strong>
        </div>
      ) : (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Telefone</th>
                <th>Fazenda</th>
                <th>Data admissão</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((funcionario) => (
                <tr key={funcionario.id}>
                  <td>{funcionario.nome}</td>
                  <td>{funcionario.cargo || '—'}</td>
                  <td>{funcionario.telefone || '—'}</td>
                  <td>{nomeFazenda(funcionario.fazenda_id)}</td>
                  <td>{formatDate(funcionario.data_admissao)}</td>
                  <td>
                    <Badge variant={(funcionario.status || 'ativo') === 'ativo' ? 'success' : 'warning'}>
                      {(funcionario.status || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <Button size="sm" variant="outline" onClick={() => { setEditando(funcionario); setAberto(true); }}>
                        Editar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => alternarStatus(funcionario)}>
                        {(funcionario.status || 'ativo') === 'ativo' ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => excluirFuncionario(funcionario)}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FuncionarioForm
        key={editando?.id || 'novo'}
        open={aberto}
        initialData={editando}
        fazendas={fazendas}
        onSave={salvarFuncionario}
        onCancel={() => {
          setAberto(false);
          setEditando(null);
        }}
      />
    </div>
  );
}
