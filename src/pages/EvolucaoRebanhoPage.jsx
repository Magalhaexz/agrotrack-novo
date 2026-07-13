import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PageHeader from '../components/PageHeader';
import { computeEvolucaoRebanho } from '../domain/evolucaoRebanho';

import { hojeLocalISO } from '../domain/dataCivil.js';
function toDateKey(value) {
  return String(value || '').slice(0, 10);
}

function nowDate() {
  return hojeLocalISO();
}

function monthBounds(yyyyMm) {
  const [year, month] = String(yyyyMm || '').split('-').map(Number);
  const start = new Date(year, (month || 1) - 1, 1);
  const end = new Date(year, (month || 1), 0);
  return {
    start: toDateKey(start.toISOString()),
    end: toDateKey(end.toISOString()),
  };
}

function yearBounds(year) {
  const y = Number(year);
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function formatInt(value) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return safe.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function labelTipo(tipo) {
  const map = {
    compra: 'Compra',
    venda: 'Venda',
    morte: 'Morte',
    nascimento: 'Nascimento',
    transferencia_entrada: 'Transferência entrada',
    transferencia_saida: 'Transferência saída',
    descarte: 'Descarte',
    abate: 'Abate',
    perda: 'Perda',
    outro: 'Outro',
  };
  return map[tipo] || tipo || '-';
}

export default function EvolucaoRebanhoPage({ db }) {
  const [modoPeriodo, setModoPeriodo] = useState('mes');
  const [mesRef, setMesRef] = useState(nowDate().slice(0, 7));
  const [anoRef, setAnoRef] = useState(nowDate().slice(0, 4));
  const [customInicio, setCustomInicio] = useState(`${nowDate().slice(0, 4)}-01-01`);
  const [customFim, setCustomFim] = useState(nowDate());

  const periodo = useMemo(() => {
    if (modoPeriodo === 'ano') return yearBounds(anoRef);
    if (modoPeriodo === 'custom') {
      const start = toDateKey(customInicio);
      const end = toDateKey(customFim);
      return start <= end ? { start, end } : { start: end, end: start };
    }
    return monthBounds(mesRef);
  }, [modoPeriodo, mesRef, anoRef, customInicio, customFim]);

  const { resumo, movimentosPeriodo } = useMemo(
    () => computeEvolucaoRebanho(db, periodo.start, periodo.end),
    [db, periodo.start, periodo.end]
  );

  return (
    <div className="page">
      <PageHeader
        title="Evolução do Rebanho"
        subtitle="Acompanhe a variação do estoque animal por período."
      />

      <Card title="Filtro de período">
        <div className="form-grid two">
          <Input as="select" label="Tipo de período" value={modoPeriodo} onChange={(e) => setModoPeriodo(e.target.value)}>
            <option value="mes">Mês</option>
            <option value="ano">Ano</option>
            <option value="custom">Período personalizado</option>
          </Input>
          {modoPeriodo === 'mes' ? (
            <Input label="Mês de referência" type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
          ) : null}
          {modoPeriodo === 'ano' ? (
            <Input label="Ano de referência" type="number" value={anoRef} onChange={(e) => setAnoRef(e.target.value)} />
          ) : null}
          {modoPeriodo === 'custom' ? (
            <>
              <Input label="Data inicial" type="date" value={customInicio} onChange={(e) => setCustomInicio(e.target.value)} />
              <Input label="Data final" type="date" value={customFim} onChange={(e) => setCustomFim(e.target.value)} />
            </>
          ) : null}
        </div>
        <p style={{ marginTop: 10 }}>
          Período selecionado: <strong>{periodo.start}</strong> até <strong>{periodo.end}</strong>
        </p>
      </Card>

      <div className="dashboard-grid dashboard-grid--kpi-main">
        <Card title="Estoque inicial"><strong>{formatInt(resumo.estoque_inicial)}</strong></Card>
        <Card title="Compras"><strong>{formatInt(resumo.compras)}</strong></Card>
        <Card title="Nascimentos"><strong>{formatInt(resumo.nascimentos)}</strong></Card>
        <Card title="Transferências de entrada"><strong>{formatInt(resumo.transferencias_entrada)}</strong></Card>
        <Card title="Vendas"><strong>{formatInt(resumo.vendas)}</strong></Card>
        <Card title="Mortes"><strong>{formatInt(resumo.mortes)}</strong></Card>
        <Card title="Transferências de saída"><strong>{formatInt(resumo.transferencias_saida)}</strong></Card>
        <Card title="Estoque final"><strong>{formatInt(resumo.estoque_final)}</strong></Card>
        <Card title="Variação de inventário"><strong>{formatInt(resumo.variacao_inventario)}</strong></Card>
      </div>

      <Card title="Movimentações do período">
        {!movimentosPeriodo.length ? (
          <div className="empty-state">
            <strong>Sem movimentações no período.</strong>
            <span>Os totais foram calculados com base no estoque atual e nos movimentos registrados.</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Lote</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movimentosPeriodo.map((item) => (
                  <tr key={item.id}>
                    <td>{item.data}</td>
                    <td>{labelTipo(item.tipo)}</td>
                    <td>{formatInt(item.qtd)}</td>
                    <td>{item.lote_id ?? '-'}</td>
                    <td>{item.obs || '-'}</td>
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

