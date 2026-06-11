import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

const LABELS = {
  venda: 'Venda',
  morte: 'Morte',
  descarte: 'Descarte',
  transferencia_saida: 'Transferência de saída',
  abate: 'Abate',
  outro: 'Outro',
};

export default function LoteRetiradasTab({ retiradas, onNovaRetirada, canMove }) {
  return (
    <Card
      title="Retiradas"
      subtitle="Saídas de animais por venda, abate, transferência e demais motivos"
      action={<Button size="sm" onClick={onNovaRetirada} disabled={!canMove}>Registrar venda parcial</Button>}
    >
      <div className="lote-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Cabeças</th>
              <th>Peso médio</th>
              <th>Valor total</th>
              <th>Destino / comprador</th>
            </tr>
          </thead>
          <tbody>
            {retiradas.length ? retiradas.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.data)}</td>
                <td>{LABELS[item.tipo] || item.tipo || '—'}</td>
                <td>{formatNumber(item.qtd, 0)}</td>
                <td>{formatNumber(item.peso_medio, 1)} kg</td>
                <td>{formatCurrency(item.valor_total)}</td>
                <td>{item.comprador_fornecedor || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6}>Nenhuma retirada registrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
