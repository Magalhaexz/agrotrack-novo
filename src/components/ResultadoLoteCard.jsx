import React from 'react';
import { calcularResultadoLote } from '../domain/calculos';
import { formatarNumero } from '../utils/formatters';

// Componente auxiliar para um KPI individual
function KpiItem({ label, value, valueColor, valueSize }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: valueColor, fontSize: valueSize }}>
        {value}
      </div>
    </div>
  );
}

function obterSituacao(lucroTotal) {
  if (lucroTotal > 0) return 'Lucrativo';
  if (lucroTotal < 0) return 'No prejuízo';
  return 'Em andamento';
}

export default function ResultadoLoteCard({ db, lote }) {
  const resultado = calcularResultadoLote(db, lote.id);
  const situacao = obterSituacao(resultado.lucroTotal);

  const lucroTotalColor = resultado.lucroTotal >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const lucroTotalFormatted = `R$ ${formatarNumero(resultado.lucroTotal)}`;
  const receitaTotalFormatted = `R$ ${formatarNumero(resultado.receitaTotal)}`;
  const custoTotalFormatted = `R$ ${formatarNumero(resultado.custoTotal)}`;
  const lucroPorCabecaFormatted = `R$ ${formatarNumero(resultado.lucroporCabeca)}`;
  const lucroPorArrobaFormatted = `R$ ${formatarNumero(resultado.lucroPorArroba)}`;

  return (
    <div className="ui-card" style={{ marginBottom: 16 }}> {/* Usando ui-card para consistência */}
      <div className="card-header"> {/* Reutilizando card-header */}
        <span className="card-title">Resultado financeiro — {lote.nome}</span>
      </div>

      <div className="card-body">
        <div className="kpi-grid-3">
          <KpiItem label="Receita total" value={receitaTotalFormatted} />
          <KpiItem label="Custo total" value={custoTotalFormatted} />
          <KpiItem label="Lucro total" value={lucroTotalFormatted} valueColor={lucroTotalColor} />
        </div>

        <div className="kpi-grid-3" style={{ marginTop: 12 }}>
          <KpiItem label="Lucro por cabeça" value={lucroPorCabecaFormatted} />
          <KpiItem label="Lucro por @" value={lucroPorArrobaFormatted} />
          <KpiItem label="Situação" value={situacao} valueSize="24px" />
        </div>
      </div>
    </div>
  );
}