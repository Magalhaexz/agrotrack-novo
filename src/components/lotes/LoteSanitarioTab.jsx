import Card from '../ui/Card';
import { formatDate, formatNumber } from '../../utils/calculations';

export default function LoteSanitarioTab({ itens }) {
  return (
    <Card title="Sanitário" subtitle="Aplicações e próximos manejos">
      <div className="lote-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Aplicação</th>
              <th>Próxima data</th>
              <th>Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {itens.length ? itens.map((item) => (
              <tr key={item.id}>
                <td>{item.tipo || '—'}</td>
                <td>{item.desc || '—'}</td>
                <td>{formatDate(item.data_aplic)}</td>
                <td>{formatDate(item.proxima)}</td>
                <td>{formatNumber(item.qtd, 0)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>Nenhum manejo sanitário neste lote.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
