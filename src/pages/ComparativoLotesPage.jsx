import { useMemo, useState } from 'react';
import { calcLote, formatNumber } from '../utils/calculations';
import '../styles/rebanho.css';

export default function ComparativoLotesPage({ db }) {
  const [sortBy, setSortBy] = useState('margem');
  const [filtro, setFiltro] = useState({ periodo: 'todos', raca: 'todas', categoria: 'todas', sexo: 'todos' });

  const rows = useMemo(() => {
    return (db.lotes || [])
      .filter((l) => l.status === 'encerrado' || l.status === 'vendido')
      .filter((l) => (filtro.raca === 'todas' || l.raca === filtro.raca))
      .filter((l) => (filtro.categoria === 'todas' || l.categoria === filtro.categoria))
      .map((lote) => {
        const ind = calcLote(db, lote.id);
        const heads = Math.max(ind.totalAnimais, 1);
        return {
          id: lote.id,
          nome: lote.nome,
          gmd: ind.gmdMedio,
          custoArroba: ind.custoPorArroba,
          lucroCab: ind.margem / heads,
          margem: ind.margemPct,
          dias: ind.dias,
          mortalidade: lote?.fechamento?.mortalidade || 0,
        };
      })
      .sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
  }, [db, filtro, sortBy]);

  const cols = ['gmd', 'custoArroba', 'lucroCab', 'margem', 'dias', 'mortalidade'];
  const extrema = Object.fromEntries(cols.map((c) => [c, { max: Math.max(...rows.map((r) => Number(r[c] || 0), -Infinity)), min: Math.min(...rows.map((r) => Number(r[c] || 0), Infinity)) }]));

  return (
    <div className="page rebanho-page">
      <h1>Comparativo de Lotes Encerrados</h1>
      <div className="rebanho-filters">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>{cols.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input placeholder="Período" value={filtro.periodo} onChange={(e) => setFiltro((p) => ({ ...p, periodo: e.target.value }))} />
        <input placeholder="Raça" value={filtro.raca} onChange={(e) => setFiltro((p) => ({ ...p, raca: e.target.value }))} />
      </div>
      <table className="dashboard-table"><thead><tr><th>Lote</th><th>GMD</th><th>Custo/@</th><th>Lucro/Cab</th><th>Margem</th><th>Dias</th><th>Mortalidade</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.nome}</td>{cols.map((c) => <td key={c} style={{ background: r[c] === extrema[c].max ? 'var(--color-success-bg)' : r[c] === extrema[c].min ? 'var(--color-danger-bg)' : 'transparent' }}>{formatNumber(r[c], 2)}</td>)}</tr>)}</tbody></table>
    </div>
  );
}
