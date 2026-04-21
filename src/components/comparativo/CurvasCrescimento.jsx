import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CurvasCrescimento({ dadosGrafico = [], lotes = [], db, coresLotes = [] }) {
  return (
    <div style={{ height: 340 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dadosGrafico}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
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
          <Tooltip
            contentStyle={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '0.8rem',
            }}
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
          {lotes.map((lote, i) => (
            <Line
              key={lote.id}
              type="monotone"
              dataKey={`lote_${lote.id}`}
              stroke={coresLotes[i % coresLotes.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: coresLotes[i % coresLotes.length] }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          ))}
          {lotes.map((lote, i) => (
            lote.meta_peso ? (
              <ReferenceLine
                key={`meta-${lote.id}`}
                y={lote.meta_peso}
                stroke={coresLotes[i % coresLotes.length]}
                strokeDasharray="5 5"
                opacity={0.4}
                label={{
                  value: `Meta ${lote.nome?.split(' ')[0]}: ${lote.meta_peso}kg`,
                  fill: coresLotes[i % coresLotes.length],
                  fontSize: 10,
                }}
              />
            ) : null
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
