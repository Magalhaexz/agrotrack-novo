import Table from './ui/Table';

export default function DataTable({ columns, rows, emptyTitle, emptySubtitle }) {
  const message = emptyTitle || emptySubtitle || 'Nenhum registro encontrado';
  return <Table columns={columns} rows={rows} emptyMessage={message} />;
}
