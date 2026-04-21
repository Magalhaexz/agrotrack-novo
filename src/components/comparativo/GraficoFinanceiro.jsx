import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatarMoeda } from '../../utils/formatters';

export default function GraficoFinanceiro({ dados = [] }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="nome" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
          <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
            }}
            formatter={(v) => [formatarMoeda(v)]}
          />
          <Legend wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }} />
          <Bar dataKey="custo" name="Custo total" fill="var(--color-danger)" radius={[4, 4, 0, 0]} opacity={0.8} />
          <Bar dataKey="receita" name="Receita projetada" fill="var(--color-info)" radius={[4, 4, 0, 0]} opacity={0.8} />
          <Bar dataKey="lucro" name="Lucro projetado" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
