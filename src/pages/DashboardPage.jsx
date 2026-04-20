import PageHeader from '../components/PageHeader';
import KpiCard from '../components/KpiCard';
import AlertList from '../components/AlertList';
import LoteCard from '../components/LoteCard';

import { calcLote, formatCurrency, formatNumber } from '../utils/calculations';

export default function DashboardPage({
  db,
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

  const lotesAtivosIds = new Set(
    db.lotes.filter((lote) => lote.status === 'ativo').map((lote) => lote.id)
  );
  const totalAnimais = db.animais.reduce((sum, item) => sum + item.qtd, 0);
  const totalCabecasAtivas = db.animais
    .filter((item) => lotesAtivosIds.has(item.lote_id))
    .reduce((sum, item) => sum + item.qtd, 0);
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
  const pesoMedioGeral = totalAnimais
    ? db.animais.reduce((sum, item) => sum + item.p_at * item.qtd, 0) / totalAnimais
    : 0;
  const arrobaMediaEstimada = pesoMedioGeral / 15;
  const itensEstoqueCritico = (db.estoque || []).filter((item) =>
    isEstoqueCriticoHistorico(item, db.movimentacoes_estoque || [])
  ).length;
  const proximosManejos = (db.sanitario || []).filter((item) => {
    if (!item.proxima) return false;
    const diff = daysDiff(item.proxima);
    return diff >= 0 && diff <= 7;
  }).length;
  const lotesAtivos = db.lotes.filter((lote) => lote.status === 'ativo').length;

  const principaisAlertas = alerts.slice(0, 5);
  const alertasOcultos = Math.max(alerts.length - 5, 0);

  const kpis = [
    {
      label: 'Cabeças Ativas',
      value: formatNumber(totalCabecasAtivas, 0),
      unit: 'cab.',
      hint: 'somente lotes ativos',
      tone: 'nt',
      icon: 'animals',
    },
    {
      label: 'Lotes Ativos',
      value: lotesAtivos,
      hint: `em ${db.fazendas.length} propriedades`,
      tone: 'nt',
      icon: 'lotes',
    },
    {
      label: 'Peso Médio Geral',
      value: formatNumber(pesoMedioGeral, 2),
      unit: 'kg',
      hint: 'média ponderada por cabeças',
      tone: 'gn',
      icon: 'scale',
    },
    {
      label: '@ Média Estimada',
      value: formatNumber(arrobaMediaEstimada, 2),
      unit: '@',
      hint: 'com base no peso médio geral',
      tone: 'am',
      icon: 'trend',
    },
    {
      label: 'Estoque Crítico',
      value: itensEstoqueCritico,
      hint: 'saldo < 20% do último pico',
      tone: itensEstoqueCritico > 0 ? 'rd' : 'gn',
      icon: 'package',
    },
    {
      label: 'Próximos Manejos',
      value: proximosManejos,
      hint: 'próximos 7 dias',
      tone: proximosManejos > 0 ? 'am' : 'gn',
      icon: 'shield',
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

function daysDiff(dateStr) {
  if (!dateStr) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function isEstoqueCriticoHistorico(item, movimentacoes) {
  const atual = Number(item.quantidade_atual || 0);
  const historico = movimentacoes.filter(
    (mov) => Number(mov.item_estoque_id) === Number(item.id)
  );
  const pico = Math.max(
    atual,
    ...historico.map((mov) => Number(mov.quantidade || 0))
  );
  if (!pico) return false;
  return atual < pico * 0.2;
}
