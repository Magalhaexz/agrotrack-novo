import EmptyState from '../EmptyState';
import useScrollEdges from '../../hooks/useScrollEdges';

function isRenderablePrimitive(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}

function getCellValue(row, column) {
  const rawValue = typeof column.render === 'function'
    ? column.render(row)
    : row?.[column.key];
  return isRenderablePrimitive(rawValue) ? rawValue : '-';
}

function resolveMobileText(row, key, fallback) {
  if (typeof key === 'function') {
    return key(row);
  }

  if (typeof key === 'string' && isRenderablePrimitive(row?.[key])) {
    return row[key];
  }

  return fallback;
}

export default function Table({
  columns,
  rows,
  emptyMessage = 'Nenhum registro encontrado',
  emptyTitle,
  emptySubtitle,
  mobileTitleKey,
  mobileSubtitleKey,
  // Sprint Visual 5 (tabelas densas): 'cards' (padrão) empilha um card por
  // linha no mobile — ótimo pra registros lidos um de cada vez. 'scroll'
  // mantém a tabela real com rolagem horizontal também no mobile, para
  // tabelas onde comparar valores entre linhas lado a lado importa mais
  // (ex.: Resultados/Panorama por lote) — ver .ui-table-wrap--force-scroll.
  mobileMode = 'cards',
}) {
  // Hooks sempre antes de qualquer return condicional (regra do React) —
  // o empty state abaixo não usa o resultado, mas o hook precisa rodar em
  // toda renderização na mesma ordem.
  const [scrollRef, edges] = useScrollEdges([rows]);

  if (!rows?.length) {
    return (
      <div className="ui-table-empty ui-card">
        <EmptyState
          compact
          title={emptyTitle || emptyMessage}
          subtitle={emptySubtitle}
        />
      </div>
    );
  }

  const forceScroll = mobileMode === 'scroll';
  const outerClass = [
    'ui-table-outer',
    'desktop-table',
    forceScroll && 'ui-table-wrap--force-scroll',
    edges.left && 'can-scroll-left',
    edges.right && 'can-scroll-right',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={outerClass}>
        <span className="ui-table-fade ui-table-fade--left" aria-hidden="true" />
        <span className="ui-table-fade ui-table-fade--right" aria-hidden="true" />
        <div className="ui-table-wrap" ref={scrollRef}>
          <table className="ui-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || index}>
                  {columns.map((column) => (
                    <td key={column.key}>{getCellValue(row, column)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {forceScroll && edges.right ? (
        <p className="ui-table-scroll-hint">Deslize para o lado para ver mais colunas →</p>
      ) : null}

      {forceScroll ? null : (
        <div className="mobile-table-cards">
          {rows.map((row, index) => {
            const fallbackTitle = row.nome || row.titulo || row.label || `Registro ${index + 1}`;
            const title = resolveMobileText(row, mobileTitleKey, fallbackTitle);
            const subtitle = resolveMobileText(row, mobileSubtitleKey, null);

            return (
              <div className="mobile-card" key={row.id || index}>
                <div className="mobile-card-header">
                  <div>
                    <span className="mobile-card-title">{title}</span>
                    {subtitle ? <small className="mobile-card-subtitle">{subtitle}</small> : null}
                  </div>
                </div>
                <div className="mobile-card-body">
                  {columns.map((column) => (
                    <div className="mobile-card-row" key={column.key}>
                      <span className="mobile-card-label">{column.label}</span>
                      <span className="mobile-card-value">{getCellValue(row, column)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
