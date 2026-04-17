import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import AlertList from '../components/AlertList';
import LoteCard from '../components/LoteCard';

import { calcLote, formatCurrency, formatNumber } from '../utils/calculations';

export default function DashboardPage({
  db,
  setDb,
  alerts = [],
  onNavigate = null,
  onResolveAlert = null,
}) {
  const lotes = db.lotes.map((lote) => ({
    lote,
    fazendaNome:
      db.fazendas.find((fazenda) => fazenda.id === lote.faz_id)?.nome || '—',
    indicators: calcLote(db, lote.id),
  }));

  const totalAnimais = db.animais.reduce((sum, item) => sum + item.qtd, 0);
  const totalCustos = db.custos.reduce((sum, item) => sum + item.val, 0);
  const totalReceita = lotes.reduce(
    (sum, item) => sum + item.indicators.receitaTotal,
    0
  );
  const totalMargem = lotes.reduce(
    (sum, item) => sum + item.indicators.margem,
    0
  );
  const totalArrobas = lotes.reduce(
    (sum, item) => sum + item.indicators.arrobasProduzidas,
    0
  );
  const totalInvestimento = db.lotes.reduce(
    (sum, item) => sum + item.investimento,
    0
  );

  const gmdMedio = lotes.length
    ? lotes.reduce((sum, item) => sum + item.indicators.gmdMedio, 0) /
      lotes.length
    : 0;

  const principaisAlertas = alerts.slice(0, 5);
  const alertasOcultos = Math.max(alerts.length - 5, 0);

  const kpis = [
    {
      label: 'Total de Animais',
      value: formatNumber(totalAnimais, 0),
      unit: 'cab.',
      hint: 'em todos os lotes ativos',
      tone: 'nt',
      icon: 'animals',
    },
    {
      label: 'Custo Operacional',
      value: formatCurrency(totalCustos),
      hint: 'alimentação + sanitário + outros',
      tone: 'br',
      icon: 'money',
    },
    {
      label: 'Receita Projetada',
      value: formatCurrency(totalReceita),
      hint: 'baseado no peso atual e rendimento',
      tone: 'am',
      icon: 'trend',
    },
    {
      label: 'Margem Estimada',
      value: formatCurrency(totalMargem),
      hint: totalMargem >= 0 ? 'resultado positivo' : 'atenção: prejuízo',
      tone: totalMargem >= 0 ? 'gn' : 'rd',
      icon: 'results',
    },
    {
      label: 'GMD Médio',
      value: formatNumber(gmdMedio, 3),
      unit: 'kg/dia',
      hint: 'ganho médio diário geral',
      tone: 'gn',
      icon: 'activity',
    },
    {
      label: 'Arrobas Produzidas',
      value: formatNumber(totalArrobas),
      unit: '@',
      hint: 'ganho de peso total',
      tone: 'gn',
      icon: 'trend',
    },
    {
      label: 'Investimento Total',
      value: formatCurrency(totalInvestimento),
      hint: 'capital alocado nos lotes',
      tone: 'br',
      icon: 'money',
    },
    {
      label: 'Lotes Ativos',
      value: db.lotes.length,
      hint: `em ${db.fazendas.length} propriedades`,
      tone: 'nt',
      icon: 'lotes',
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da operação pecuária."
      />

      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="sec-t">Alertas Inteligentes</div>

      <div className="alerts-panel">
        <div className="alerts-panel-header">
          <div className="alerts-panel-title">
            <strong>{alerts.length} alerta(s)</strong>
            <span>priorizados por criticidade</span>
          </div>

          {alertasOcultos > 0 ? (
            <span className="badge badge-a">+ {alertasOcultos} não exibido(s)</span>
          ) : (
            <span className="badge badge-g">Tudo visível</span>
          )}
        </div>

        <div className="alerts-scroll">
          <AlertList
            alerts={principaisAlertas}
            onNavigate={onNavigate}
            onResolveAlert={onResolveAlert}
          />
        </div>
      </div>

      <div className="sec-t">Resumo por Lote</div>
      <div className="lote-stack">
        {lotes.map(({ lote, fazendaNome, indicators }) => (
          <LoteCard
            key={lote.id}
            lote={lote}
            fazendaNome={fazendaNome}
            indicators={indicators}
          />
        ))}
      </div>
    </>
  );
}