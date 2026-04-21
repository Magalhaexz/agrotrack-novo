import Table from './ui/Table';

export default function DataTable({ columns, rows, emptyTitle, emptySubtitle }) {
  // Se o componente Table interno suporta emptyTitle e emptySubtitle separadamente,
  // podemos passá-los diretamente. Caso contrário, a lógica original é boa.
  // Por exemplo, se Table aceita: <Table emptyTitle="Título" emptySubtitle="Subtítulo" />
  // Então, a implementação abaixo seria mais flexível.

  // Se o Table interno só aceita uma string para a mensagem de vazio,
  // a implementação original é a mais adequada.
  const emptyMessage = emptyTitle || emptySubtitle || 'Nenhum registro encontrado';

  return (
    <Table
      columns={columns}
      rows={rows}
      emptyTitle={emptyTitle} // Passa o título separadamente
      emptySubtitle={emptySubtitle} // Passa o subtítulo separadamente
      emptyMessage={emptyMessage} // Mantém o fallback para compatibilidade ou para ser usado como texto principal
    />
  );
}