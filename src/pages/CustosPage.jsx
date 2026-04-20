import { useMemo, useState } from 'react';
import CustoForm from '../components/CustoForm';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';

export default function CustosPage({ db, setDb, onConfirmAction }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [custoEditando, setCustoEditando] = useState(null);

  const lotes = db?.lotes || [];
  const custos = db?.custos || [];

  const dadosTabela = useMemo(() => {
    return [...custos]
      .map((custo) => {
        const lote = lotes.find((l) => l.id === custo.lote_id);
        return {
          ...custo,
          loteNome: lote?.nome || '—',
        };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [custos, lotes]);

  const resumo = useMemo(() => {
    const total = custos.reduce((acc, item) => acc + Number(item.val || 0), 0);

    const porCategoria = custos.reduce((acc, item) => {
      const categoria = item.cat || 'outros';
      acc[categoria] = (acc[categoria] || 0) + Number(item.val || 0);
      return acc;
    }, {});

    const categoriaTop =
      Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      total,
      quantidade: custos.length,
      categoriaTop,
    };
  }, [custos]);

  function abrirNovo() {
    setCustoEditando(null);
    setAbrirForm(true);
  }

  function editarCusto(custo) {
    setCustoEditando(custo);
    setAbrirForm(true);
  }

  async function excluirCusto(id) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir custo',
          message: 'Deseja excluir este custo?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este custo?');
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      custos: prev.custos.filter((c) => c.id !== id),
    }));
  }

  function salvarCusto(dados) {
    if (custoEditando) {
      setDb((prev) => ({
        ...prev,
        custos: prev.custos.map((c) =>
          c.id === custoEditando.id ? { ...c, ...dados } : c
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        custos: [
          ...prev.custos,
          {
            id: gerarNovoId(prev.custos),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setCustoEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Custos Operacionais</h1>
          <p>Lançamento e acompanhamento dos custos por lote.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Novo custo
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Total lançado</div>
          <div className="kpi-value">R$ {formatarNumero(resumo.total)}</div>
          <div className="kpi-sub">somando todos os custos</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Lançamentos</div>
          <div className="kpi-value">{resumo.quantidade}</div>
          <div className="kpi-sub">registros cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Maior categoria</div>
          <div className="kpi-value" style={{ fontSize: 24 }}>
            {resumo.categoriaTop ? normalizarCategoria(resumo.categoriaTop[0]) : '—'}
          </div>
          <div className="kpi-sub">
            {resumo.categoriaTop
              ? `R$ ${formatarNumero(resumo.categoriaTop[1])}`
              : 'sem dados'}
          </div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de custos</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum custo cadastrado.</strong>
              <span>Use o botão “Novo custo” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((custo) => (
                  <tr key={custo.id}>
                    <td>{formatarData(custo.data)}</td>
                    <td className="text-h">{custo.loteNome}</td>
                    <td>
                      <span className="badge b-blue">
                        {normalizarCategoria(custo.cat)}
                      </span>
                    </td>
                    <td>{custo.desc}</td>
                    <td>R$ {formatarNumero(custo.val)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarCusto(custo)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirCusto(custo.id)}
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
        <CustoForm
          initialData={custoEditando}
          lotes={lotes}
          onSave={salvarCusto}
          onCancel={() => {
            setAbrirForm(false);
            setCustoEditando(null);
          }}
        />
      )}
    </div>
  );
}




function normalizarCategoria(cat) {
  if (!cat) return '—';

  const mapa = {
    alimentação: 'Alimentação',
    sanitário: 'Sanitário',
    'mão de obra': 'Mão de obra',
    combustível: 'Combustível',
    manutenção: 'Manutenção',
    administrativo: 'Administrativo',
    outros: 'Outros',
  };

  return mapa[cat] || cat;
}
