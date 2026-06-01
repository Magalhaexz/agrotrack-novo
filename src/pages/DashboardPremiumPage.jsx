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

export default function DashboardPremiumPage({ db }) {
  const period = useMemo(() => nowPeriod(), []);
  const indicadores = useMemo(
    () => computeIndicadoresEstrategicos(db, period.start, period.end),
    [db, period.start, period.end]
  );

  const cenarios = useMemo(() => (Array.isArray(db?.cenarios) ? db.cenarios : []), [db]);
  const melhorCenario = useMemo(() => {
    if (!cenarios.length) return null;
    const candidatos = cenarios.filter((item) => String(item?.status || 'rascunho') !== 'arquivado');
    if (!candidatos.length) return null;

    const ranked = candidatos
      .map((cenario) => ({
        cenario,
        projecao: calcularProjecaoCenario(
          db,
          String(cenario?.periodo_inicio || period.start),
          String(cenario?.periodo_fim || period.end),
          cenario
        ),
      }))
      .sort(
        (a, b) =>
          Number(b?.projecao?.projecao?.margem_bruta_projetada || Number.NEGATIVE_INFINITY)
          - Number(a?.projecao?.projecao?.margem_bruta_projetada || Number.NEGATIVE_INFINITY)
      );
    return ranked[0] || null;
  }, [cenarios, db, period.start, period.end]);

  const rebanhoAtivo = Number(indicadores?.evolucao?.resumo?.estoque_final || 0);
  const statusLotacao = indicadores?.pastagem?.statusLotacao === 'superlotado'
    ? 'Superlotado'
    : 'Dentro da capacidade';
  const alertaSuperlotacao = indicadores?.pastagem?.statusLotacao === 'superlotado'
    ? 'Atenção: operação acima da capacidade de suporte.'
    : 'Sem alerta de superlotação no período.';

  const cards = [
    { label: 'Rebanho ativo', value: formatNumber(rebanhoAtivo, 0) },
    { label: 'Capacidade total UA', value: formatNumber(indicadores?.pastagem?.capacidadeTotalUa, 2) },
    { label: 'UA demandada', value: formatNumber(indicadores?.unidadeAnimal?.uaTotalFazenda, 2) },
    { label: 'Saldo UA', value: formatNumber(indicadores?.pastagem?.saldoUa, 2) },
    { label: 'Status de lotação', value: statusLotacao },
    { label: 'Margem bruta', value: formatCurrency(indicadores?.economicos?.margemBruta) },
    { label: 'Receita total', value: formatCurrency(indicadores?.economicos?.receitaTotal) },
    { label: 'Custos totais', value: formatCurrency(indicadores?.economicos?.custosTotais) },
    { label: 'Taxa de desfrute', value: formatPercent(indicadores?.tecnicos?.desfrutePct) },
    { label: 'Taxa de abate', value: formatPercent(indicadores?.tecnicos?.taxaAbatePct) },
    { label: 'Crescimento do rebanho', value: formatPercent(indicadores?.tecnicos?.taxaCrescimentoPct) },
  ];

  return (
    <div className="page dashboard-page">
      <PageHeader
        title="Dashboard Premium"
        subtitle="Visão executiva estratégica consolidada da fazenda."
      />

      <div className="dashboard-grid dashboard-grid--kpi-main">
        {cards.map((card) => (
          <Card key={card.label} title={card.label} className="kpi-panel kpi-panel--compact">
            <strong>{card.value}</strong>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid--dual">
        <Card title="Melhor cenário projetado" subtitle="Comparativo com maior margem bruta projetada">
          {!melhorCenario ? (
            <p>Sem dados suficientes</p>
          ) : (
            <div className="metrics-2col">
              <p>Nome: <strong>{melhorCenario.cenario.nome || 'Sem dados suficientes'}</strong></p>
              <p>Status: <strong>{melhorCenario.cenario.status || 'Sem dados suficientes'}</strong></p>
              <p>Margem projetada: <strong>{formatCurrency(melhorCenario.projecao?.projecao?.margem_bruta_projetada)}</strong></p>
              <p>Estoque final projetado: <strong>{formatNumber(melhorCenario.projecao?.projecao?.estoque_final_projetado, 2)}</strong></p>
              <p>Saldo UA projetado: <strong>{formatNumber(melhorCenario.projecao?.projecao?.saldo_ua_projetado, 2)}</strong></p>
              <p>Status capacidade: <strong>{String(melhorCenario?.projecao?.projecao?.status_capacidade || 'sem_dados') === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}</strong></p>
            </div>
          )}
        </Card>

        <Card title="Alerta de superlotação" subtitle="Monitoramento de risco de capacidade">
          <p>{alertaSuperlotacao}</p>
          <p>
            Pasto a arrendar (ha):{' '}
            <strong>{formatNumber(indicadores?.pastagem?.pastoAArrendarHa, 2)}</strong>
          </p>
        </Card>
      </div>
    </div>
  );
}
