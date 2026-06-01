import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import PageHeader from '../components/PageHeader';
import PastagensPage from './PastagensPage';
import EvolucaoRebanhoPage from './EvolucaoRebanhoPage';
import IndicadoresPage from './IndicadoresPage';
import CenariosPage from './CenariosPage';
import RelatoriosGerenciaisPage from './RelatoriosGerenciaisPage';
import { computeIndicadoresEstrategicos } from '../domain/indicadoresEstrategicos';

const TABS = [
  { id: 'visaoGeral', label: 'Visão Geral' },
  { id: 'pastagens', label: 'Pastagens e Lotação' },
  { id: 'evolucao', label: 'Evolução do Rebanho' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'cenarios', label: 'Cenários' },
  { id: 'relatorios', label: 'Relatórios' },
];

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `R$ ${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PlanejamentoPage(props) {
  const [aba, setAba] = useState('visaoGeral');
  const period = useMemo(() => {
    const year = new Date().getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, []);
  const indicadores = useMemo(
    () => computeIndicadoresEstrategicos(props.db, period.start, period.end),
    [props.db, period.start, period.end]
  );
  const hasStrategicData = Number(indicadores?.pastagem?.capacidadeTotalUa || 0) > 0
    || Number(indicadores?.unidadeAnimal?.uaTotalFazenda || 0) > 0
    || Number(indicadores?.evolucao?.resumo?.estoque_inicial || 0) > 0;

  return (
    <div className="page">
      <PageHeader title="Planejamento" subtitle="Área estratégica consolidada para análise, capacidade e projeções." />

      <div className="tab-bar planejamento-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`header-tab ${aba === tab.id ? 'active' : ''}`}
            onClick={() => setAba(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {aba === 'visaoGeral' ? (
        !hasStrategicData ? (
          <Card title="Visão Geral">
            <div className="empty-state">
              <strong>Sem dados suficientes</strong>
              <span>Preencha animais, pastagens e movimentações para gerar a visão estratégica.</span>
            </div>
          </Card>
        ) : (
          <div className="dashboard-grid dashboard-grid--kpi-main">
            <Card title="Rebanho ativo"><strong>{formatNumber(indicadores?.evolucao?.resumo?.estoque_final, 0)}</strong></Card>
            <Card title="Capacidade UA"><strong>{formatNumber(indicadores?.pastagem?.capacidadeTotalUa, 2)}</strong></Card>
            <Card title="UA demandada"><strong>{formatNumber(indicadores?.unidadeAnimal?.uaTotalFazenda, 2)}</strong></Card>
            <Card title="Saldo UA"><strong>{formatNumber(indicadores?.pastagem?.saldoUa, 2)}</strong></Card>
            <Card title="Status de lotação"><strong>{indicadores?.pastagem?.statusLotacao === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}</strong></Card>
            <Card title="Margem bruta"><strong>{formatCurrency(indicadores?.economicos?.margemBruta)}</strong></Card>
            <Card title="Melhor cenário"><strong>{Array.isArray(props.db?.cenarios) && props.db.cenarios.length ? 'Disponível em Cenários' : 'Sem dados suficientes'}</strong></Card>
            <Card title="Alertas importantes"><strong>{indicadores?.pastagem?.statusLotacao === 'superlotado' ? 'Atenção: superlotação' : 'Sem alertas críticos'}</strong></Card>
          </div>
        )
      ) : null}

      {aba === 'pastagens' ? <PastagensPage {...props} /> : null}
      {aba === 'evolucao' ? <EvolucaoRebanhoPage {...props} /> : null}
      {aba === 'indicadores' ? <IndicadoresPage {...props} /> : null}
      {aba === 'cenarios' ? <CenariosPage {...props} /> : null}
      {aba === 'relatorios' ? <RelatoriosGerenciaisPage {...props} /> : null}
    </div>
  );
}
