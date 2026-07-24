import { Plus } from 'lucide-react';
import Button from '../ui/Button';

// Sprint Visual 5: cabeçalho ganha contexto (fazenda ativa / todas as
// fazendas + total de lotes) e o botão vira "Cadastrar lote" — mesmo
// onNovoLote de sempre, só rótulo e disponibilidade visual.
export default function LotesPageHeader({ onNovoLote, canEdit, consolidado, fazendaAtiva, totalLotes = 0, podeCadastrar = true }) {
  const contexto = consolidado ? 'Todas as fazendas' : (fazendaAtiva?.nome || 'Nenhuma fazenda selecionada');
  return (
    <div className="rebanho-header page-header">
      <div>
        <h1>Lotes</h1>
        <p className="lotes-header-context">
          {contexto}
          <span className="lotes-header-context-dot" aria-hidden="true">·</span>
          {totalLotes} {totalLotes === 1 ? 'lote' : 'lotes'}
        </p>
      </div>
      <div className="page-actions action-row">
        <Button
          icon={<Plus size={14} />}
          onClick={onNovoLote}
          disabled={!canEdit || !podeCadastrar}
          title={!podeCadastrar ? 'Selecione uma fazenda ativa para cadastrar um lote.' : undefined}
        >
          Cadastrar lote
        </Button>
      </div>
    </div>
  );
}
