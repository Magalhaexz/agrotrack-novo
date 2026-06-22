import { Plus } from 'lucide-react';
import Button from '../ui/Button';

export default function LotesPageHeader({ onNovoLote, canEdit }) {
  return (
    <div className="rebanho-header page-header">
      <div>
        <h1>Lotes e Rebanho</h1>
        <p>Cada lote representa um grupo de animais acompanhado em conjunto — peso, custo e resultado.</p>
      </div>
      <div className="page-actions action-row">
        <Button icon={<Plus size={14} />} onClick={onNovoLote} disabled={!canEdit}>
          Novo lote
        </Button>
      </div>
    </div>
  );
}
