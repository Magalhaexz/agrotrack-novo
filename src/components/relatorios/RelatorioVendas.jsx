
import { useMemo } from 'react';
import Card from '../ui/Card';
import { formatCurrency, formatNumber } from '../../utils/calculations';

function formatarData(data) {
  if (!data) return '—';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export default function RelatorioVendas({ db, dataInicio, dataFim, loteIds = [] }) {
  const inicio = dataInicio || '0000-01-01';
  const fim = dataFim || '9999-12-31';


  const mapaLotes = useMemo(() =>
    Object.fromEntries((db.lotes || []).map((l) => [l.id, l])),
    [db.lotes]
  );

  const vendas = useMemo(() =>
    (db.movimentacoes_animais || []).filter((item) => {
      const okTipo = item.tipo === 'venda';
      const okData = item.data >= inicio && item.data <= fim;
      const okLote = loteIds.length === 0 || loteIds.includes(String(item.lote_id));
      return okTipo && okData && okLote;
    }),
    [db.movimentacoes_animais, inicio, fim, loteIds]
  );

  const receitaTotal = useMemo(() =>
    vendas.reduce((acc, item) => acc + Number(item.valor_total || 0), 0),
    [vendas]
  );

  const pesoVendido = useMemo(() =>
    vendas.reduce((acc, item) => acc + Number(item.peso_medio || 0) * Number(item.qtd || 0), 0),
    [vendas]
  );

  const arrobasVendidas = pesoVendido / 15;
  const precoMedioArroba = arrobasVendidas > 0 ? receitaTotal / arrobasVendidas : 0;

  const porComprador = useMemo(() =>
    Object.entries(
      vendas.reduce((acc, item) => {
        const chave = item.comprador_fornecedor || 'Não informado';
        acc[chave] = (acc[chave] || 0) + Number(item.valor_total || 0);
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]),
    [vendas]
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>


      <Card title="Resumo de vendas">
        {vendas.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
            Nenhuma venda registrada no período selecionado.
          </p>
        ) : (
          <>
            <p>Vendas no período: <strong>{vendas.length}</strong></p>
            <p>Peso vendido: <strong>{formatNumber(pesoVendido, 1)} kg</strong></p>
            <p>Arrobas vendidas: <strong>{formatNumber(arrobasVendidas, 2)} @</strong></p>
            <p>Receita total: <strong>{formatCurrency(receitaTotal)}</strong></p>
            <p>Preço médio por @: <strong>{formatCurrency(precoMedioArroba)}</strong></p>
          </>
        )}
      </Card>

      {porComprador.length > 0 && (
        <Card title="Receita por comprador">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Comprador</th>
                  <th>Receita</th>
                  <th>Participação</th>
                </tr>
              </thead>
              <tbody>
                {porComprador.map(([comprador, valor]) => (
                  <tr key={comprador}>
                    <td>{comprador}</td>
                    <td>{formatCurrency(valor)}</td>
                    <td>
                      {receitaTotal > 0
                        ? `${((valor / receitaTotal) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {vendas.length > 0 && (
        <Card title="Detalhamento de vendas">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Comprador</th>
                  <th>Qtd</th>
                  <th>Peso médio</th>
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((item) => (
                  <tr key={item.id}>
                    <td>{formatarData(item.data)}</td>
                    <td>{mapaLotes[item.lote_id]?.nome || '—'}</td>
                    <td>{item.comprador_fornecedor || '—'}</td>
                    <td>{item.qtd ?? '—'}</td>
                    <td>{item.peso_medio ? `${formatNumber(item.peso_medio, 1)} kg` : '—'}</td>
                    <td>{formatCurrency(item.valor_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

    </div>
  );
}
