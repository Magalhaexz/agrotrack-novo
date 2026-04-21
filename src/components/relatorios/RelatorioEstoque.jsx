import Card from '../ui/Card';
import { formatCurrency, formatNumber } from '../../utils/calculations';

export default function RelatorioEstoque({ db, dataInicio, dataFim }) {
  const inicio = dataInicio || '0000-01-01';
  const fim = dataFim || '9999-12-31';

  const movimentos = (db.movimentacoes_estoque || []).filter(
    (item) => item.data >= inicio && item.data <= fim
  );

  const entradas = movimentos.filter((m) => m.tipo === 'entrada');
  const saidas = movimentos.filter((m) => m.tipo !== 'entrada');
  const saldoAtual = (db.estoque || []).reduce((acc, item) => acc + Number(item.quantidade_atual || 0), 0);

  const custoPorCategoria = (db.estoque || []).reduce((acc, item) => {
    const categoria = item.categoria || 'outros';
    const custo = Number(item.valor_unitario || 0) * Number(item.quantidade_atual || 0);
    return { ...acc, [categoria]: (acc[categoria] || 0) + custo };
  }, {});

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Indicadores de estoque">
        <p>Entradas no período: <strong>{entradas.length}</strong></p>
        <p>Saídas no período: <strong>{saidas.length}</strong></p>
        <p>Saldo atual (unidades): <strong>{formatNumber(saldoAtual, 0)}</strong></p>
      </Card>
      <Card title="Custo por categoria">
        <ul>
          {Object.entries(custoPorCategoria).map(([categoria, valor]) => (
            <li key={categoria}>{categoria}: {formatCurrency(valor)}</li>
          ))}
        </ul>
      </Card>
      <Card title="Movimentações de estoque">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Data</th><th>Tipo</th><th>Item</th><th>Qtd</th><th>Valor</th><th>Lote</th></tr></thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id}>
                  <td>{m.data}</td><td>{m.tipo}</td><td>{m.item_estoque_id}</td><td>{m.quantidade}</td><td>{formatCurrency(m.valor_total)}</td><td>{m.lote_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
