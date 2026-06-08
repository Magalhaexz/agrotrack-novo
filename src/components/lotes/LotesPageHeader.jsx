import { Plus } from 'lucide-react';
import Button from '../ui/Button';

export default function LotesPageHeader({ onNovoLote, canEdit }) {
  return (
    <div className="rebanho-header page-header">
      <div>
        <h1>Lotes / Rebanho</h1>
        <p>Acompanhe lotes, desempenho, retiradas e status operacional em um só painel.</p>
      </div>
      <div className="page-actions action-row">
        <Button icon={<Plus size={14} />} onClick={onNovoLote} disabled={!canEdit}>
          Novo lote
        </Button>
      </div>
    </div>
  );
}
