import Card from '../ui/Card';
import { formatNumber } from '../../utils/calculations';

export default function LoteNutricaoTab({ lote, consumo }) {
  return (
    <Card title="Nutrição" subtitle="Planejamento e consumo de suplementação">
      <div className="metrics-2col lote-details-grid">
        <p><strong>Dieta:</strong> {lote.supl_nome || 'Não definida'}</p>
        <p><strong>Estoque:</strong> {formatNumber(lote.supl_estoque_kg, 0)} kg</p>
        <p><strong>Consumo por cabeça:</strong> {formatNumber(lote.supl_pv_pct, 2)} % PV</p>
        <p><strong>Custo por kg:</strong> R$ {formatNumber(lote.supl_rkg, 2)}</p>
        <p><strong>Consumo diário estimado:</strong> {formatNumber(consumo, 1)} kg</p>
        <p><strong>Meta de dias:</strong> {formatNumber(lote.supl_meta_dias, 0)} dias</p>
      </div>
    </Card>
  );
}
