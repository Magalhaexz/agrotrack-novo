import { useMemo, useState } from 'react';
import EstoqueForm from '../components/EstoqueForm';
import EntradaEstoqueModal from '../components/EntradaEstoqueModal';
import SaidaEstoqueModal from '../components/SaidaEstoqueModal';
import { formatarNumero, formatarData } from '../utils/formatters';
import { gerarNovoId } from '../utils/id';
import { TIPOS_MOVIMENTACAO_ESTOQUE } from '../utils/constantes';

export default function EstoquePage({
  db,
  setDb,
  onRegistrarEntradaEstoque,
  onRegistrarSaidaEstoque,
  onConfirmAction,
}) {
  const [abrirForm, setAbrirForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [abrirEntrada, setAbrirEntrada] = useState(false);
  const [itemSaidaId, setItemSaidaId] = useState(null);
  const [filtroTipoMov, setFiltroTipoMov] = useState('');
  const [filtroItemMov, setFiltroItemMov] = useState('');

  const estoque = db?.estoque || [];
  const lotes = db?.lotes || [];
  const movimentacoesEstoque = db?.movimentacoes_estoque || [];

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
      criticoHistorico: isCriticoHistorico(item, movimentacoesEstoque),
    }));
  }, [estoque, movimentacoesEstoque]);

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoesEstoque
      .filter((mov) =>
        filtroTipoMov ? mov.tipo === filtroTipoMov : true
      )
      .filter((mov) =>
        filtroItemMov ? String(mov.item_estoque_id) === String(filtroItemMov) : true
      )
      .map((mov) => {
        const item = estoque.find((e) => e.id === mov.item_estoque_id);
        const lote = lotes.find((l) => l.id === mov.lote_id);
        return {
          ...mov,
          itemNome: item?.produto || '—',
          unidade: item?.unidade || 'un',
          loteNome: lote?.nome || '—',
        };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [movimentacoesEstoque, filtroTipoMov, filtroItemMov, estoque, lotes]);

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

  async function excluirItem(id) {
    const confirmado = typeof onConfirmAction === 'function'
      ? await onConfirmAction({
          title: 'Excluir item de estoque',
          message: 'Deseja excluir este item do estoque?',
          tone: 'danger',
        })
      : window.confirm('Deseja excluir este item do estoque?');
    if (!confirmado) return;

    setDb((prev) => ({
      ...prev,
      estoque: prev.estoque.filter((item) => item.id !== id),
    }));
  }

  function salvarItem(dados) {
    if (Number(dados.quantidade_atual || 0) < 0) {
      alert(
        `Estoque insuficiente. Saldo disponível: ${formatarNumero(
          Math.max(Number(itemEditando?.quantidade_atual || 0), 0)
        )}`
      );
      return;
    }

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
          <button className="primary-btn" onClick={() => setAbrirEntrada(true)}>
            + Entrada
          </button>
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
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <strong
                          style={{
                            color: '#dff9cc',
                            fontSize: 14,
                          }}
                        >
                          {formatarNumero(item.quantidade_atual)} {item.unidade}
                        </strong>
                        {renderStatus(item.status)}
                        {item.criticoHistorico ? (
                          <span className="badge badge-r">Crítico histórico</span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="action-btn"
                          onClick={() => setItemSaidaId(item.id)}
                        >
                          Saída / Consumo
                        </button>
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

      <div className="fazendas-card" style={{ marginTop: 24 }}>
        <div className="fazendas-card-header">
          <span className="fazendas-card-title">Movimentações</span>
        </div>

        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <select
              value={filtroTipoMov}
              onChange={(e) => setFiltroTipoMov(e.target.value)}
              style={filtroStyle}
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TIPOS_MOVIMENTACAO_ESTOQUE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={filtroItemMov}
              onChange={(e) => setFiltroItemMov(e.target.value)}
              style={filtroStyle}
            >
              <option value="">Todos os itens</option>
              {estoque.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.produto}
                </option>
              ))}
            </select>
          </div>

          <div className="fazendas-table-wrap">
            {movimentacoesFiltradas.length === 0 ? (
              <div className="empty-box">
                <strong>Nenhuma movimentação encontrada.</strong>
                <span>Registre entradas e saídas para acompanhar o histórico.</span>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Item</th>
                    <th>Tipo</th>
                    <th>Quantidade</th>
                    <th>Lote vinculado</th>
                    <th>Valor</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesFiltradas.map((mov) => (
                    <tr key={mov.id}>
                      <td>{formatarData(mov.data)}</td>
                      <td className="text-h">{mov.itemNome}</td>
                      <td>{normalizarTipoMov(mov.tipo)}</td>
                      <td>{formatarNumero(mov.quantidade)} {mov.unidade}</td>
                      <td>{mov.lote_id ? mov.loteNome : '—'}</td>
                      <td>R$ {formatarNumero(mov.valor_total || 0)}</td>
                      <td>{mov.obs || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
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

      {abrirEntrada ? (
        <EntradaEstoqueModal
          itens={estoque}
          handleRegistrarEntradaEstoque={(dados) => {
            if (typeof onRegistrarEntradaEstoque === 'function') {
              onRegistrarEntradaEstoque(dados);
            }
          }}
          onClose={() => setAbrirEntrada(false)}
        />
      ) : null}

      {itemSaidaId ? (
        <SaidaEstoqueModal
          itens={estoque}
          lotes={lotes}
          itemInicialId={itemSaidaId}
          handleRegistrarSaidaEstoque={(dados) => {
            if (typeof onRegistrarSaidaEstoque === 'function') {
              onRegistrarSaidaEstoque(dados);
            }
          }}
          onClose={() => setItemSaidaId(null)}
        />
      ) : null}
    </div>
  );
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

function normalizarTipoMov(tipo) {
  return TIPOS_MOVIMENTACAO_ESTOQUE[tipo] || tipo || '—';
}

function isCriticoHistorico(item, movimentacoes) {
  const atual = Number(item.quantidade_atual || 0);
  const historicoItem = movimentacoes.filter(
    (mov) => Number(mov.item_estoque_id) === Number(item.id)
  );

  const maiorHistorico = Math.max(
    atual,
    ...historicoItem.map((mov) => Number(mov.quantidade || 0))
  );

  if (!maiorHistorico) return false;
  return atual < maiorHistorico * 0.1;
}

const filtroStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #2e4020',
  background: '#0f160b',
  color: '#cce0a8',
};
