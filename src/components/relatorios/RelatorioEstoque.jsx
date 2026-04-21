import { useMemo } from 'react';
import Card from '../ui/Card';
import { formatCurrency, formatNumber } from '../../utils/calculations';

function formatarData(data) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarTipo(tipo) {
  const tipos = {
    entrada: 'Entrada',
    saida: 'Saída',
    ajuste: 'Ajuste',
  };
  return tipos[tipo] || tipo;
}

export default function RelatorioEstoque({ db, dataInicio, dataFim }) {
  const inicio = dataInicio || '0000-01-01';
  const fim = dataFim || '9999-12-31';

  const movimentos = useMemo(() =>
    (db.movimentacoes_estoque || []).filter(
      (item) => item.data >= inicio && item.data <= fim
    ),
    [db.movimentacoes_estoque, inicio, fim]
  );

  const entradas = useMemo(() => movimentos.filter((m) => m.tipo === 'entrada'), [movimentos]);
  const saidas = useMemo(() => movimentos.filter((m) => m.tipo !== 'entrada'), [movimentos]);

  const saldoAtual = useMemo(() =>
    (db.estoque || []).reduce((acc, item) => acc + Number(item.quantidade_atual || 0), 0),
    [db.estoque]
  );

  const custoPorCategoria = useMemo(() =>
    (db.estoque || []).reduce((acc, item) => {
      const categoria = item.categoria || 'Outros';
      const custo = Number(item.valor_unitario || 0) * Number(item.quantidade_atual || 0);
      acc[categoria] = (acc[categoria] || 0) + custo;
      return acc;
    }, {}),
    [db.estoque]
  );

  // mapas para lookup por id
  const mapaEstoque = useMemo(() =>
    Object.fromEntries((db.estoque || []).map((i) => [i.id, i])),
    [db.estoque]
  );

  const mapaLotes = useMemo(() =>
    Object.fromEntries((db.lotes || []).map((l) => [l.id, l])),
    [db.lotes]
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <Card title="Indicadores de estoque">
        <p>Entradas no período: <strong>{entradas.length}</strong></p>
        <p>Saídas no período: <strong>{saidas.length}</strong></p>
        <p>Saldo atual (unidades): <strong>{formatNumber(saldoAtual, 0)}</strong></p>
      </Card>

      <Card title="Custo por categoria">
        {Object.entries(custoPorCategoria).length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Nenhum item em estoque.
          </p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {Object.entries(custoPorCategoria).map(([categoria, valor]) => (
              <li key={categoria}>
                {categoria}: <strong>{formatCurrency(valor)}</strong>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Movimentações de estoque">
        {movimentos.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Nenhuma movimentação no período selecionado.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Item</th>
                  <th>Qtd</th>
                  <th>Valor</th>
                  <th>Lote</th>
                </tr>
              </thead>
              <tbody>
                {movimentos.map((m) => (
                  <tr key={m.id}>
                    <td>{formatarData(m.data)}</td>
                    <td>{formatarTipo(m.tipo)}</td>
                    <td>{mapaEstoque[m.item_estoque_id]?.nome || m.item_estoque_id || '—'}</td>
                    <td>{m.quantidade}</td>
                    <td>{formatCurrency(m.valor_total)}</td>
                    <td>{mapaLotes[m.lote_id]?.nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}