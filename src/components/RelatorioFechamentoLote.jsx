import { Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatDate, formatNumber } from '../utils/calculations';

export default function RelatorioFechamentoLote({ fazenda, lote, pesagens = [], custos = [], manejos = [], saidas = [], indicadores = {}, financeiro = {} }) {
  const custoCategoria = Object.entries(custos.reduce((acc, c) => ({ ...acc, [c.cat]: (acc[c.cat] || 0) + Number(c.val || 0) }), {})).map(([cat, valor]) => ({ cat, valor }));

  return (
    <article className="ui-card" style={{ display: 'grid', gap: 16 }}>
      <header>
        <h2>Relatório de Fechamento de Lote</h2>
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
