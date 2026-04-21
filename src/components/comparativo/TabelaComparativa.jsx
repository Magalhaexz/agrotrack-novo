<<<<<<< HEAD
import { useMemo } from 'react';

const ESTILO_DESTAQUE = {
  color: 'var(--color-primary)',
  fontWeight: 700,
};

function calcularMelhorPorIndicador(lotes, linha) {
  if (!linha.highlight) return [];

  const valores = lotes.map((l) => ({
    id: l.id,
    valor: linha.valores?.[l.id]?.raw ?? null,
  }));

  const validos = valores.filter((v) => Number.isFinite(Number(v.valor)));
  if (!validos.length) return [];

  const nums = validos.map((v) => Number(v.valor));
  const alvo = linha.highlight === 'min' ? Math.min(...nums) : Math.max(...nums);

  return validos.filter((v) => Number(v.valor) === alvo).map((v) => v.id);
}

export default function TabelaComparativa({ lotes = [], indicadores = [] }) {
  const destacadosPorIndicador = useMemo(() => {
    return Object.fromEntries(
      indicadores.map((linha) => [
        linha.key,
        calcularMelhorPorIndicador(lotes, linha),
      ])
    );
  }, [lotes, indicadores]);

  if (!lotes.length || !indicadores.length) {
    return (
      <div className="table-responsive">
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Nenhum dado disponível para comparação.
        </p>
      </div>
    );
  }
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

  return (
    <div className="table-responsive">
      <table className="compare-table">
        <thead>
          <tr>
            <th>Indicador</th>
<<<<<<< HEAD
            {lotes.map((l) => (
              <th key={l.id}>{l.nome}</th>
            ))}
=======
            {lotes.map((l) => <th key={l.id}>{l.nome}</th>)}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
          </tr>
        </thead>
        <tbody>
          {indicadores.map((linha) => {
<<<<<<< HEAD
            const destacados = destacadosPorIndicador[linha.key] ?? [];

=======
            const destacados = linha.highlight ? melhorPorIndicador(linha.key, linha.highlight) : [];
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
            return (
              <tr key={linha.key}>
                <td>{linha.label}</td>
                {lotes.map((l) => (
<<<<<<< HEAD
                  <td
                    key={`${linha.key}-${l.id}`}
                    style={destacados.includes(l.id) ? ESTILO_DESTAQUE : undefined}
                  >
                    {linha.valores?.[l.id]?.display || '—'}
=======
                  <td key={`${linha.key}-${l.id}`} style={destacados?.includes(l.id) ? { color: 'var(--color-primary)', fontWeight: 700 } : undefined}>
                    {linha.valores[l.id]?.display || '—'}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
