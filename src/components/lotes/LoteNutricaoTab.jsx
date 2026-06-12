import Card from '../ui/Card';
import { formatNumber } from '../../utils/calculations';

function getConsumoLabel(lote) {
  const tipo = String(lote?.consumo_tipo || '').toLowerCase();
  const consumo = Number(lote?.consumo_por_cabeca_dia || 0);

  if (tipo === 'kg_cab_dia') {
    return `${formatNumber(consumo, 3)} kg/cab/dia`;
  }

  const percentual = consumo > 0 ? consumo : Number(lote?.supl_pv_pct || 0);
  return `${formatNumber(percentual, 2)} % PV`;
}

export default function LoteNutricaoTab({ lote, consumo, alertaConsumo = null }) {
  return (
    <Card title="Nutrição" subtitle="Planejamento e consumo de suplementação">
      <div className="metrics-2col lote-details-grid">
        <p><strong>Dieta:</strong> {lote.supl_nome || 'Não definida'}</p>
        <p><strong>Estoque:</strong> {formatNumber(lote.supl_estoque_kg, 0)} kg</p>
        <p><strong>Consumo esperado por cabeça:</strong> {getConsumoLabel(lote)}</p>
        <p><strong>Custo por kg:</strong> R$ {formatNumber(lote.supl_rkg, 2)}</p>
        <p><strong>Consumo diário esperado:</strong> {formatNumber(consumo, 1)} kg</p>
        <p><strong>Consumo total estimado:</strong> {formatNumber(lote.consumo_total_estimado, 1)} kg</p>
        <p><strong>Custo estimado total:</strong> R$ {formatNumber(lote.custo_total_estimado, 2)}</p>
        <p><strong>Meta de dias:</strong> {formatNumber(lote.dias_estimados || lote.supl_meta_dias, 0)} dias</p>
      </div>
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          background: 'rgba(248, 250, 252, 0.95)',
          display: 'grid',
          gap: 8,
        }}
        data-tone={alertaConsumo?.tone || 'neutral'}
      >
        <strong>{alertaConsumo?.message || 'Sem histórico de consumo registrado.'}</strong>
        {alertaConsumo?.expectedDaily ? (
          <span>
            Esperado: {formatNumber(alertaConsumo.expectedDaily, 1)} kg/dia ·
            Realizado: {formatNumber(alertaConsumo.actualDaily, 1)} kg/dia
          </span>
        ) : null}
      </div>
    </Card>
  );
}
