<<<<<<< HEAD
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COR_FALLBACK = '#8884d8';

const TOOLTIP_STYLE = {
  background: 'var(--modal-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: '8px',
  color: 'var(--color-text)',
  fontSize: '0.8rem',
};

function obterCor(coresLotes, index) {
  if (!coresLotes?.length) return COR_FALLBACK;
  return coresLotes[index % coresLotes.length] || COR_FALLBACK;
}

function formatarGmd(v) {
  const num = Number(v);
  if (!num || isNaN(num)) return 'Sem dados';
  return `${num.toFixed(3)} kg/dia`;
}
=======
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

export default function GraficoGmd({ dados = [], coresLotes = [] }) {
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
<<<<<<< HEAD

          <XAxis
            type="number"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => `${v} kg/d`}
          />

          <YAxis
            type="category"
            dataKey="nome"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            width={120}
          />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [formatarGmd(v), 'GMD']}
          />

          <Bar dataKey="gmd" radius={[0, 4, 4, 0]}>
            {dados.map((entry, index) => (
              <Cell
                key={entry.id ?? index}
                fill={obterCor(coresLotes, index)}
              />
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
