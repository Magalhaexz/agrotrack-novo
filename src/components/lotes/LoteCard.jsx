import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';
import { avaliarDesempenhoGmd } from '../../domain/gmdAlerta';

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
  const gmd = avaliarDesempenhoGmd({
    gmdMeta: lote?.gmdMeta,
    gmdReal: lote?.gmd30,
    qtdPesagens: lote?.qtdPesagens,
  });
  const gmdAbaixo = gmd.status === 'abaixo';

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
          {gmdAbaixo ? <Badge variant="danger">GMD abaixo</Badge> : null}
          {gmd.status === 'ok' ? <Badge variant="success">GMD ok</Badge> : null}
        </div>
      </div>

      {gmdAbaixo ? (
        <div className="lote-card-gmd-alert" role="alert">
          <strong>Atenção: este lote está abaixo do GMD esperado.</strong>
          <span>
            Esperado {formatNumber(gmd.gmdMeta, 3)} kg/dia · Realizado {formatNumber(gmd.gmdReal, 3)} kg/dia
            {' '}({formatNumber(gmd.diferenca, 3)} kg/dia)
          </span>
          <span className="lote-card-gmd-alert__hint">
            Ganho abaixo da meta tende a atrasar o ponto de venda e elevar o custo por arroba.
          </span>
        </div>
      ) : null}

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
        <Button size="sm" variant="danger" onClick={onEncerrar} disabled={!canEdit || lote.bloqueado}>Trocar lote</Button>
      </div>
    </Card>
  );
}
