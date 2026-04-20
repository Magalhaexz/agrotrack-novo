import { useMemo, useState } from 'react';
import PesagemForm from '../components/PesagemForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';

export default function PesagensPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [pesagemEditando, setPesagemEditando] = useState(null);

  const lotes = db?.lotes || [];
  const pesagens = db?.pesagens || [];

  const dadosTabela = useMemo(() => {
    const ordenadas = [...pesagens].sort((a, b) => {
      if (a.lote_id !== b.lote_id) return a.lote_id - b.lote_id;
      return new Date(a.data) - new Date(b.data);
    });

    return ordenadas.map((pesagem, index) => {
      const lote = lotes.find((l) => l.id === pesagem.lote_id);

      let variacao = null;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (ordenadas[i].lote_id === pesagem.lote_id) {
          variacao = Number(pesagem.peso_medio) - Number(ordenadas[i].peso_medio);
          break;
        }
      }

      return {
        ...pesagem,
        loteNome: lote?.nome || '—',
        variacao,
      };
    }).sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [pesagens, lotes]);

  const resumo = useMemo(() => {
    const totalPesagens = pesagens.length;
    const lotesComPesagem = new Set(pesagens.map((p) => p.lote_id)).size;

    const ultimaData = pesagens.length
      ? [...pesagens]
          .sort((a, b) => new Date(b.data) - new Date(a.data))[0]
          .data
      : '';

    const pesoMedioGeral = pesagens.length
      ? pesagens.reduce((acc, item) => acc + Number(item.peso_medio || 0), 0) /
        pesagens.length
      : 0;

    return {
      totalPesagens,
      lotesComPesagem,
      ultimaData,
      pesoMedioGeral,
    };
  }, [pesagens]);

  function abrirNovaPesagem() {
    setPesagemEditando(null);
    setAbrirForm(true);
  }

  function editarPesagem(item) {
    setPesagemEditando(item);
    setAbrirForm(true);
  }

  async function excluirPesagem(id) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir pesagem',
          message: 'Deseja excluir esta pesagem?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir esta pesagem?');
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      pesagens: prev.pesagens.filter((p) => p.id !== id),
    }));
  }

  function salvarPesagem(dados) {
    if (pesagemEditando) {
      setDb((prev) => ({
        ...prev,
        pesagens: prev.pesagens.map((p) =>
          p.id === pesagemEditando.id ? { ...p, ...dados } : p
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        pesagens: [
          ...prev.pesagens,
          {
            id: gerarNovoId(prev.pesagens),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setPesagemEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Pesagens</h1>
          <p>Registro e acompanhamento do peso médio dos lotes.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovaPesagem}>
            + Nova pesagem
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Pesagens</div>
          <div className="kpi-value">{resumo.totalPesagens}</div>
          <div className="kpi-sub">registros cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lotes com pesagem</div>
          <div className="kpi-value">{resumo.lotesComPesagem}</div>
          <div className="kpi-sub">lotes acompanhados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Peso médio geral</div>
          <div className="kpi-value">
            {formatarNumero(resumo.pesoMedioGeral)} kg
          </div>
          <div className="kpi-sub">
            última data: {formatarData(resumo.ultimaData)}
          </div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Histórico de pesagens</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma pesagem cadastrada.</strong>
              <span>Use o botão “Nova pesagem” para registrar o primeiro peso.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Data</th>
                  <th>Peso médio</th>
                  <th>Variação</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td className="text-h">{item.loteNome}</td>
                    <td>{formatarData(item.data)}</td>
                    <td>{formatarNumero(item.peso_medio)} kg</td>
                    <td>{renderVariacao(item.variacao)}</td>
                    <td>{item.observacao || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarPesagem(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirPesagem(item.id)}
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
        <PesagemForm
          initialData={pesagemEditando}
          lotes={lotes}
          onSave={salvarPesagem}
          onCancel={() => {
            setAbrirForm(false);
            setPesagemEditando(null);
          }}
        />
      )}
    </div>
  );
}




function renderVariacao(variacao) {
  if (variacao === null || variacao === undefined) return '—';

  if (variacao > 0) {
    return <span className="badge badge-g">+{formatarNumero(variacao)} kg</span>;
  }

  if (variacao < 0) {
    return <span className="badge badge-r">{formatarNumero(variacao)} kg</span>;
  }

  return <span className="badge badge-a">0,00 kg</span>;
}
