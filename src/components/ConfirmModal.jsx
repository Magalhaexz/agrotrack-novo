import Button from './ui/Button';
import Modal from './ui/Modal';
<<<<<<< HEAD
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const ICONS_BY_TONE = {
  danger: <AlertTriangle size={16} />,
  success: <CheckCircle2 size={16} />,
  info: <Info size={16} />,
  primary: <CheckCircle2 size={16} />, // Default para primary
};
=======
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

export default function ConfirmModal({
  open,
  title,
  message,
  tone = 'danger',
  onCancel,
  onConfirm,
}) {
<<<<<<< HEAD
  const icon = ICONS_BY_TONE[tone] || ICONS_BY_TONE.info; // Fallback para info se o tone não for reconhecido
=======
  const icon = tone === 'danger' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />;
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d

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
<<<<<<< HEAD
}
=======
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
