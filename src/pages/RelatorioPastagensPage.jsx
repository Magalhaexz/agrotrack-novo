import { useMemo, useRef, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildRelatorioPastagens } from '../domain/relatorios';
import { gerarResumoPastagensTexto } from '../domain/whatsappResumo';
import { formatNumber } from '../utils/calculations';

export default function RelatorioPastagensPage({ db, onNavigate }) {
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
        <EmptyState
          title="Cadastre os pastos da fazenda para acompanhar a ocupação."
          subtitle="Com os pastos cadastrados, você vê onde cada lote está e recebe alertas de lotação."
          action={<Button size="sm" onClick={() => onNavigate?.('pastagens')}>Ir para Pastos</Button>}
        />
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

          <Card title="Pastos que precisam de atenção">
            {!relatorio.pastosEmAtencao?.length && !relatorio.pastosAcimaCapacidade?.length ? (
              <EmptyState compact title="Nenhum pasto em atenção ou acima da capacidade." />
            ) : (
              <div className="summary-list">
                {relatorio.pastosAcimaCapacidade.map((p) => (
                  <Row key={p.id} label={p.nome} value="Acima da capacidade" />
                ))}
                {relatorio.pastosEmAtencao.map((p) => (
                  <Row key={p.id} label={p.nome} value="Atenção" />
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card title="Ocupação por pasto">
          <p className="empty-state-description" style={{ marginBottom: 12 }}>
            Estimativa operacional baseada na capacidade informada do pasto. Não substitui cálculo técnico de lotação por UA.
          </p>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pasto</th>
                  <th>Área (ha)</th>
                  <th>Lotes ativos</th>
                  <th>Cabeças estimadas</th>
                  <th>Peso médio estimado</th>
                  <th>Ocupação</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.ocupacaoPorPasto.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td>{p.areaHa != null ? formatNumber(p.areaHa, 1) : '—'}</td>
                    <td>{p.lotesAtivos.length ? p.lotesAtivos.map((l) => l.nome).join(', ') : 'Sem lote'}</td>
                    <td>{formatNumber(p.cabecasEstimadas, 0)}</td>
                    <td>{p.pesoMedioEstimado ? `${formatNumber(p.pesoMedioEstimado, 1)} kg` : '—'}</td>
                    <td>{p.percentualOcupacao != null ? `${formatNumber(p.percentualOcupacao * 100, 0)}%` : '—'}</td>
                    <td>{p.statusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Lotes sem pasto definido">
          {!relatorio.lotesSemPastoDetalhe?.length ? (
            <EmptyState compact title="Todos os lotes ativos têm pasto definido." />
          ) : (
            <div className="summary-list">
              {relatorio.lotesSemPastoDetalhe.map((l) => (
                <Row key={l.id} label={l.nome || `Lote ${l.id}`} value="Sem pasto" />
              ))}
            </div>
          )}
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
