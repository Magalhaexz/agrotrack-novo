<<<<<<< HEAD
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatarMoeda } from '../../utils/formatters';

const TOOLTIP_STYLE = {
  background: 'var(--modal-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '0.8rem',
};

function formatarEixoY(v) {
  const abs = Math.abs(v);
  if (abs >= 1000) {
    return `R$${(v / 1000).toFixed(0)}k`;
  }
  return `R$${v}`;
}

=======
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatarMoeda } from '../../utils/formatters';

>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
export default function GraficoFinanceiro({ dados = [] }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
<<<<<<< HEAD

          <XAxis
            dataKey="nome"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
          />

          <YAxis
            tickFormatter={formatarEixoY}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            domain={([min, max]) => [
              min < 0 ? Math.floor(min * 1.1) : 0,
              Math.ceil(max * 1.1),
            ]}
          />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, name) => [formatarMoeda(value), name]}
          />

          <Legend
            wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
          />

          <Bar
            dataKey="custo"
            name="Custo total"
            fill="var(--color-danger)"
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Bar
            dataKey="receita"
            name="Receita projetada"
            fill="var(--color-info)"
            radius={[4, 4, 0, 0]}
            opacity={0.8}
          />
          <Bar
            dataKey="lucro"
            name="Lucro projetado"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
          />
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
