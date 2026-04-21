<<<<<<< HEAD
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
=======
import { calcularResultadoLote } from '../domain/calculos';
import { formatarNumero } from '../utils/formatters';

// Props:
// db: objeto de banco em memória
// lote: { id, nome, qtd, status }
export default function ResultadoLoteCard({ db, lote }) {
  const resultado = calcularResultadoLote(db, lote.id);
  const situacao = obterSituacao(resultado.lucroTotal);

  return (
    <div className="fazendas-card" style={{ marginBottom: 16 }}>
      <div className="fazendas-card-header">
        <span className="fazendas-card-title">Resultado financeiro — {lote.nome}</span>
      </div>

      <div className="card-body">
        <div className="kpi-grid-3">
          <div className="kpi-card">
            <div className="kpi-label">Receita total</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.receitaTotal)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Custo total</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.custoTotal)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Lucro total</div>
            <div
              className="kpi-value"
              style={{ color: resultado.lucroTotal >= 0 ? '#8ad879' : '#ff8a8a' }}
            >
              R$ {formatarNumero(resultado.lucroTotal)}
            </div>
          </div>
        </div>

        <div className="kpi-grid-3" style={{ marginTop: 12 }}>
          <div className="kpi-card">
            <div className="kpi-label">Lucro por cabeça</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.lucroporCabeca)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Lucro por @</div>
            <div className="kpi-value">R$ {formatarNumero(resultado.lucroPorArroba)}</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Situação</div>
            <div className="kpi-value" style={{ fontSize: 24 }}>
              {situacao}
            </div>
          </div>
        </div>
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
      </div>
    </div>
  );
}

function obterSituacao(lucroTotal) {
  if (lucroTotal > 0) return 'Lucrativo';
  if (lucroTotal < 0) return 'No prejuízo';
  return 'Em andamento';
}
<<<<<<< HEAD

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
=======
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
