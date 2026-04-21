import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../ui/Card';
import { calcLote, formatCurrency, formatNumber } from '../../utils/calculations';

const TOOLTIP_STYLE = {
  background: 'var(--modal-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '0.8rem',
};

function formatarEixoY(v) {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v}`;
}

export default function RelatorioLote({ db, loteIds = [] }) {
  const dados = useMemo(() => {
    const lotes = (db.lotes || []).filter(
      (l) => loteIds.length === 0 || loteIds.includes(String(l.id))
    );

    return lotes.map((lote) => {
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
  }, [db, loteIds]);

  if (!dados.length) {
    return (
      <Card title="Dados do lote e indicadores zootécnicos">
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Nenhum lote disponível para exibição.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      <Card title="Dados do lote e indicadores zootécnicos">
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Animais</th>
                <th>GMD</th>
                <th>Receita</th>
                <th>Margem</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((item) => (
                <tr key={item.id}>
                  <td>{item.lote}</td>
                  <td>{item.animais}</td>
                  <td>{formatNumber(item.gmd, 3)} kg/dia</td>
                  <td>{formatCurrency(item.receita)}</td>
                  <td style={{ color: item.margem >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {formatCurrency(item.margem)}
                  </td>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />

              <XAxis
                dataKey="lote"
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              />

              <YAxis
                tickFormatter={formatarEixoY}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              />

              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [
                  formatCurrency(value),
                  name === 'receita' ? 'Receita' : 'Margem',
                ]}
              />

              <Legend
                wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
              />

              <Bar dataKey="receita" name="Receita" fill="var(--color-info)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="margem" name="Margem" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

    </div>
  );
}