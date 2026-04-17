import { useMemo, useState } from 'react';
import FazendaForm from '../components/FazendaForm';

export default function FazendasPage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [fazendaEditando, setFazendaEditando] = useState(null);

  const fazendas = db?.fazendas || [];
  const lotes = db?.lotes || [];

  const dadosTabela = useMemo(() => {
    return fazendas.map((fazenda) => {
      const qtdLotes = lotes.filter((l) => l.faz_id === fazenda.id).length;
      return { ...fazenda, qtdLotes };
    });
  }, [fazendas, lotes]);

  function abrirNova() {
    setFazendaEditando(null);
    setAbrirForm(true);
  }

  function editarFazenda(fazenda) {
    setFazendaEditando(fazenda);
    setAbrirForm(true);
  }

  function excluirFazenda(id) {
    const temLotes = lotes.some((l) => l.faz_id === id);

    if (temLotes) {
      alert('Essa fazenda possui lotes vinculados. Exclua ou mova os lotes antes.');
      return;
    }

    if (!window.confirm('Deseja excluir esta fazenda?')) return;

    setDb((prev) => ({
      ...prev,
      fazendas: prev.fazendas.filter((f) => f.id !== id),
    }));
  }

  function salvarFazenda(dados) {
    if (fazendaEditando) {
      setDb((prev) => ({
        ...prev,
        fazendas: prev.fazendas.map((f) =>
          f.id === fazendaEditando.id ? { ...f, ...dados } : f
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        fazendas: [
          ...prev.fazendas,
          {
            id: gerarNovoId(prev.fazendas),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setFazendaEditando(null);
  }

  const responsaveisUnicos = new Set(
    fazendas.map((f) => f.resp).filter(Boolean)
  ).size;

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Fazendas</h1>
          <p>Cadastro e gerenciamento das propriedades do sistema.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNova}>
            + Nova fazenda
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Fazendas</div>
          <div className="kpi-value">{fazendas.length}</div>
          <div className="kpi-sub">propriedades cadastradas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lotes vinculados</div>
          <div className="kpi-value">{lotes.length}</div>
          <div className="kpi-sub">somando todas as fazendas</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Responsáveis</div>
          <div className="kpi-value">{responsaveisUnicos}</div>
          <div className="kpi-sub">nomes únicos cadastrados</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de fazendas</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma fazenda cadastrada.</strong>
              <span>Use o botão “Nova fazenda” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Localização</th>
                  <th>Responsável</th>
                  <th>Lotes</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((fazenda) => (
                  <tr key={fazenda.id}>
                    <td className="text-h">{fazenda.nome}</td>
                    <td>{fazenda.local || '—'}</td>
                    <td>{fazenda.resp || '—'}</td>
                    <td>
                      <span className="badge b-green">
                        {fazenda.qtdLotes} lote{fazenda.qtdLotes === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarFazenda(fazenda)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirFazenda(fazenda.id)}
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
        <FazendaForm
          initialData={fazendaEditando}
          onSave={salvarFazenda}
          onCancel={() => {
            setAbrirForm(false);
            setFazendaEditando(null);
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