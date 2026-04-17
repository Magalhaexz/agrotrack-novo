import { useMemo, useState } from 'react';
import LoteForm from '../components/LoteForm';

export default function LotesPage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);

  const fazendas = db?.fazendas || [];
  const lotes = db?.lotes || [];
  const animais = db?.animais || [];
  const custos = db?.custos || [];

  const dadosTabela = useMemo(() => {
    return lotes.map((lote) => {
      const fazenda = fazendas.find((f) => f.id === lote.faz_id);
      const qtdAnimais = animais
        .filter((a) => a.lote_id === lote.id)
        .reduce((acc, item) => acc + Number(item.qtd || 0), 0);

      const custoOperacional = custos
        .filter((c) => c.lote_id === lote.id)
        .reduce((acc, item) => acc + Number(item.val || 0), 0);

      return {
        ...lote,
        fazendaNome: fazenda?.nome || '—',
        qtdAnimais,
        custoOperacional,
      };
    });
  }, [lotes, fazendas, animais, custos]);

  function abrirNovoLote() {
    setLoteEditando(null);
    setAbrirForm(true);
  }

  function editarLote(lote) {
    setLoteEditando(lote);
    setAbrirForm(true);
  }

  function excluirLote(id) {
    const temAnimais = animais.some((a) => a.lote_id === id);
    const temCustos = custos.some((c) => c.lote_id === id);

    if (temAnimais || temCustos) {
      alert('Esse lote possui animais ou custos vinculados. Remova esses registros antes.');
      return;
    }

    if (!window.confirm('Deseja excluir este lote?')) return;

    setDb((prev) => ({
      ...prev,
      lotes: prev.lotes.filter((l) => l.id !== id),
    }));
  }

  function salvarLote(dados) {
    if (loteEditando) {
      setDb((prev) => ({
        ...prev,
        lotes: prev.lotes.map((l) =>
          l.id === loteEditando.id ? { ...l, ...dados } : l
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        lotes: [
          ...prev.lotes,
          {
            id: gerarNovoId(prev.lotes),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setLoteEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Lotes</h1>
          <p>Crie e gerencie os lotes da operação pecuária.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovoLote}>
            + Novo lote
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Lotes</div>
          <div className="kpi-value">{lotes.length}</div>
          <div className="kpi-sub">lotes cadastrados no sistema</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Animais vinculados</div>
          <div className="kpi-value">
            {animais.reduce((acc, item) => acc + Number(item.qtd || 0), 0)}
          </div>
          <div className="kpi-sub">somando todos os lotes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Investimento total</div>
          <div className="kpi-value">
            R$ {formatarNumero(lotes.reduce((acc, item) => acc + Number(item.investimento || 0), 0))}
          </div>
          <div className="kpi-sub">capital alocado nos lotes</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de lotes</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum lote cadastrado.</strong>
              <span>Use o botão “Novo lote” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Fazenda</th>
                  <th>Tipo</th>
                  <th>Entrada</th>
                  <th>Animais</th>
                  <th>Investimento</th>
                  <th>Custo Op.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((lote) => (
                  <tr key={lote.id}>
                    <td className="text-h">{lote.nome}</td>
                    <td>{lote.fazendaNome}</td>
                    <td>
                      <span className="badge b-green">{normalizarTipo(lote.tipo)}</span>
                    </td>
                    <td>{formatarData(lote.entrada)}</td>
                    <td>{lote.qtdAnimais} cab.</td>
                    <td>R$ {formatarNumero(lote.investimento || 0)}</td>
                    <td>R$ {formatarNumero(lote.custoOperacional || 0)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarLote(lote)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirLote(lote.id)}
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
        <LoteForm
          initialData={loteEditando}
          fazendas={fazendas}
          onSave={salvarLote}
          onCancel={() => {
            setAbrirForm(false);
            setLoteEditando(null);
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

function formatarNumero(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarData(data) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function normalizarTipo(tipo) {
  if (tipo === 'recria+engorda') return 'Recria + Engorda';
  if (tipo === 'confinamento') return 'Confinamento';
  if (tipo === 'engorda') return 'Engorda';
  if (tipo === 'recria') return 'Recria';
  return tipo || '—';
}