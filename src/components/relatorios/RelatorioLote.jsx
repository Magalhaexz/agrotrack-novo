import Card from '../ui/Card';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calcLote, formatCurrency, formatNumber } from '../../utils/calculations';

export default function RelatorioLote({ db, loteIds = [] }) {
  const lotes = db.lotes.filter((l) => loteIds.length === 0 || loteIds.includes(String(l.id)));
  const dados = lotes.map((lote) => {
    const i = calcLote(db, lote.id);
    return {
      id: lote.id,
      lote: lote.nome,
      animais: i.totalAnimais,
      gmd: i.gmdMedio,
      margem: i.margem,
      receita: i.receitaTotal,
    };
  });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Dados do lote e indicadores zootécnicos">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead><tr><th>Lote</th><th>Animais</th><th>GMD</th><th>Receita</th><th>Margem</th></tr></thead>
            <tbody>
              {dados.map((item) => (
                <tr key={item.id}>
                  <td>{item.lote}</td><td>{item.animais}</td><td>{formatNumber(item.gmd, 3)} kg/dia</td>
                  <td>{formatCurrency(item.receita)}</td><td>{formatCurrency(item.margem)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Resultado financeiro por lote" subtitle="Gráfico resumido de receita x margem">
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados}>
              <XAxis dataKey="lote" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="receita" fill="#4f46e5" />
              <Bar dataKey="margem" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
