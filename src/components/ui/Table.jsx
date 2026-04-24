import EmptyState from '../EmptyState';

function getCellValue(row, column) {
  if (typeof column.render === 'function') {
    return column.render(row);
  }

  return row?.[column.key];
}

function resolveMobileText(row, key, fallback) {
  if (typeof key === 'function') {
    return key(row);
  }

  if (typeof key === 'string' && row?.[key] != null) {
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
}) {
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

  return (
    <>
      <div className="ui-table-wrap desktop-table">
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
    </>
  );
}
