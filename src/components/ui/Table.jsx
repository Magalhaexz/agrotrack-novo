import { FileSearch } from 'lucide-react';

export default function Table({ columns, rows, emptyMessage = 'Nenhum registro encontrado' }) {
  if (!rows?.length) {
    return (
      <div className="ui-table-empty ui-card">
        <FileSearch size={22} style={{ margin: '0 auto 8px' }} />
        <p>{emptyMessage}</p>
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
                  <td key={column.key}>{row[column.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-table-cards">
        {rows.map((row, index) => (
          <div className="mobile-card" key={row.id || index}>
            <div className="mobile-card-header">
              <span className="mobile-card-title">{row.nome || row.titulo || `Registro ${index + 1}`}</span>
            </div>
            <div className="mobile-card-body">
              {columns.map((column) => (
                <div className="mobile-card-row" key={column.key}>
                  <span className="mobile-card-label">{column.label}</span>
                  <span className="mobile-card-value">{row[column.key]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
