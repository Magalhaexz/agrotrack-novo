import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import { hojeLocalISO } from '../domain/dataCivil.js';
import { isModoConsolidado } from '../domain/escopoFazenda';
import {
  computeIndicadoresEstrategicos,
  resolveIndicadoresPeriod,
} from '../domain/indicadoresEstrategicos';

function nowDate() {
  return hojeLocalISO();
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `R$ ${number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value, digits = 2, suffix = '') {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return `${number.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
}

function formatPercent(value) {
  return formatNumber(value, 2, '%');
}

function formatOrInsufficient(value, formatter) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sem dados suficientes';
  return formatter(number);
}

function metricTone(value) {
  if (value === 'Sem dados suficientes') return '';
  if (typeof value === 'string' && (value.includes('-') || value.startsWith('R$ -'))) return ' metric-tile--warning';
  return '';
}

export default function IndicadoresPage({ db, fazendaSelecionada }) {
  const consolidado = isModoConsolidado(fazendaSelecionada);
  const [tipoPeriodo, setTipoPeriodo] = useState('mes');
  const [mesRef, setMesRef] = useState(nowDate().slice(0, 7));
  const [anoRef, setAnoRef] = useState(nowDate().slice(0, 4));
  const [customInicio, setCustomInicio] = useState(`${nowDate().slice(0, 4)}-01-01`);
  const [customFim, setCustomFim] = useState(nowDate());

  const periodo = useMemo(
    () => resolveIndicadoresPeriod({ tipoPeriodo, mesRef, anoRef, customInicio, customFim }),
    [tipoPeriodo, mesRef, anoRef, customInicio, customFim]
  );

  const indicadores = useMemo(
    () => computeIndicadoresEstrategicos(db, periodo.start, periodo.end),
    [db, periodo.start, periodo.end]
  );

  const tecnicosCards = [
    {
      label: 'Taxa de desfrute',
      value: formatOrInsufficient(indicadores.tecnicos.desfrutePct, formatPercent),
      meta: 'Mostra a participação das saídas produtivas em relação ao rebanho monitorado.',
    },
    {
      label: 'Taxa de abate',
      value: formatOrInsufficient(indicadores.tecnicos.taxaAbatePct, formatPercent),
      meta: 'Acompanha o percentual do rebanho destinado ao abate no período selecionado.',
    },
    {
      label: 'Crescimento do rebanho',
      value: formatOrInsufficient(indicadores.tecnicos.taxaCrescimentoPct, formatPercent),
      meta: 'Comparativo entre evolução do estoque e movimentações registradas.',
    },
    {
      label: 'Kg vivo/ha',
      value: formatOrInsufficient(indicadores.tecnicos.kgVivoHa, (v) => formatNumber(v, 2, ' kg/ha')),
      meta: 'Indicador de intensidade produtiva por área de pastagem.',
    },
    {
      label: 'Arrobas vendidas',
      value: formatOrInsufficient(indicadores.tecnicos.arrobasVendidas, (v) => formatNumber(v, 2, ' @')),
      meta: 'Volume total comercializado nas movimentações do período.',
    },
  ];

  const economicosCards = [
    {
      label: 'Receita total',
      value: formatCurrency(indicadores.economicos.receitaTotal),
      meta: 'Receitas consolidadas das operações registradas no período.',
    },
    {
      label: 'Custos totais',
      value: formatCurrency(indicadores.economicos.custosTotais),
      meta: 'Soma de despesas, consumo e custos lançados na operação.',
    },
    {
      label: 'Margem bruta',
      value: formatCurrency(indicadores.economicos.margemBruta),
      meta: 'Diferença entre receita operacional e custos apurados.',
    },
    {
      label: 'Margem por hectare',
      value: formatOrInsufficient(indicadores.economicos.margemPorHa, formatCurrency),
      meta: 'Leitura econômica por área produtiva no intervalo selecionado.',
    },
    {
      label: 'Margem por cabeça',
      value: formatOrInsufficient(indicadores.economicos.margemPorCabeca, formatCurrency),
      meta: 'Indicador de rentabilidade média por animal monitorado.',
    },
  ];

  const lotacaoCards = [
    {
      label: 'Capacidade total UA',
      value: formatNumber(indicadores.pastagem.capacidadeTotalUa, 2),
      meta: 'Capacidade consolidada das pastagens cadastradas.',
    },
    {
      label: 'UA demandada',
      value: formatNumber(indicadores.unidadeAnimal.uaTotalFazenda, 2),
      meta: 'Demanda do rebanho em unidades animais.',
    },
    {
      label: 'Saldo UA',
      value: formatNumber(indicadores.pastagem.saldoUa, 2),
      meta: indicadores.pastagem.statusLotacao === 'superlotado'
        ? 'Saldo negativo indica pressão acima da capacidade atual.'
        : 'Saldo positivo indica folga de capacidade nas pastagens.',
    },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Indicadores"
        subtitle={`${consolidado ? 'Todas as fazendas' : (fazendaSelecionada?.nome || 'Todas as fazendas')} · Indicadores técnicos e econômicos da operação.`}
      />

      <Card title="Filtros de período">
        <div className="form-grid two">
          <Input as="select" label="Tipo de período" value={tipoPeriodo} onChange={(e) => setTipoPeriodo(e.target.value)}>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
            <option value="custom">Período personalizado</option>
          </Input>
          {tipoPeriodo === 'mes' ? (
            <Input label="Mês de referência" type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          ) : null}
          {tipoPeriodo === 'ano' ? (
            <Input label="Ano de referência" type="number" value={anoRef} onChange={(e) => setAnoRef(e.target.value)} />
          ) : null}
          {tipoPeriodo === 'custom' ? (
            <>
              <Input label="Data inicial" type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} />
              <Input label="Data final" type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} />
            </>
          ) : null}
        </div>
      </Card>

      <Card
        title="Resumo de lotação"
        subtitle={`Status: ${indicadores.pastagem.statusLotacao === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}`}
      >
        <div className="report-kpi-grid">
          {lotacaoCards.map((card) => (
            <article
              key={card.label}
              className={`metric-tile${card.label === 'Saldo UA' && indicadores.pastagem.statusLotacao === 'superlotado' ? ' metric-tile--warning' : ''}`}
            >
              <span className="metric-tile__label">{card.label}</span>
              <strong className="metric-tile__value">{card.value}</strong>
              <span className="metric-tile__meta">{card.meta}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Indicadores técnicos" subtitle="Leitura produtiva e zootécnica consolidada no período selecionado.">
        <div className="report-kpi-grid">
          {tecnicosCards.map((card) => (
            <article key={card.label} className={`metric-tile${metricTone(card.value)}`}>
              <span className="metric-tile__label">{card.label}</span>
              <strong className="metric-tile__value">{card.value}</strong>
              <span className="metric-tile__meta">{card.meta}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Indicadores econômicos" subtitle="Hierarquia mais clara para receitas, custos e margem operacional.">
        <div className="report-kpi-grid">
          {economicosCards.map((card) => (
            <article key={card.label} className={`metric-tile${metricTone(card.value)}`}>
              <span className="metric-tile__label">{card.label}</span>
              <strong className="metric-tile__value">{card.value}</strong>
              <span className="metric-tile__meta">{card.meta}</span>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Tabela por lote">
        {!indicadores.loteResumo.length ? (
          <div className="empty-state">
            <strong>Sem dados suficientes.</strong>
            <span>Cadastre lotes e movimentações para visualizar os indicadores por lote.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>UA total</th>
                  <th>Receita</th>
                  <th>Custos</th>
                  <th>Margem</th>
                </tr>
              </thead>
              <tbody>
                {indicadores.loteResumo.map((item) => (
                  <tr key={item.lote_id}>
                    <td>{item.lote_nome}</td>
                    <td>{formatNumber(item.ua_total_lote, 2)}</td>
                    <td>{formatCurrency(item.receita_total)}</td>
                    <td>{formatCurrency(item.custos_totais)}</td>
                    <td>{formatCurrency(item.margem_bruta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
