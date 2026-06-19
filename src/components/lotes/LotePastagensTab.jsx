import Button from '../ui/Button';
import Card from '../ui/Card';
import { formatDate, formatNumber } from '../../utils/calculations';
import { formatHistoricoMensagem } from '../../services/movimentacaoPastos';

export default function LotePastagensTab({ lote, historico = [], loadingHistorico, canMove, onMoverPasto }) {
  return (
    <>
      <Card title="Pasto atual" subtitle="Pasto vinculado a este lote no momento">
        <div className="summary-panel">
          <div className="summary-row">
            <span className="summary-row__label">Pasto atual</span>
            <strong className="summary-row__value">{lote?.pastagemNome || 'Sem pasto vinculado'}</strong>
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 12 }}>
          <Button onClick={onMoverPasto} disabled={!canMove}>Mover lote de pasto</Button>
        </div>
      </Card>

      <Card title="Movimentações de Pasto" subtitle="Histórico de movimentações deste lote entre pastos">
        {loadingHistorico ? (
          <p>Carregando histórico…</p>
        ) : !historico.length ? (
          <div className="empty-state">
            <strong>Nenhuma movimentação de pasto registrada para este lote.</strong>
          </div>
        ) : (
          <div className="lote-history-list">
            {historico.map((item) => (
              <article className="lote-history-item" key={item.id}>
                <div>
                  <span className="lote-history-date">{formatDate(item.data_movimentacao)}</span>
                </div>
                <div className="lote-history-content">
                  <strong>Movimentação de pasto</strong>
                  <p>{formatHistoricoMensagem(item, { loteNome: lote?.nome })}</p>
                  <span>
                    {item.quantidade_cabecas ? `Quantidade: ${formatNumber(item.quantidade_cabecas, 0)} cabeças · ` : ''}
                    {item.motivo || 'Sem motivo informado'}
                    {item.observacoes ? ` · ${item.observacoes}` : ''}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
