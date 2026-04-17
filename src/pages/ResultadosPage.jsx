import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { calcLote, formatCurrency, formatNumber } from '../utils/calculations';

function ResultCard({ label, value, tone = 'nt' }) {
  return (
    <div className="card">
      <div className="result-label">{label}</div>
      <div className={`result-value ${tone}`}>{value}</div>
    </div>
  );
}

export default function ResultadosPage({ db }) {
  const [selectedId, setSelectedId] = useState(db.lotes[0]?.id || 0);

  const indicators = useMemo(() => (selectedId ? calcLote(db, Number(selectedId)) : null), [db, selectedId]);
  const lote = db.lotes.find((item) => item.id === Number(selectedId));

  return (
    <>
      <PageHeader
        title="Resultados"
        subtitle="Indicadores zootécnicos, econômicos e projeções de venda."
        actions={
          <select value={selectedId} onChange={(e) => setSelectedId(Number(e.target.value))}>
            {db.lotes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        }
      />

      {lote && indicators ? (
        <>
          <div className="margem-bar">
            <div className="margem-title">Estrutura de Resultado — {lote.nome}</div>
            <div className="margem-track">
              <div className="margem-seg"><div className="margem-seg-lbl">Custo Operacional</div><div className="margem-seg-val rd">{formatCurrency(indicators.totalCustos)}</div></div>
              <div className="margem-seg"><div className="margem-seg-lbl">Investimento</div><div className="margem-seg-val am">{formatCurrency(lote.investimento)}</div></div>
              <div className="margem-seg"><div className="margem-seg-lbl">Margem</div><div className={`margem-seg-val ${indicators.margem >= 0 ? 'gn' : 'rd'}`}>{formatCurrency(indicators.margem)}</div></div>
            </div>
          </div>

          <div className="sec-t">Zootécnico</div>
          <div className="res-grid">
            <ResultCard label="Total de animais" value={`${formatNumber(indicators.totalAnimais, 0)} cab.`} />
            <ResultCard label="Machos" value={`${formatNumber(indicators.qtdMachos, 0)} cab.`} tone="gn" />
            <ResultCard label="Fêmeas" value={`${formatNumber(indicators.qtdFemeas, 0)} cab.`} />
            <ResultCard label="Peso atual médio" value={`${formatNumber(indicators.pesoAtualMedio)} kg`} tone="gn" />
            <ResultCard label="GMD médio" value={`${formatNumber(indicators.gmdMedio, 3)} kg/dia`} tone="gn" />
            <ResultCard label="Arrobas produzidas" value={`${formatNumber(indicators.arrobasProduzidas)} @`} tone="gn" />
          </div>

          <div className="sec-t">Venda & Receita</div>
          <div className="res-grid">
            <ResultCard label="Preço da arroba" value={formatCurrency(lote.preco_arroba)} tone="am" />
            <ResultCard label="Rendimento carcaça" value={`${formatNumber(lote.rendimento_carcaca, 0)}%`} />
            <ResultCard label="Arrobas carcaça" value={`${formatNumber(indicators.arrobasCarcaca)} @`} tone="am" />
            <ResultCard label="Receita/cabeça" value={formatCurrency(indicators.receitaPorCabeca)} tone="am" />
            <ResultCard label="Receita total" value={formatCurrency(indicators.receitaTotal)} tone="am" />
            <ResultCard label="Margem estimada" value={formatCurrency(indicators.margem)} tone={indicators.margem >= 0 ? 'gn' : 'rd'} />
          </div>
        </>
      ) : null}
    </>
  );
}
