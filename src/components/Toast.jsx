import { X } from 'lucide-react';

const toastStylesMap = {
  success: {
    accent: 'var(--color-success)',
    background: 'color-mix(in srgb, var(--color-success-bg) 72%, rgba(8, 12, 10, 0.92))',
  },
  error: {
    accent: 'var(--color-danger)',
    background: 'color-mix(in srgb, var(--color-danger-bg) 72%, rgba(12, 8, 8, 0.92))',
  },
  warning: {
    accent: 'var(--color-warning)',
    background: 'color-mix(in srgb, var(--color-warning-bg) 72%, rgba(12, 10, 6, 0.92))',
  },
  info: {
    accent: 'var(--color-info)',
    background: 'color-mix(in srgb, var(--color-info-bg) 72%, rgba(7, 10, 14, 0.92))',
  },
};

export default function Toast({ toast, onClose }) {
  const variant = toast?.type || 'info';
  const style = toastStylesMap[variant] || toastStylesMap.info;

  return (
    <div
      className={`ui-toast ui-toast-${variant}`}
      role="status"
      aria-live="polite"
      style={{
        background: style.background,
        borderColor: style.accent,
        boxShadow: `0 20px 40px color-mix(in srgb, ${style.accent} 14%, transparent)`,
      }}
    >
      <span className="ui-toast-accent" style={{ background: style.accent }} aria-hidden="true" />
      <span className="ui-toast-message">{toast?.message}</span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="ui-toast-close-btn"
        aria-label="Fechar notificacao"
      >
        <X size={14} />
      </button>
    </div>
  );
}
