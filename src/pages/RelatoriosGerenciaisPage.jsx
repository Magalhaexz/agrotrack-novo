import { useMemo } from 'react';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import { computeIndicadoresEstrategicos } from '../domain/indicadoresEstrategicos';
import { calcularProjecaoCenario } from '../domain/simuladorCenarios';

function nowPeriod() {
  const today = new Date();
  const year = today.getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function formatNumber(value, digits = 2, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `${number.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}${suffix}`;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `R$ ${number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value) {
  return formatNumber(value, 2, '%');
}

export default function RelatoriosGerenciaisPage({ db }) {
  const period = useMemo(() => nowPeriod(), []);
  const indicadores = useMemo(
    () => computeIndicadoresEstrategicos(db, period.start, period.end),
    [db, period.start, period.end]
  );
  const cenarios = useMemo(() => (Array.isArray(db?.cenarios) ? db.cenarios : []), [db]);

  const cenariosResumo = useMemo(() => (
    cenarios.map((cenario) => ({
      ...cenario,
      projecao: calcularProjecaoCenario(
        db,
        String(cenario?.periodo_inicio || period.start),
        String(cenario?.periodo_fim || period.end),
        cenario
      ),
    }))
  ), [cenarios, db, period.start, period.end]);

  const statusLotacaoSuperlotado = indicadores?.pastagem?.statusLotacao === 'superlotado';

  return (
    <div className="page reports-page">
      <PageHeader
        title="Relatórios"
        subtitle="Resumo executivo consolidado para leitura estratégica da operação."
      />

      <Card title="Resumo da fazenda" subtitle={`Período: ${period.start} até ${period.end}`}>
        <div className="summary-panel">
          <div className="report-kpi-grid">
            <article className="metric-tile">
              <span className="metric-tile__label">Rebanho ativo</span>
              <strong className="metric-tile__value">{formatNumber(indicadores?.evolucao?.resumo?.estoque_final, 0)}</strong>
              <span className="metric-tile__meta">Estoque final consolidado no período analisado.</span>
            </article>
            <article className="metric-tile">
              <span className="metric-tile__label">Lotes monitorados</span>
              <strong className="metric-tile__value">{formatNumber(Array.isArray(db?.lotes) ? db.lotes.length : 0, 0)}</strong>
              <span className="metric-tile__meta">Quantidade total de lotes considerados no relatório.</span>
            </article>
            <article className="metric-tile">
              <span className="metric-tile__label">Fazendas cadastradas</span>
              <strong className="metric-tile__value">{formatNumber(Array.isArray(db?.fazendas) ? db.fazendas.length : 0, 0)}</strong>
              <span className="metric-tile__meta">Base de propriedades disponível para leitura gerencial.</span>
            </article>
            <article className={`metric-tile ${statusLotacaoSuperlotado ? 'metric-tile--warning' : 'metric-tile--success'}`}>
              <span className="metric-tile__label">Status de lotação</span>
              <strong className="metric-tile__value">
                {statusLotacaoSuperlotado ? 'Superlotado' : 'Dentro da capacidade'}
              </strong>
              <span className="metric-tile__meta">Visão imediata da pressão sobre as áreas de pastagem.</span>
            </article>
          </div>
        </div>
      </Card>

      <div className="dashboard-grid dashboard-grid--dual">
        <Card title="Indicadores técnicos">
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row__label">Taxa de desfrute</span>
              <strong className="summary-row__value">{formatPercent(indicadores?.tecnicos?.desfrutePct)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Taxa de abate</span>
              <strong className="summary-row__value">{formatPercent(indicadores?.tecnicos?.taxaAbatePct)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Crescimento do rebanho</span>
              <strong className="summary-row__value">{formatPercent(indicadores?.tecnicos?.taxaCrescimentoPct)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Kg vivo/ha</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.tecnicos?.kgVivoHa, 2, ' kg/ha')}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Arrobas vendidas</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.tecnicos?.arrobasVendidas, 2, ' @')}</strong>
            </div>
          </div>
        </Card>

        <Card title="Indicadores econômicos">
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row__label">Receita total</span>
              <strong className="summary-row__value">{formatCurrency(indicadores?.economicos?.receitaTotal)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Custos totais</span>
              <strong className="summary-row__value">{formatCurrency(indicadores?.economicos?.custosTotais)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Margem bruta</span>
              <strong className="summary-row__value">{formatCurrency(indicadores?.economicos?.margemBruta)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Margem por hectare</span>
              <strong className="summary-row__value">{formatCurrency(indicadores?.economicos?.margemPorHa)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Margem por cabeça</span>
              <strong className="summary-row__value">{formatCurrency(indicadores?.economicos?.margemPorCabeca)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <div className="dashboard-grid dashboard-grid--dual">
        <Card title="Pastagens e lotação">
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row__label">Área total de pastagem</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.pastagem?.areaTotalPastagem, 2, ' ha')}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Capacidade total UA</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.pastagem?.capacidadeTotalUa, 2)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">UA demandada</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.unidadeAnimal?.uaTotalFazenda, 2)}</strong>
            </div>
            <div className={`summary-row ${statusLotacaoSuperlotado ? 'summary-row--alert' : 'summary-row--success'}`}>
              <span className="summary-row__label">Saldo UA</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.pastagem?.saldoUa, 2)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Pasto a arrendar</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.pastagem?.pastoAArrendarHa, 2, ' ha')}</strong>
            </div>
          </div>
        </Card>

        <Card title="Evolução do rebanho">
          <div className="summary-list">
            <div className="summary-row">
              <span className="summary-row__label">Estoque inicial</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.estoque_inicial, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Compras</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.compras, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Nascimentos</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.nascimentos, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Vendas</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.vendas, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Mortes</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.mortes, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Transferências (entrada/saída)</span>
              <strong className="summary-row__value">
                {formatNumber(indicadores?.evolucao?.resumo?.transferencias_entrada, 0)} / {formatNumber(indicadores?.evolucao?.resumo?.transferencias_saida, 0)}
              </strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Estoque final</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.estoque_final, 0)}</strong>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Variação de inventário</span>
              <strong className="summary-row__value">{formatNumber(indicadores?.evolucao?.resumo?.variacao_inventario, 0)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Cenários simulados">
        {!cenariosResumo.length ? (
          <div className="empty-state">
            <strong>Sem dados suficientes.</strong>
            <span>Cadastre cenários para visualizar o resumo gerencial projetado.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cenário</th>
                  <th>Status</th>
                  <th>Margem projetada</th>
                  <th>Estoque final projetado</th>
                  <th>Saldo UA projetado</th>
                </tr>
              </thead>
              <tbody>
                {cenariosResumo.map((item) => {
                  const statusTexto = item.status || 'Sem dados suficientes';
                  const statusClass = String(item.status || '').toLowerCase().includes('aprov')
                    ? 'summary-badge summary-badge--success'
                    : 'summary-badge summary-badge--warning';

                  return (
                    <tr key={item.id}>
                      <td>{item.nome || 'Sem dados suficientes'}</td>
                      <td><span className={statusClass}>{statusTexto}</span></td>
                      <td>{formatCurrency(item?.projecao?.projecao?.margem_bruta_projetada)}</td>
                      <td>{formatNumber(item?.projecao?.projecao?.estoque_final_projetado, 2)}</td>
                      <td>{formatNumber(item?.projecao?.projecao?.saldo_ua_projetado, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
