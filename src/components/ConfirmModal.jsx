import Button from './ui/Button';
import Modal from './ui/Modal';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const ICONS_BY_TONE = {
  danger: <AlertTriangle size={16} />,
  success: <CheckCircle2 size={16} />,
  info: <Info size={16} />,
  primary: <CheckCircle2 size={16} />, // Default para primary
};

export default function ConfirmModal({
  open,
  title,
  message,
  tone = 'danger',
  onCancel,
  onConfirm,
}) {
  const icon = ICONS_BY_TONE[tone] || ICONS_BY_TONE.info; // Fallback para info se o tone não for reconhecido

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