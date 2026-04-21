<<<<<<< HEAD
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

// Cores para o gráfico de pizza (exemplo)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A6'];

// Componente auxiliar para exibir uma seção do relatório
function ReportSection({ title, children }) {
  return (
    <section style={{ marginBottom: '16px' }}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

// Componente auxiliar para exibir dados em formato de parágrafo
function DataParagraph({ label, value, formatFn = (v) => v, unit = '' }) {
  return (
    <p>
      <strong>{label}:</strong> {formatFn(value)}{unit}
    </p>
  );
}

export default function RelatorioFechamentoLote({
  fazenda,
  lote,
  pesagens = [],
  custos = [],
  manejos = [],
  saidas = [],
  indicadores = {},
  financeiro = {},
}) {
  // Agrupa custos por categoria para o gráfico de pizza
  const custoCategoria = Object.entries(
    custos.reduce((acc, c) => ({ ...acc, [c.cat]: (acc[c.cat] || 0) + Number(c.val || 0) }), {})
  ).map(([cat, valor]) => ({ cat, valor }));
=======
import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

export default function RelatorioFechamentoLote({ fazenda, lote, pesagens = [], custos = [], manejos = [], saidas = [], indicadores = {}, financeiro = {} }) {
  const custoCategoria = Object.entries(custos.reduce((acc, c) => ({ ...acc, [c.cat]: (acc[c.cat] || 0) + Number(c.val || 0) }), {})).map(([cat, valor]) => ({ cat, valor }));
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  return (
    <article className="ui-card" style={{ display: 'grid', gap: 16 }}>
      <header>
        <h2>Relatório de Fechamento de Lote</h2>
<<<<<<< HEAD
        <p>
          {fazenda?.nome} · {lote?.nome} · {formatDate(lote?.entrada)} a {formatDate(lote?.data_encerramento)}
        </p>
      </header>

      <ReportSection title="1. Dados de entrada">
        <p>
          Origem: {lote?.fornecedor || '—'} · Raça: {lote?.raca || '—'} · Peso: {formatNumber(lote?.peso_inicial, 1)} kg · Qtd: {lote?.qtd_inicial || '—'} · Custo: {formatCurrency(lote?.investimento)}
        </p>
      </ReportSection>

      <ReportSection title="2. Histórico de pesagens">
        {pesagens.length > 0 ? (
          <>
            <table className="dashboard-table" aria-label="Histórico de pesagens do lote">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Peso médio</th>
                </tr>
              </thead>
              <tbody>
                {pesagens.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.data)}</td>
                    <td>{formatNumber(p.peso_medio, 1)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ height: 220, marginTop: '16px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={pesagens.map((p) => ({ ...p, label: formatDate(p.data) }))}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  aria-label="Gráfico de linha do peso médio por data"
                >
                  <XAxis dataKey="label" />
                  <YAxis unit="kg" />
                  <Tooltip formatter={(value) => `${formatNumber(value, 1)} kg`} />
                  <Line type="monotone" dataKey="peso_medio" stroke="#1b4332" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p>Nenhuma pesagem registrada para este lote.</p>
        )}
      </ReportSection>

      <ReportSection title="3. Consumo de insumos por categoria">
        {custoCategoria.length > 0 ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart aria-label="Gráfico de pizza do consumo de insumos por categoria">
                <Pie
                  data={custoCategoria}
                  dataKey="valor"
                  nameKey="cat"
                  outerRadius={80}
                  label={({ cat, percent }) => `${cat}: ${(percent * 100).toFixed(0)}%`}
                >
                  {custoCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>Nenhum custo de insumo registrado para este lote.</p>
        )}
      </ReportSection>

      <ReportSection title="4. Manejos realizados">
        {manejos.length > 0 ? (
          <ul>
            {manejos.map((m) => (
              <li key={m.id}>
                {m.desc} · {formatDate(m.data_aplic || m.proxima)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum manejo registrado para este lote.</p>
        )}
      </ReportSection>

      <ReportSection title="5. Dados de saída">
        {saidas.length > 0 ? (
          <ul>
            {saidas.map((s) => (
              <li key={s.id}>
                {s.tipo} · {formatDate(s.data)} · {formatNumber(s.peso_medio, 1)} kg · {formatCurrency(s.valorTotal || s.valor || 0)}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma saída registrada para este lote.</p>
        )}
      </ReportSection>

      <ReportSection title="6. Indicadores zootécnicos">
        <p>
          GMD: {formatNumber(indicadores.gmd_real, 1)} g/dia · Arrobas/cab: {formatNumber(indicadores.arrobas_por_cab, 2)} · Mortalidade: {formatNumber(indicadores.mortalidade, 2)}%
        </p>
      </ReportSection>

      <ReportSection title="7. Resultado financeiro completo">
        <p>
          Custo total: {formatCurrency(financeiro.custoTotal)} · Receita: {formatCurrency(financeiro.receitaTotal)} · Lucro: {formatCurrency(financeiro.lucroBruto)} · Margem: {formatNumber(financeiro.margem, 2)}%
        </p>
      </ReportSection>
    </article>
  );
}
=======
        <p>{fazenda?.nome} · {lote?.nome} · {formatDate(lote?.entrada)} a {formatDate(lote?.data_encerramento)}</p>
      </header>

      <section><h3>1. Dados de entrada</h3><p>Origem: {lote?.fornecedor || '—'} · Raça: {lote?.raca || '—'} · Peso: {formatNumber(lote?.peso_inicial, 1)} kg · Qtd: {lote?.qtd_inicial || '—'} · Custo: {formatCurrency(lote?.investimento)}</p></section>
      <section><h3>2. Histórico de pesagens</h3><table className="dashboard-table"><thead><tr><th>Data</th><th>Peso médio</th></tr></thead><tbody>{pesagens.map((p) => <tr key={p.id}><td>{formatDate(p.data)}</td><td>{formatNumber(p.peso_medio, 1)} kg</td></tr>)}</tbody></table><div style={{ height: 220 }}><ResponsiveContainer width="100%" height={200}><LineChart data={pesagens.map((p) => ({ ...p, label: formatDate(p.data) }))}><XAxis dataKey="label" /><YAxis unit="kg" /><Tooltip /><Line dataKey="peso_medio" stroke="#1b4332" /></LineChart></ResponsiveContainer></div></section>
      <section><h3>3. Consumo de insumos por categoria</h3><div style={{ height: 220 }}><ResponsiveContainer width="100%" height={200}><PieChart><Pie data={custoCategoria} dataKey="valor" nameKey="cat" outerRadius={80} /><Tooltip /></PieChart></ResponsiveContainer></div></section>
      <section><h3>4. Manejos realizados</h3>{manejos.map((m) => <p key={m.id}>{m.desc} · {formatDate(m.data_aplic || m.proxima)}</p>)}</section>
      <section><h3>5. Dados de saída</h3>{saidas.map((s) => <p key={s.id}>{s.tipo} · {formatDate(s.data)} · {formatNumber(s.peso_medio, 1)} kg · {formatCurrency(s.valorTotal || s.valor || 0)}</p>)}</section>
      <section><h3>6. Indicadores zootécnicos</h3><p>GMD: {formatNumber(indicadores.gmd_real, 1)} g/dia · Arrobas/cab: {formatNumber(indicadores.arrobas_por_cab, 2)} · Mortalidade: {formatNumber(indicadores.mortalidade, 2)}%</p></section>
      <section><h3>7. Resultado financeiro completo</h3><p>Custo total: {formatCurrency(financeiro.custoTotal)} · Receita: {formatCurrency(financeiro.receitaTotal)} · Lucro: {formatCurrency(financeiro.lucroBruto)} · Margem: {formatNumber(financeiro.margem, 2)}%</p></section>
    </article>
  );
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
