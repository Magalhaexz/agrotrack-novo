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

  return (
    <div className="table-responsive">
      <table className="compare-table">
        <thead>
          <tr>
            <th>Indicador</th>
            {lotes.map((l) => (
              <th key={l.id}>{l.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {indicadores.map((linha) => {
            const destacados = destacadosPorIndicador[linha.key] ?? [];

            return (
              <tr key={linha.key}>
                <td>{linha.label}</td>
                {lotes.map((l) => (
                  <td
                    key={`${linha.key}-${l.id}`}
                    style={destacados.includes(l.id) ? ESTILO_DESTAQUE : undefined}
                  >
                    {linha.valores?.[l.id]?.display || '—'}
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