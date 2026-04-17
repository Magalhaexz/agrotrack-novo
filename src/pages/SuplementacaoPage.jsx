import { useMemo, useState } from 'react';
import SuplementacaoForm from '../components/SuplementacaoForm';

export default function SuplementacaoPage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  const lotes = db?.lotes || [];
  const animais = db?.animais || [];
  const estoque = db?.estoque || [];
  const suplementacao = db?.suplementacao || [];

  const dadosTabela = useMemo(() => {
    return suplementacao.map((item) => {
      const lote = lotes.find((l) => l.id === item.lote_id);
      const estoqueItem = estoque.find((e) => e.id === item.item_estoque_id);

      const cabecas = animais
        .filter((a) => a.lote_id === item.lote_id)
        .reduce((acc, a) => acc + Number(a.qtd || 0), 0);

      const consumoTotalDia =
        item.modo === 'por_cabeca'
          ? Number(item.consumo_por_cabeca_dia || 0) * cabecas
          : Number(item.consumo_total_dia || 0);

      const valorUnitario = Number(estoqueItem?.valor_unitario || 0);
      const qtdEstoque = Number(estoqueItem?.quantidade_atual || 0);

      const custoDia = consumoTotalDia * valorUnitario;
      const custoMes = custoDia * 30;
      const diasRestantes =
        consumoTotalDia > 0 ? qtdEstoque / consumoTotalDia : 0;

      return {
        ...item,
        loteNome: lote?.nome || '—',
        produtoNome: estoqueItem?.produto || '—',
        unidade: estoqueItem?.unidade || 'kg',
        cabecas,
        consumoTotalDia,
        custoDia,
        custoMes,
        qtdEstoque,
        diasRestantes,
        status: obterStatusEstoque(diasRestantes),
      };
    });
  }, [suplementacao, lotes, animais, estoque]);

  const resumo = useMemo(() => {
    const consumoDiaTotal = dadosTabela.reduce(
      (acc, item) => acc + Number(item.consumoTotalDia || 0),
      0
    );

    const custoDiaTotal = dadosTabela.reduce(
      (acc, item) => acc + Number(item.custoDia || 0),
      0
    );

    const itensCriticos = dadosTabela.filter(
      (item) => item.status === 'critico'
    ).length;

    return {
      total: suplementacao.length,
      consumoDiaTotal,
      custoDiaTotal,
      itensCriticos,
    };
  }, [dadosTabela, suplementacao]);

  function abrirNovo() {
    setItemEditando(null);
    setAbrirForm(true);
  }

  function editarItem(item) {
    setItemEditando(item);
    setAbrirForm(true);
  }

  function excluirItem(id) {
    if (!window.confirm('Deseja excluir esta suplementação?')) return;

    setDb((prev) => ({
      ...prev,
      suplementacao: prev.suplementacao.filter((s) => s.id !== id),
    }));
  }

  function salvarItem(dados) {
    if (itemEditando) {
      setDb((prev) => ({
        ...prev,
        suplementacao: prev.suplementacao.map((s) =>
          s.id === itemEditando.id ? { ...s, ...dados } : s
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        suplementacao: [
          ...prev.suplementacao,
          {
            id: gerarNovoId(prev.suplementacao),
            ...dados,
          },
        ],
      }));
    }

    setAbrirForm(false);
    setItemEditando(null);
  }

  return (
    <div className="page">
      <div className="page-header page-topbar">
        <div>
          <h1>Suplementação</h1>
          <p>Consumo por lote ligado diretamente aos itens do estoque.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovo}>
            + Nova suplementação
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Suplementações</div>
          <div className="kpi-value">{resumo.total}</div>
          <div className="kpi-sub">vinculações lote + estoque</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Consumo diário total</div>
          <div className="kpi-value">{formatarNumero(resumo.consumoDiaTotal)}</div>
          <div className="kpi-sub">somando todos os lotes</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Custo diário total</div>
          <div className="kpi-value">R$ {formatarNumero(resumo.custoDiaTotal)}</div>
          <div className="kpi-sub">
            {resumo.itensCriticos} item(ns) com estoque crítico
          </div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de suplementação</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhuma suplementação cadastrada.</strong>
              <span>Use o botão “Nova suplementação” para começar.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Produto</th>
                  <th>Cabeças</th>
                  <th>Modo</th>
                  <th>Consumo / dia</th>
                  <th>Custo / dia</th>
                  <th>Custo / mês</th>
                  <th>Estoque atual</th>
                  <th>Dias restantes</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td className="text-h">{item.loteNome}</td>
                    <td>{item.produtoNome}</td>
                    <td>{item.cabecas}</td>
                    <td>{normalizarModo(item.modo)}</td>
                    <td>
                      {formatarNumero(item.consumoTotalDia)} {item.unidade}
                    </td>
                    <td>R$ {formatarNumero(item.custoDia)}</td>
                    <td>R$ {formatarNumero(item.custoMes)}</td>
                    <td>
                      {formatarNumero(item.qtdEstoque)} {item.unidade}
                    </td>
                    <td>
                      {item.consumoTotalDia > 0
                        ? `${formatarNumero(item.diasRestantes)} dias`
                        : '—'}
                    </td>
                    <td>{renderStatus(item.status)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => editarItem(item)}
                        >
                          Editar
                        </button>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => excluirItem(item.id)}
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
        <SuplementacaoForm
          initialData={itemEditando}
          lotes={lotes}
          estoque={estoque}
          onSave={salvarItem}
          onCancel={() => {
            setAbrirForm(false);
            setItemEditando(null);
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

function normalizarModo(modo) {
  if (modo === 'por_cabeca') return 'Por cabeça';
  if (modo === 'total_lote') return 'Total do lote';
  return modo || '—';
}

function obterStatusEstoque(diasRestantes) {
  if (!Number.isFinite(diasRestantes) || diasRestantes <= 0) return 'critico';
  if (diasRestantes <= 7) return 'critico';
  if (diasRestantes <= 15) return 'baixo';
  return 'normal';
}

function renderStatus(status) {
  if (status === 'critico') {
    return <span className="badge badge-r">Crítico</span>;
  }

  if (status === 'baixo') {
    return <span className="badge badge-a">Baixo</span>;
  }

  return <span className="badge badge-g">Normal</span>;
}