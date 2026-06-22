import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildRelatorioFinanceiro } from '../domain/relatorios';
import { gerarResumoFinanceiroTexto } from '../domain/whatsappResumo';
import { formatCurrency, formatDate } from '../utils/calculations';

export default function RelatorioFinanceiroPage({ db, onNavigate }) {
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const lotes = Array.isArray(db?.lotes) ? db.lotes : [];
  const [fazendaId, setFazendaId] = useState('');
  const [loteId, setLoteId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const containerRef = useRef(null);

  const relatorio = useMemo(
    () => buildRelatorioFinanceiro(db, { fazendaId: fazendaId || null, loteId: loteId || null, dataInicio, dataFim }),
    [db, fazendaId, loteId, dataInicio, dataFim]
  );

  const semLancamentos = relatorio.totalLancamentos === 0;

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatório Financeiro"
        subtitle="Veja o que entrou, o que saiu e o saldo do período."
      />

      <Card title="Filtros">
        <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <select className="ui-input" value={fazendaId} onChange={(e) => { setFazendaId(e.target.value); setLoteId(''); }}>
            <option value="">Todas as fazendas</option>
            {fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select className="ui-input" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
            <option value="">Todos os lotes</option>
            {lotes
              .filter((l) => !fazendaId || String(l.fazenda_id ?? l.faz_id) === String(fazendaId))
              .map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <input className="ui-input" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          <input className="ui-input" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </Card>

      {semLancamentos ? (
        <EmptyState
          title="Ainda não há lançamentos financeiros no período."
          subtitle="Lance custos e receitas para entender o resultado dos lotes."
          action={<Button size="sm" onClick={() => onNavigate?.('financeiro')}>Ir para Financeiro</Button>}
        />
      ) : (
        <>
          <AcoesRelatorio
            containerRef={containerRef}
            getTexto={() => gerarResumoFinanceiroTexto(relatorio)}
            titulo="Relatório Financeiro"
            nomeArquivo="relatorio-financeiro"
          />

          <div ref={containerRef}>
            <div className="dashboard-grid dashboard-grid--dual">
              <Card title="Resumo">
                <div className="summary-list">
                  <Row label="Entrou" value={formatCurrency(relatorio.entrou)} />
                  <Row label="Saiu" value={formatCurrency(relatorio.saiu)} />
                  <Row label="Saldo" value={formatCurrency(relatorio.saldo)} />
                  <Row label="Contas a receber" value={formatCurrency(relatorio.contasAReceber)} />
                  <Row label="Contas a pagar" value={formatCurrency(relatorio.contasAPagar)} />
                </div>
              </Card>

              <Card title="Custos principais">
                {!relatorio.maioresCategorias.length ? (
                  <EmptyState compact title="Sem despesas registradas no período." />
                ) : (
                  <div className="summary-list">
                    {relatorio.maioresCategorias.map((item) => (
                      <Row key={item.categoria} label={item.categoria} value={formatCurrency(item.total)} />
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="dashboard-grid dashboard-grid--dual">
              <Card title="Contas vencidas">
                {!relatorio.contasVencidas.length ? (
                  <EmptyState compact title="Nenhuma conta vencida." />
                ) : (
                  <ContasTable contas={relatorio.contasVencidas} />
                )}
              </Card>

              <Card title="Contas próximas do vencimento">
                {!relatorio.contasProximas.length ? (
                  <EmptyState compact title="Nenhuma conta próxima do vencimento." />
                ) : (
                  <ContasTable contas={relatorio.contasProximas} />
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ContasTable({ contas }) {
  return (
    <div className="table-responsive">
      <table className="data-table">
        <thead><tr><th>Descrição</th><th>Vencimento</th><th>Valor</th></tr></thead>
        <tbody>
          {contas.map((c) => (
            <tr key={c.id}>
              <td>{c.descricao || c.categoria || 'Despesa'}</td>
              <td>{formatDate(c.data_vencimento || c.data)}</td>
              <td>{formatCurrency(c.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="summary-row">
      <span className="summary-row__label">{label}</span>
      <strong className="summary-row__value">{value ?? '—'}</strong>
    </div>
  );
}
