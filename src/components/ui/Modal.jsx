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
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-modal-overlay" onClick={onClose}>
      <div
        className={`ui-modal ui-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setTouchStartY(e.changedTouches[0]?.clientY || null)}
        onTouchEnd={(e) => {
          const endY = e.changedTouches[0]?.clientY || 0;
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
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
        {footer ? <div className="ui-modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
