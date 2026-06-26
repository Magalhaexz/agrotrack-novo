import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

function statusVariant(status) {
  if (status === 'ativo') return 'success';
  if (status === 'vendido') return 'info';
  if (status === 'encerrado') return 'warning';
  return 'neutral';
}

export default function LoteCard({
  lote,
  onOpen,
  onEdit,
  onRegistrarVendaParcial,
  onRegistrarMorte,
  onRegistrarSaida,
  onEncerrar,
  canMove = true,
  canEdit = true,
}) {
  const risco = lote?.gmd30 < 0.3 || lote?.heads <= 0;

  return (
    <Card className="lote-card-modern section-card">
      <div className="lote-card-title">
        <div>
          <h3>{lote.nome}</h3>
          <p className="lote-card-subtitle">{lote.fazendaNome || 'Fazenda não vinculada'}</p>
          <p className="lote-card-meta">
            {lote.pastagemNome || '—'}
            {' '}
            • {lote.categoriaAnimal || '—'}
            {' '}
            • {lote.raca || '—'}
          </p>
        </div>
        <div className="action-row lote-card-statuses">
          <Badge variant={statusVariant(lote.status)}>{lote.status}</Badge>
          <Badge variant={risco ? 'warning' : 'success'}>{risco ? 'Atenção' : 'OK'}</Badge>
        </div>
      </div>

      <div className="lote-metrics lote-metrics-grid">
        <p><strong>{formatNumber(lote.heads, 0)}</strong><span>Cabeças</span></p>
        <p><strong>{formatNumber(lote.pesoAtual, 1)} kg</strong><span>Peso médio</span></p>
        <p><strong>{formatNumber(lote.gmd30, 3)} kg/dia</strong><span>GMD (30d)</span></p>
        <p><strong>{formatCurrency(lote.resumo?.lucroTotal || 0)}</strong><span>Resultado</span></p>
      </div>

      <p className="lote-card-last">Última pesagem: {lote.ultimaPesagem ? formatDate(lote.ultimaPesagem) : 'sem registro'}</p>

      <div className="progress-line">
        <span style={{ width: `${Math.max(5, Math.min(100, lote.progressoPeso || 0))}%` }} />
      </div>

      <div className="lote-actions action-row">
        <Button size="sm" variant="outline" onClick={onOpen}>Ver detalhes</Button>
        <Button size="sm" variant="ghost" onClick={onEdit} disabled={!canEdit || lote.bloqueado}>Editar</Button>
        <Button size="sm" variant="warning" onClick={onRegistrarVendaParcial} disabled={!canMove || lote.bloqueado}>Venda parcial</Button>
        <Button size="sm" variant="warning" onClick={onRegistrarMorte} disabled={!canMove || lote.bloqueado}>Morte/perda</Button>
        <Button size="sm" variant="warning" onClick={onRegistrarSaida} disabled={!canMove || lote.bloqueado}>Saída do lote</Button>
        <Button size="sm" variant="danger" onClick={onEncerrar} disabled={!canEdit || lote.bloqueado}>Encerrar lote</Button>
      </div>
    </Card>
  );
}
