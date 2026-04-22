import { useMemo } from 'react';

const ESTILO_DESTAQUE = {
  color: 'var(--color-primary)',
  fontWeight: 700,
};

function calcularMelhorPorIndicador(lotes, linha) {
  if (!linha.highlight) return [];

  const valores = lotes.map((lote) => ({
    id: lote.id,
    valor: linha.valores?.[lote.id]?.raw ?? null,
  }));

  const validos = valores.filter((item) => Number.isFinite(Number(item.valor)));
  if (!validos.length) return [];

  const numeros = validos.map((item) => Number(item.valor));
  const alvo = linha.highlight === 'min' ? Math.min(...numeros) : Math.max(...numeros);

  return validos.filter((item) => Number(item.valor) === alvo).map((item) => item.id);
}

export default function TabelaComparativa({ lotes = [], indicadores = [] }) {
  const destacadosPorIndicador = useMemo(
    () => Object.fromEntries(indicadores.map((linha) => [linha.key, calcularMelhorPorIndicador(lotes, linha)])),
    [indicadores, lotes]
  );

  if (!lotes.length || !indicadores.length) {
    return (
      <div className="comparativo-empty-state">
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
          Nenhum dado disponivel para comparacao.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="table-responsive comparativo-table-wrap desktop-table">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-table-indicator-head">Indicador</th>
              {lotes.map((lote) => (
                <th key={lote.id} className="compare-table-lote-head">{lote.nome}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicadores.map((linha) => {
              const destacados = destacadosPorIndicador[linha.key] ?? [];

              return (
                <tr key={linha.key}>
                  <th scope="row" className="compare-table-indicator-cell">{linha.label}</th>
                  {lotes.map((lote) => (
                    <td
                      key={`${linha.key}-${lote.id}`}
                      className={`compare-table-value ${destacados.includes(lote.id) ? 'is-highlight' : ''}`}
                      style={destacados.includes(lote.id) ? ESTILO_DESTAQUE : undefined}
                    >
                      {linha.valores?.[lote.id]?.display || '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="compare-mobile-list mobile-table-cards">
        {indicadores.map((linha) => {
          const destacados = destacadosPorIndicador[linha.key] ?? [];

          return (
            <article className="compare-mobile-card" key={linha.key}>
              <header className="compare-mobile-header">
                <span className="compare-mobile-kicker">Indicador</span>
                <strong>{linha.label}</strong>
              </header>

              <div className="compare-mobile-values">
                {lotes.map((lote) => {
                  const destaque = destacados.includes(lote.id);

                  return (
                    <div className={`compare-mobile-value-row ${destaque ? 'is-highlight' : ''}`} key={`${linha.key}-${lote.id}`}>
                      <span>{lote.nome}</span>
                      <strong style={destaque ? ESTILO_DESTAQUE : undefined}>
                        {linha.valores?.[lote.id]?.display || '-'}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
