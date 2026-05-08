import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatDate, formatNumber } from '../../utils/calculations';

export default function LotePesagensTab({ pesagens, onNovaPesagem, canEditPesagem }) {
  return (
    <Card
      title="Pesagens"
      subtitle="Histórico de pesagem por lote"
      action={<Button size="sm" onClick={onNovaPesagem} disabled={!canEditPesagem}>Nova pesagem</Button>}
    >
      <div className="lote-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Peso médio</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {pesagens.length ? pesagens.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.data)}</td>
                <td>{formatNumber(item.peso_medio, 1)} kg</td>
                <td>{item.observacao || '—'}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={3}>Nenhuma pesagem registrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
