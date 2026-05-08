function pad(n){return String(n).padStart(2,'0');}
function hojeIso(){const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function formatPtDate(value){if(!value)return ''; const d=new Date(value); if(Number.isNaN(d.getTime())) return String(value); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;}
function formatPtNumber(value){const n=Number(value); if(!Number.isFinite(n)) return value==null?'':String(value); return n.toFixed(2).replace('.',',');}
function escapeCsv(v){const t=String(v??''); if(/[;"\n\r]/.test(t)) return `"${t.replace(/"/g,'""')}"`; return t;}
function normalizeCellValue(value, type){if(value==null) return ''; if(type==='date') return formatPtDate(value); if(type==='number'||type==='currency') return formatPtNumber(value); return String(value);}
export function exportarCsvCompatExcel({ filename, rows = [], columns = [], locale = 'pt-BR' }) {
  void locale;
  const safeName = filename || `relatorio-herdon-${hojeIso()}`;
  const header = columns.map((c) => escapeCsv(c.header || c.label || c.key)).join(';');
  const lines = rows.map((row) => columns.map((c) => {
    const raw = typeof c.accessor === 'function' ? c.accessor(row) : row?.[c.key];
    return escapeCsv(normalizeCellValue(raw, c.type));
  }).join(';'));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${safeName}.csv`; a.click(); URL.revokeObjectURL(a.href);
}

function escapeXml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function sheetName(name){return String(name||'Planilha').slice(0,31).replace(/[\\/:*?[\]]/g,'-');}
export function exportarXlsx({ filename, sheets = [] }) {
  const workbookName = filename || `relatorio-herdon-${hojeIso()}`;
  const xmlSheets = sheets.map((sheet) => {
    const cols = sheet.columns || [];
    const rows = sheet.rows || [];
    const colDefs = cols.map(() => '<ss:Column ss:Width="120"/>').join('');
    const headerCells = cols.map((c) => `<ss:Cell><ss:Data ss:Type="String">${escapeXml(c.header || c.label || c.key)}</ss:Data></ss:Cell>`).join('');
    const rowXml = rows.map((r) => `<ss:Row>${cols.map((c) => {
      const raw = typeof c.accessor === 'function' ? c.accessor(r) : r?.[c.key];
      const val = normalizeCellValue(raw, c.type);
      return `<ss:Cell><ss:Data ss:Type="String">${escapeXml(val)}</ss:Data></ss:Cell>`;
    }).join('')}</ss:Row>`).join('');
    return `<ss:Worksheet ss:Name="${escapeXml(sheetName(sheet.name))}"><ss:Table>${colDefs}<ss:Row>${headerCells}</ss:Row>${rowXml}</ss:Table></ss:Worksheet>`;
  }).join('');
  const xml = `<?xml version="1.0"?><ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${xmlSheets}</ss:Workbook>`;
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${workbookName}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
}
