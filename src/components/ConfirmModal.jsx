import Button from './ui/Button';
import Modal from './ui/Modal';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  message,
  tone = 'danger',
  onCancel,
  onConfirm,
}) {
  const icon = tone === 'danger' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title || 'Confirmar ação'}
      subtitle={message}
      size="sm"
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} icon={icon} onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      )}
    />
  );
}
