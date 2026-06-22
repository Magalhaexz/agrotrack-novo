import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildRelatorioPastagens } from '../domain/relatorios';
import { gerarResumoPastagensTexto } from '../domain/whatsappResumo';
import { formatNumber } from '../utils/calculations';

export default function RelatorioPastagensPage({ db }) {
  const fazendas = Array.isArray(db?.fazendas) ? db.fazendas : [];
  const [fazendaId, setFazendaId] = useState('');
  const containerRef = useRef(null);

  const relatorio = useMemo(
    () => buildRelatorioPastagens(db, { fazendaId: fazendaId || null }),
    [db, fazendaId]
  );

  if (!relatorio.totalPastos) {
    return (
      <div className="page reports-page">
        <PageHeader title="Relatório de Pastos" />
        <EmptyState title="Cadastre os pastos da fazenda para acompanhar a ocupação." />
      </div>
    );
  }

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatório de Pastos"
        subtitle="Veja quais pastos estão ocupados e quais estão vazios."
      />

      <Card title="Filtros">
        <select className="ui-input" value={fazendaId} onChange={(e) => setFazendaId(e.target.value)}>
          <option value="">Todas as fazendas</option>
          {fazendas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </Card>

      <AcoesRelatorio
        containerRef={containerRef}
        getTexto={() => gerarResumoPastagensTexto(relatorio)}
        titulo="Relatório de Pastos"
        nomeArquivo="relatorio-pastos"
      />

      <div ref={containerRef}>
        <div className="dashboard-grid dashboard-grid--dual">
          <Card title="Resumo">
            <div className="summary-list">
              <Row label="Total de pastos" value={formatNumber(relatorio.totalPastos, 0)} />
              <Row label="Pastos com lote" value={formatNumber(relatorio.pastosComLote, 0)} />
              <Row label="Pastos vazios" value={formatNumber(relatorio.pastosSemLote, 0)} />
              <Row label="Lotes sem pasto" value={formatNumber(relatorio.lotesSemPasto, 0)} />
            </div>
            <p className="empty-state-description" style={{ marginTop: 12 }}>
              Estimativa simples por cabeças, sem cálculo de UA.
            </p>
          </Card>

          <Card title="Excesso de cabeças (estimativa)">
            {!relatorio.pastosComIndicioDeExcesso?.length ? (
              <EmptyState compact title="Nenhum pasto com indício de excesso." />
            ) : (
              <div className="summary-list">
                {relatorio.pastosComIndicioDeExcesso.map((p) => (
                  <Row key={p.id} label={p.nome} value="Acima da capacidade estimada" />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Ocupação por pasto">
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Pasto</th><th>Área (ha)</th><th>Cabeças</th><th>Lotes</th></tr></thead>
              <tbody>
                {relatorio.ocupacaoPorPasto.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.areaHa != null ? formatNumber(p.areaHa, 1) : '—'}</td>
                    <td>{formatNumber(p.cabecas, 0)}</td>
                    <td>{p.lotesNoPasto.length ? p.lotesNoPasto.join(', ') : 'Sem lote'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
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
