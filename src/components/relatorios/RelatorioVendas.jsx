import Card from '../ui/Card';
import { formatCurrency, formatNumber } from '../../utils/calculations';

export default function RelatorioVendas({ db, dataInicio, dataFim, loteIds = [] }) {
  const inicio = dataInicio || '0000-01-01';
  const fim = dataFim || '9999-12-31';

  const vendas = (db.movimentacoes_animais || []).filter((item) => {
    const okTipo = item.tipo === 'venda';
    const okData = item.data >= inicio && item.data <= fim;
    const okLote = loteIds.length === 0 || loteIds.includes(String(item.lote_id));
    return okTipo && okData && okLote;
  });

  const receitaTotal = vendas.reduce((acc, item) => acc + Number(item.valor_total || 0), 0);
  const pesoVendido = vendas.reduce((acc, item) => acc + Number(item.peso_medio || 0) * Number(item.qtd || 0), 0);
  const arrobasVendidas = pesoVendido / 15;
  const precoMedioArroba = arrobasVendidas > 0 ? receitaTotal / arrobasVendidas : 0;

  const porComprador = Object.entries(
    vendas.reduce((acc, item) => {
      const chave = item.comprador_fornecedor || 'Não informado';
      return { ...acc, [chave]: (acc[chave] || 0) + Number(item.valor_total || 0) };
    }, {})
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card title="Resumo de vendas">
        <p>Vendas no período: <strong>{vendas.length}</strong></p>
        <p>Peso vendido: <strong>{formatNumber(pesoVendido, 1)} kg</strong></p>
        <p>Arrobas vendidas: <strong>{formatNumber(arrobasVendidas, 2)} @</strong></p>
        <p>Receita total: <strong>{formatCurrency(receitaTotal)}</strong></p>
        <p>Preço médio por @: <strong>{formatCurrency(precoMedioArroba)}</strong></p>
      </Card>

      <Card title="Receita por comprador">
        <ul>
          {porComprador.map(([comprador, valor]) => (
            <li key={comprador}>{comprador}: {formatCurrency(valor)}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
