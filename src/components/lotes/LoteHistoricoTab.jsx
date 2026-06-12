import Card from '../ui/Card';
import { formatCurrency, formatDate, formatNumber } from '../../utils/calculations';

const LABELS = {
  compra: 'Entrada por compra',
  nascimento: 'Entrada por nascimento',
  transferencia_entrada: 'Entrada por transferência',
  venda: 'Saída por venda',
  morte: 'Saída por morte',
  descarte: 'Saída por descarte',
  transferencia_saida: 'Saída por transferência',
  abate: 'Saída por abate',
  consumo: 'Consumo nutricional',
};

export default function LoteHistoricoTab({ historico, onDeleteConsumo }) {
  return (
    <Card title="Histórico" subtitle="Linha do tempo consolidada do lote">
      <div className="lote-history-list">
        {historico.length ? historico.map((item) => (
          <article className="lote-history-item" key={item.key}>
            <div>
              <span className="lote-history-date">{formatDate(item.data)}</span>
            </div>
            <div className="lote-history-content">
              <strong>{item.tipo === 'pesagem' ? 'Pesagem registrada' : LABELS[item.tipo] || 'Movimentação'}</strong>
              <p>{item.tipo === 'pesagem'
                ? `Peso médio: ${formatNumber(item.peso_medio, 1)} kg`
                : item.tipo === 'consumo'
                  ? `Consumo total: ${formatNumber(item.quantidade, 1)} kg · Peso médio usado: ${formatNumber(item.peso_medio, 1)} kg`
                  : `Quantidade: ${formatNumber(item.qtd, 0)} cabeças · Peso médio: ${formatNumber(item.peso_medio, 1)} kg`}</p>
              <span>{item.observacao || item.obs || 'Sem observação'} {item.valor_total ? `· Valor: ${formatCurrency(item.valor_total)}` : ''}</span>
              {item.tipo === 'consumo' && typeof onDeleteConsumo === 'function' ? (
                <button type="button" className="ui-button ui-button--ghost ui-button--sm" onClick={() => onDeleteConsumo(item)}>
                  Excluir consumo
                </button>
              ) : null}
            </div>
          </article>
        )) : <p>Sem histórico operacional para este lote.</p>}
      </div>
    </Card>
  );
}
