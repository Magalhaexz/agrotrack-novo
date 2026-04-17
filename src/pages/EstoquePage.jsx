import { useMemo, useState } from 'react';
import EstoqueForm from '../components/EstoqueForm';

export default function EstoquePage({ db, setDb }) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  const estoque = db?.estoque || [];

  const dadosTabela = useMemo(() => {
    return estoque.map((item) => ({
      ...item,
      valorTotal:
        Number(item.quantidade_atual || 0) * Number(item.valor_unitario || 0),
      status: obterStatus(item),
      statusValidade: obterStatusValidade(
        item.data_validade,
        item.alerta_dias_antes
      ),
    }));
  }, [estoque]);

  const resumo = useMemo(() => {
    const valorTotal = estoque.reduce(
      (acc, item) =>
        acc +
        Number(item.quantidade_atual || 0) * Number(item.valor_unitario || 0),
      0
    );

    const criticos = estoque.filter(
      (item) =>
        Number(item.quantidade_atual || 0) <=
        Number(item.quantidade_minima || 0)
    ).length;

    const itens = estoque.length;

    return { valorTotal, criticos, itens };
  }, [estoque]);

  function abrirNovoItem() {
    setItemEditando(null);
    setAbrirForm(true);
  }

  function editarItem(item) {
    setItemEditando(item);
    setAbrirForm(true);
  }

  function excluirItem(id) {
    if (!window.confirm('Deseja excluir este item do estoque?')) return;

    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.filter((item) => item.id !== id),
    }));
  }

  function salvarItem(dados) {
    if (itemEditando) {
      setDb((prev) => ({
        ...prev,
        estoque: prev.estoque.map((item) =>
          item.id === itemEditando.id ? { ...item, ...dados } : item
        ),
      }));
    } else {
      setDb((prev) => ({
        ...prev,
        estoque: [
          ...prev.estoque,
          {
            id: gerarNovoId(prev.estoque),
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
          <h1>Estoque</h1>
          <p>Controle de insumos, materiais sanitários e entradas por NF.</p>
        </div>

        <div className="page-topbar-actions">
          <button className="primary-btn" onClick={abrirNovoItem}>
            + Novo item
          </button>
        </div>
      </div>

      <div className="kpi-grid-3">
        <div className="kpi-card">
          <div className="kpi-label">Itens em estoque</div>
          <div className="kpi-value">{resumo.itens}</div>
          <div className="kpi-sub">produtos cadastrados</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Valor estimado</div>
          <div className="kpi-value">R$ {formatarNumero(resumo.valorTotal)}</div>
          <div className="kpi-sub">quantidade atual x valor unitário</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Itens críticos</div>
          <div className="kpi-value">{resumo.criticos}</div>
          <div className="kpi-sub">abaixo ou no estoque mínimo</div>
        </div>
      </div>

      <div className="fazendas-card">
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Lista de estoque</span>
        </div>

        <div className="fazendas-table-wrap">
          {dadosTabela.length === 0 ? (
            <div className="empty-box">
              <strong>Nenhum item em estoque.</strong>
              <span>Use o botão “Novo item” para cadastrar o primeiro.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th>Qtd atual</th>
                  <th>Qtd mínima</th>
                  <th>Valor unit.</th>
                  <th>Valor total</th>
                  <th>Origem</th>
                  <th>NF</th>
                  <th>Entrada</th>
                  <th>Validade</th>
                  <th>Alerta validade</th>
                  <th>Status estoque</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dadosTabela.map((item) => (
                  <tr key={item.id}>
                    <td className="text-h">{item.produto}</td>
                    <td>{item.categoria}</td>
                    <td>{item.unidade}</td>
                    <td>{formatarNumero(item.quantidade_atual)}</td>
                    <td>{formatarNumero(item.quantidade_minima)}</td>
                    <td>R$ {formatarNumero(item.valor_unitario)}</td>
                    <td>R$ {formatarNumero(item.valorTotal)}</td>
                    <td>{item.origem}</td>
                    <td>{item.numero_nf || '—'}</td>
                    <td>{formatarData(item.data_entrada)}</td>
                    <td>{formatarData(item.data_validade)}</td>
                    <td>{renderStatusValidade(item.statusValidade)}</td>
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
        <EstoqueForm
          initialData={itemEditando}
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

function formatarData(data) {
  if (!data) return '—';
  const [ano, mes, dia] = String(data).split('-');
  return `${dia}/${mes}/${ano}`;
}

function obterStatus(item) {
  const atual = Number(item.quantidade_atual || 0);
  const minimo = Number(item.quantidade_minima || 0);

  if (atual <= minimo) return 'critico';
  if (atual <= minimo * 1.5) return 'baixo';
  return 'normal';
}

function obterStatusValidade(dataValidade, alertaDiasAntes = 0) {
  if (!dataValidade) return 'sem-validade';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const validade = new Date(dataValidade);
  validade.setHours(0, 0, 0, 0);

  const diffDias = Math.round((validade - hoje) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'vencido';
  if (diffDias <= Number(alertaDiasAntes || 0)) return 'proximo';
  return 'ok';
}

function renderStatusValidade(status) {
  if (status === 'vencido') {
    return <span className="badge badge-r">Vencido</span>;
  }

  if (status === 'proximo') {
    return <span className="badge badge-a">Vence em breve</span>;
  }

  if (status === 'ok') {
    return <span className="badge badge-g">Dentro da validade</span>;
  }

  return <span className="badge badge-n">Sem validade</span>;
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