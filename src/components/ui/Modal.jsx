import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
}) {
  const [touchStartY, setTouchStartY] = useState(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const prevOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className={`ui-modal ui-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Janela modal'}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => setTouchStartY(event.changedTouches[0]?.clientY || null)}
        onTouchEnd={(event) => {
          const endY = event.changedTouches[0]?.clientY || 0;
          if (touchStartY && endY - touchStartY > 80) {
            onClose?.();
          }
          setTouchStartY(null);
        }}
      >
        <div className="ui-modal-drag-handle" />
        <div className="ui-modal-head">
          <div>
            {title ? <h3 className="ui-card-title">{title}</h3> : null}
            {subtitle ? <p className="ui-card-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className={`ui-modal-body ${footer ? 'has-footer' : ''}`}>{children}</div>
        {footer ? <div className="ui-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
