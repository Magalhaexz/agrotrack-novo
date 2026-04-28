import { useMemo, useState } from 'react';
import { calcLote, formatNumber } from '../utils/calculations'; // Assuming calcLote and formatNumber are robust
import '../styles/rebanho.css'; // Assuming this CSS file exists

// Helper para obter opções únicas para filtros
function getUniqueOptions(data, key) {
  const options = new Set(data.map(item => item[key]).filter(Boolean)); // Filter out null/undefined
  return ['todas', ...Array.from(options).sort()];
}

/**
 * Página de Comparativo de Lotes Encerrados.
 * Exibe uma tabela comparativa de lotes que foram encerrados ou vendidos,
 * permitindo filtrar e ordenar os resultados por diversas métricas.
 *
 * @param {object} props - As propriedades do componente.
 * @param {object} props.db - O objeto do banco de dados.
 */
export default function ComparativoLotesPage({ db }) {
  const [sortBy, setSortBy] = useState('margem');
  const [filtro, setFiltro] = useState({
    periodo: 'todas',
    raca: 'todas',
    categoria: 'todas',
    sexo: 'todos',
  });

  // Pré-calcula os dados de todos os lotes encerrados/vendidos uma vez que o DB muda
  const calculatedLoteData = useMemo(() => {
    return (db.lotes || [])
      .filter((l) => l.status === 'encerrado' || l.status === 'vendido')
      .map((lote) => {
        const ind = calcLote(db, lote.id); // Chamada potencialmente cara
        const heads = Math.max(ind.totalAnimais, 1);
        return {
          id: lote.id,
          nome: lote.nome,
          gmd: ind.gmdMedio,
          custoArroba: ind.custoPorArroba,
          lucroCab: ind.margem / heads,
          margem: ind.margemPct,
          dias: ind.dias,
          mortalidade: lote?.fechamento?.mortalidade || 0, // Assumindo que 'fechamento' existe no lote
          // Adicionar propriedades do lote para filtragem (assumindo que serão adicionadas ao db.lotes)
          raca: lote.raca || 'N/A',
          categoria: lote.categoria || 'N/A',
          sexo: lote.sexo || 'N/A',
          periodo: lote.periodo || 'N/A', // Exemplo de campo para filtro de período
        };
      });
  }, [db]); // Recalcula apenas quando o objeto db muda

  // Aplica filtros e ordenação nos dados pré-calculados
  const rows = useMemo(() => {
    let filteredData = calculatedLoteData;

    // Aplica filtros
    if (filtro.raca !== 'todas') {
      filteredData = filteredData.filter((l) => l.raca === filtro.raca);
    }
    if (filtro.categoria !== 'todas') {
      filteredData = filteredData.filter((l) => l.categoria === filtro.categoria);
    }
    if (filtro.sexo !== 'todos') {
      filteredData = filteredData.filter((l) => l.sexo === filtro.sexo);
    }
    if (filtro.periodo !== 'todas') {
      filteredData = filteredData.filter((l) => l.periodo === filtro.periodo);
    }

    // Aplica ordenação
    return filteredData.sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0));
  }, [calculatedLoteData, filtro, sortBy]); // Recalcula quando dados pré-calculados, filtros ou ordenação mudam

  // Define as colunas a serem exibidas e usadas para ordenação
  const cols = ['gmd', 'custoArroba', 'lucroCab', 'margem', 'dias', 'mortalidade'];

  // Calcula os valores extremos (min/max) para cada coluna para destaque visual
  const extrema = useMemo(() => {
    const result = {};
    cols.forEach((c) => {
      const values = rows.map((r) => Number(r[c] || 0));
      result[c] = {
        max: values.length ? Math.max(...values) : 0,
        min: values.length ? Math.min(...values) : 0,
      };
    });
    return result;
  }, [rows, cols]); // Recalcula quando as linhas ou colunas mudam

  // Opções para os filtros (assumindo que raca, categoria, sexo, periodo existem nos lotes)
  const racaOptions = useMemo(() => getUniqueOptions(calculatedLoteData, 'raca'), [calculatedLoteData]);
  const categoriaOptions = useMemo(() => getUniqueOptions(calculatedLoteData, 'categoria'), [calculatedLoteData]);
  const sexoOptions = useMemo(() => getUniqueOptions(calculatedLoteData, 'sexo'), [calculatedLoteData]);
  const periodoOptions = useMemo(() => getUniqueOptions(calculatedLoteData, 'periodo'), [calculatedLoteData]);


  return (
    <div className="page rebanho-page">
      <h1>Comparativo de Lotes Encerrados</h1>
      <div className="rebanho-filters">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filtro-select">
          {cols.map((c) => (
            <option key={c} value={c}>
              {c.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} {/* Formata para leitura */}
            </option>
          ))}
        </select>

        <select value={filtro.periodo} onChange={(e) => setFiltro((p) => ({ ...p, periodo: e.target.value }))} className="filtro-select">
          {periodoOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <select value={filtro.raca} onChange={(e) => setFiltro((p) => ({ ...p, raca: e.target.value }))} className="filtro-select">
          {racaOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <select value={filtro.categoria} onChange={(e) => setFiltro((p) => ({ ...p, categoria: e.target.value }))} className="filtro-select">
          {categoriaOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        <select value={filtro.sexo} onChange={(e) => setFiltro((p) => ({ ...p, sexo: e.target.value }))} className="filtro-select">
          {sexoOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Lote</th>
            <th>GMD</th>
            <th>Custo/@</th>
            <th>Lucro/Cab</th>
            <th>Margem (%)</th>
            <th>Dias</th>
            <th>Mortalidade (%)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.nome}</td>
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    background:
                      r[c] === extrema[c].max && r[c] !== 0 // Adicionado r[c] !== 0 para evitar destaque de zeros
                        ? 'var(--color-success-bg)'
                        : r[c] === extrema[c].min && r[c] !== 0
                        ? 'var(--color-danger-bg)'
                        : 'transparent',
                  }}
                >
                  {c === 'margem' || c === 'mortalidade' ? `${formatNumber(r[c], 2)}%` : formatNumber(r[c], 2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
