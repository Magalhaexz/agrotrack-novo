import Button from '../ui/Button';

export default function LotesPageHeader({ onNovoLote, canEdit }) {
  return (
    <div className="rebanho-header">
      <div>
        <h1>Rebanho</h1>
        <p>Gestão central de lotes, pesagens, retiradas e resultado financeiro.</p>
      </div>
      <Button onClick={onNovoLote} disabled={!canEdit}>
        Novo lote
      </Button>
    </div>
  );
}
