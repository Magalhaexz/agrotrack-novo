<<<<<<< HEAD
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatarData(d) {
  const dt = new Date(`${d}T00:00:00`);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function obterCorLote(coresLotes, index) {
  if (!coresLotes?.length) return '#8884d8';
  return coresLotes[index % coresLotes.length];
}

export default function CurvasCrescimento({ dadosGrafico = [], lotes = [], coresLotes = [] }) {
  function obterNomeLote(name) {
    const loteId = Number(String(name).replace('lote_', ''));
    return lotes.find((l) => l.id === loteId)?.nome || name;
  }

=======
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CurvasCrescimento({ dadosGrafico = [], lotes = [], db, coresLotes = [] }) {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
<<<<<<< HEAD

          <XAxis
            dataKey="data"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={formatarData}
          />

          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => `${v}kg`}
            domain={([min, max]) => [Math.floor(min - 30), Math.ceil(max + 30)]}
          />

=======
          <XAxis
            dataKey="data"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={(d) => {
              const dt = new Date(`${d}T00:00:00`);
              return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
            }}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={(v) => `${v}kg`}
            domain={['dataMin - 30', 'dataMax + 30']}
          />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          <Tooltip
            contentStyle={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
            }}
<<<<<<< HEAD
            formatter={(value, name) => [`${value}kg`, obterNomeLote(name)]}
          />

          <Legend
            formatter={obterNomeLote}
            wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
          />

=======
            formatter={(value, name) => {
              const loteId = Number(String(name).replace('lote_', ''));
              const lote = db.lotes.find((l) => l.id === loteId);
              return [`${value}kg`, lote?.nome || name];
            }}
          />
          <Legend
            formatter={(value) => {
              const loteId = Number(String(value).replace('lote_', ''));
              const lote = db.lotes.find((l) => l.id === loteId);
              return lote?.nome || value;
            }}
            wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
          />
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          {lotes.map((lote, i) => (
            <Line
              key={lote.id}
              type="monotone"
              dataKey={`lote_${lote.id}`}
<<<<<<< HEAD
              stroke={obterCorLote(coresLotes, i)}
              strokeWidth={2}
              dot={{ r: 4, fill: obterCorLote(coresLotes, i) }}
=======
              stroke={coresLotes[i % coresLotes.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: coresLotes[i % coresLotes.length] }}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
<<<<<<< HEAD

          {lotes.map((lote, i) =>
=======
          {lotes.map((lote, i) => (
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            lote.meta_peso ? (
              <ReferenceLine
                key={`meta-${lote.id}`}
                y={lote.meta_peso}
<<<<<<< HEAD
                stroke={obterCorLote(coresLotes, i)}
=======
                stroke={coresLotes[i % coresLotes.length]}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                strokeDasharray="5 5"
                opacity={0.4}
                label={{
                  value: `Meta ${lote.nome?.split(' ')[0]}: ${lote.meta_peso}kg`,
<<<<<<< HEAD
                  fill: obterCorLote(coresLotes, i),
=======
                  fill: coresLotes[i % coresLotes.length],
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                  fontSize: 10,
                }}
              />
            ) : null
<<<<<<< HEAD
          )}
=======
          ))}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
