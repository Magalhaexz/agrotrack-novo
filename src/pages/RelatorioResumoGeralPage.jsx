import { useMemo, useRef } from 'react';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import AcoesRelatorio from '../components/relatorios/AcoesRelatorio';
import { buildResumoGeralFazenda } from '../domain/relatorios';
import { gerarResumoGeralTexto } from '../domain/whatsappResumo';
import { formatCurrency, formatNumber } from '../utils/calculations';
import { isModoConsolidado } from '../domain/escopoFazenda';

export default function RelatorioResumoGeralPage({ db, fazendaSelecionada }) {
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const containerRef = useRef(null);
  const resumo = useMemo(() => buildResumoGeralFazenda(db), [db]);

  return (
    <div className="page reports-page">
      <PageHeader
        title="Resumo Geral da Fazenda"
        subtitle={`${consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Todas as fazendas')} · Um resumo rápido para enviar ao dono, sócio ou gerente.`}
      />

      <AcoesRelatorio
        containerRef={containerRef}
        getTexto={() => gerarResumoGeralTexto(resumo)}
        titulo="Resumo Geral da Fazenda"
        nomeArquivo="resumo-geral-fazenda"
      />

      <div ref={containerRef}>
        <div className="report-kpi-grid">
          <Card title="Fazendas"><strong className="metric-tile__value">{formatNumber(resumo.totalFazendas, 0)}</strong></Card>
          <Card title="Pastos"><strong className="metric-tile__value">{formatNumber(resumo.totalPastos, 0)}</strong></Card>
          <Card title="Lotes ativos"><strong className="metric-tile__value">{formatNumber(resumo.totalLotesAtivos, 0)}</strong></Card>
        </div>

        <div className="dashboard-grid dashboard-grid--dual">
          <Card title="Rebanho">
            <div className="summary-list">
              <Row label="Cabeças" value={formatNumber(resumo.totalCabecas, 0)} />
              <Row label="Peso médio geral" value={`${formatNumber(resumo.pesoMedioGeral, 1)} kg`} />
            </div>
          </Card>
          <Card title="Resultado financeiro">
            <div className="summary-list">
              <Row label="Resultado estimado" value={formatCurrency(resumo.lucroTotalFazenda)} />
            </div>
          </Card>
        </div>

        <Card title="Alertas críticos">
          {!resumo.alertasCriticos.length ? (
            <EmptyState compact title="Nenhum alerta crítico no momento." />
          ) : (
            <div className="summary-list">
              {resumo.alertasCriticos.map((a) => (
                <Row key={a.id} label={a.titulo} value={a.tipoLabel} />
              ))}
            </div>
          )}
        </Card>

        <Card title="Pendências do dia">
          {!resumo.pendencias.length ? (
            <EmptyState compact title="Nenhuma pendência no momento." />
          ) : (
            <div className="summary-list">
              {resumo.pendencias.map((p) => (
                <div className="summary-row" key={p.id}>
                  <span className="summary-row__label">{p.texto}</span>
                </div>
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
