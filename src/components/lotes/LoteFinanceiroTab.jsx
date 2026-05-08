import Card from '../ui/Card';
import { formatCurrency, formatDate } from '../../utils/calculations';

export default function LoteFinanceiroTab({ movimentos, resumo }) {
  return (
    <Card title="Financeiro" subtitle="Receitas e despesas vinculadas ao lote">
      <div className="metrics-2col lote-details-grid" style={{ marginBottom: 16 }}>
        <p><strong>Receita total:</strong> {formatCurrency(resumo.receitaTotal)}</p>
        <p><strong>Custo total:</strong> {formatCurrency(resumo.custoTotal)}</p>
        <p><strong>Resultado:</strong> {formatCurrency(resumo.lucroTotal)}</p>
        <p><strong>Margem:</strong> {Number.isFinite(resumo.margemPct) ? `${resumo.margemPct.toFixed(2)}%` : '—'}</p>
      </div>

      <div className="lote-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {movimentos.length ? movimentos.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.data)}</td>
                <td>{item.tipo || '—'}</td>
                <td>{item.categoria || '—'}</td>
                <td>{item.descricao || '—'}</td>
                <td>{formatCurrency(item.valor)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>Sem lançamentos financeiros para este lote.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
