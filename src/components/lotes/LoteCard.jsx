import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

function statusVariant(status) {
  if (status === 'ativo') return 'success';
  if (status === 'vendido') return 'info';
  return 'neutral';
}

export default function LoteCard({ lote, onOpen }) {
  return (
    <Card className="lote-card-modern">
      <div className="lote-card-title">
        <h3>{lote.nome}</h3>
        <Badge variant={statusVariant(lote.status)}>{lote.status}</Badge>
      </div>

      <div className="lote-metrics">
        <p><strong>{formatNumber(lote.heads, 0)}</strong> cabeças</p>
        <p>{formatNumber(lote.pesoAtual, 1)} kg por cabeça</p>
        <p>Última pesagem: {lote.ultimaPesagem ? formatDate(lote.ultimaPesagem) : 'sem registro'}</p>
        <p>GMD (30 dias): {formatNumber(lote.gmd30, 3)} kg/dia</p>
        <p>Resultado: {formatCurrency(lote.resumo?.lucroTotal || 0)}</p>
      </div>

      <div className="progress-line">
        <span style={{ width: `${Math.max(5, Math.min(100, lote.progressoPeso || 0))}%` }} />
      </div>

      <div className="lote-actions">
        <Button size="sm" variant="outline" onClick={onOpen}>Abrir lote</Button>
      </div>
    </Card>
  );
}
