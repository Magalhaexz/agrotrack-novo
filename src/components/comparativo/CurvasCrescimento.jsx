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

  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />

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

          <Tooltip
            contentStyle={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
            }}
            formatter={(value, name) => [`${value}kg`, obterNomeLote(name)]}
          />

          <Legend
            formatter={obterNomeLote}
            wrapperStyle={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
          />

          {lotes.map((lote, i) => (
            <Line
              key={lote.id}
              type="monotone"
              dataKey={`lote_${lote.id}`}
              stroke={obterCorLote(coresLotes, i)}
              strokeWidth={2}
              dot={{ r: 4, fill: obterCorLote(coresLotes, i) }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}

          {lotes.map((lote, i) =>
            lote.meta_peso ? (
              <ReferenceLine
                key={`meta-${lote.id}`}
                y={lote.meta_peso}
                stroke={obterCorLote(coresLotes, i)}
                strokeDasharray="5 5"
                opacity={0.4}
                label={{
                  value: `Meta ${lote.nome?.split(' ')[0]}: ${lote.meta_peso}kg`,
                  fill: obterCorLote(coresLotes, i),
                  fontSize: 10,
                }}
              />
            ) : null
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}