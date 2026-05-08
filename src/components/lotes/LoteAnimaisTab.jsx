import Card from '../ui/Card';
import { formatNumber } from '../../utils/calculations';

export default function LoteAnimaisTab({ animais }) {
  return (
    <Card title="Animais" subtitle="Distribuição de grupos vinculados ao lote">
      <div className="lote-table-wrap">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Sexo</th>
              <th>Grupo genético</th>
              <th>Cabeças</th>
              <th>Peso inicial</th>
              <th>Peso atual</th>
            </tr>
          </thead>
          <tbody>
            {animais.length ? animais.map((item) => (
              <tr key={item.id}>
                <td>{item.sexo || '—'}</td>
                <td>{item.gen || item.raca || '—'}</td>
                <td>{formatNumber(item.qtd, 0)}</td>
                <td>{formatNumber(item.p_ini, 1)} kg</td>
                <td>{formatNumber(item.p_at, 1)} kg</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5}>Nenhum registro de animais para este lote.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
