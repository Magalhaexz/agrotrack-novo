export default function TabelaComparativa({ lotes = [], indicadores = [] }) {
  const melhorPorIndicador = (chave, strategy = 'max') => {
    const valores = lotes.map((l) => ({ id: l.id, valor: indicadores.find((r) => r.key === chave)?.valores?.[l.id]?.raw ?? null }));
    const validos = valores.filter((v) => Number.isFinite(Number(v.valor)));
    if (!validos.length) return null;
    const alvo = strategy === 'min'
      ? Math.min(...validos.map((v) => Number(v.valor)))
      : Math.max(...validos.map((v) => Number(v.valor)));
    return validos.filter((v) => Number(v.valor) === alvo).map((v) => v.id);
  };

  return (
    <div className="table-responsive">
      <table className="compare-table">
        <thead>
          <tr>
            <th>Indicador</th>
            {lotes.map((l) => <th key={l.id}>{l.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {indicadores.map((linha) => {
            const destacados = linha.highlight ? melhorPorIndicador(linha.key, linha.highlight) : [];
            return (
              <tr key={linha.key}>
                <td>{linha.label}</td>
                {lotes.map((l) => (
                  <td key={`${linha.key}-${l.id}`} style={destacados?.includes(l.id) ? { color: 'var(--color-primary)', fontWeight: 700 } : undefined}>
                    {linha.valores[l.id]?.display || '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
