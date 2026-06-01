import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import {
  computeIndicadoresEstrategicos,
  resolveIndicadoresPeriod,
} from '../domain/indicadoresEstrategicos';

function nowDate() {
  return new Date().toISOString().slice(0, 10);
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

export default function IndicadoresPage({ db }) {
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
    { label: 'Taxa de desfrute', value: formatOrInsufficient(indicadores.tecnicos.desfrutePct, formatPercent) },
    { label: 'Taxa de abate', value: formatOrInsufficient(indicadores.tecnicos.taxaAbatePct, formatPercent) },
    { label: 'Crescimento do rebanho', value: formatOrInsufficient(indicadores.tecnicos.taxaCrescimentoPct, formatPercent) },
    { label: 'Kg vivo/ha', value: formatOrInsufficient(indicadores.tecnicos.kgVivoHa, (v) => formatNumber(v, 2, ' kg/ha')) },
    {
      label: 'Arrobas vendidas',
      value: formatOrInsufficient(indicadores.tecnicos.arrobasVendidas, (v) => formatNumber(v, 2, ' @')),
    },
  ];

  const economicosCards = [
    { label: 'Receita total', value: formatCurrency(indicadores.economicos.receitaTotal) },
    { label: 'Custos totais', value: formatCurrency(indicadores.economicos.custosTotais) },
    { label: 'Margem bruta', value: formatCurrency(indicadores.economicos.margemBruta) },
    { label: 'Margem por hectare', value: formatOrInsufficient(indicadores.economicos.margemPorHa, formatCurrency) },
    { label: 'Margem por cabeça', value: formatOrInsufficient(indicadores.economicos.margemPorCabeca, formatCurrency) },
  ];

  const lotacaoCards = [
    { label: 'Capacidade total UA', value: formatNumber(indicadores.pastagem.capacidadeTotalUa, 2) },
    { label: 'UA demandada', value: formatNumber(indicadores.unidadeAnimal.uaTotalFazenda, 2) },
    { label: 'Saldo UA', value: formatNumber(indicadores.pastagem.saldoUa, 2) },
  ];

  return (
    <div className="page">
      <PageHeader title="Indicadores" subtitle="Indicadores técnicos e econômicos da operação." />

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

      <Card title="Resumo de lotação" subtitle={`Status: ${indicadores.pastagem.statusLotacao === 'superlotado' ? 'Superlotado' : 'Dentro da capacidade'}`}>
        <div className="dashboard-grid dashboard-grid--kpi-main">
          {lotacaoCards.map((card) => (
            <Card key={card.label} title={card.label}>
              <strong>{card.value}</strong>
            </Card>
          ))}
        </div>
      </Card>

      <Card title="Indicadores técnicos">
        <div className="dashboard-grid dashboard-grid--kpi-main">
          {tecnicosCards.map((card) => (
            <Card key={card.label} title={card.label}>
              <strong>{card.value}</strong>
            </Card>
          ))}
        </div>
      </Card>

      <Card title="Indicadores econômicos">
        <div className="dashboard-grid dashboard-grid--kpi-main">
          {economicosCards.map((card) => (
            <Card key={card.label} title={card.label}>
              <strong>{card.value}</strong>
            </Card>
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

