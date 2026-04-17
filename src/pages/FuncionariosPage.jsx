import { useMemo, useState } from 'react';
import FuncionarioForm from '../components/FuncionarioForm';

export default function FuncionariosPage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState(null);

  const funcionarios = db?.funcionarios || [];
  const rotinas = db?.rotinas || [];

  const dadosTabela = useMemo(() => {
    return funcionarios.map((funcionario) => {
      const qtdRotinas = rotinas.filter(
        (r) => r.funcionario_id === funcionario.id
      ).length;

      return {
        ...funcionario,
        qtdRotinas,
      };
    });
  }, [funcionarios, rotinas]);

  function abrirNovo() {
    setFuncionarioEditando(null);
    setAbrirForm(true);
  }

  function editarFuncionario(funcionario) {
    setFuncionarioEditando(funcionario);
    setAbrirForm(true);
  }

  function excluirFuncionario(id) {
    const temRotinas = rotinas.some((r) => r.funcionario_id === id);

    if (temRotinas) {
      alert('Esse funcionário possui rotinas vinculadas. Exclua ou altere as rotinas antes.');
      return;
    }

    if (!window.confirm('Deseja excluir este funcionário?')) return;

    setDb((prev) => ({
      ...prev,
      funcionarios: prev.funcionarios.filter((f) => f.id !== id),
    }));
  }

  function salvarFuncionario(dados) {
    if (funcionarioEditando) {
      setDb((prev) => ({
        ...prev,
        funcionarios: prev.funcionarios.map((f) =>
          f.id === funcionarioEditando.id ? { ...f, ...dados } : f
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        funcionarios: [
          ...prev.funcionarios,
          {
            id: gerarNovoId(prev.funcionarios),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setFuncionarioEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Funcionários</h1>
          <p>Cadastro da equipe para uso na rotina operacional.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Novo funcionário
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Funcionários</div>
          <div className="kpi-value">{funcionarios.length}</div>
          <div className="kpi-sub">colaboradores cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Funções</div>
          <div className="kpi-value">
            {new Set(funcionarios.map((f) => f.funcao).filter(Boolean)).size}
          </div>
          <div className="kpi-sub">funções diferentes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Rotinas vinculadas</div>
          <div className="kpi-value">{rotinas.length}</div>
          <div className="kpi-sub">tarefas cadastradas</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de funcionários</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum funcionário cadastrado.</strong>
              <span>Use o botão “Novo funcionário” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Função</th>
                  <th>Telefone</th>
                  <th>Rotinas</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((funcionario) => (
                  <tr key={funcionario.id}>
                    <td className="text-h">{funcionario.nome}</td>
                    <td>{funcionario.funcao}</td>
                    <td>{funcionario.telefone || '—'}</td>
                    <td>
                      <span className="badge b-blue">
                        {funcionario.qtdRotinas}
                      </span>
                    </td>
                    <td>{funcionario.obs || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarFuncionario(funcionario)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirFuncionario(funcionario.id)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {abrirForm && (
        <FuncionarioForm
          initialData={funcionarioEditando}
          onSave={salvarFuncionario}
          onCancel={() => {
            setAbrirForm(false);
            setFuncionarioEditando(null);
          }}
        />
      )}
    </div>
  );
}

function gerarNovoId(lista) {
  if (!lista.length) return 1;
  return Math.max(...lista.map((item) => item.id)) + 1;
}