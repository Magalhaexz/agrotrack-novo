import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function GraficoGmd({ dados = [], coresLotes = [] }) {
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis type="number" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} tickFormatter={(v) => `${v} kg/d`} />
          <YAxis type="category" dataKey="nome" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} width={120} />
          <Tooltip
            contentStyle={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
            }}
            formatter={(v) => [`${Number(v).toFixed(3)} kg/dia`, 'GMD']}
          />
          <Bar dataKey="gmd" fill="var(--color-primary)" radius={[0, 4, 4, 0]}>
            {dados.map((entry, index) => (
              <Cell key={entry.id || index} fill={coresLotes[index % coresLotes.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
