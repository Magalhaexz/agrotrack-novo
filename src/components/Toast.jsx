const toastStyles = {
  success: { bg: 'var(--color-success-bg)', border: 'var(--color-success)' },
  error: { bg: 'var(--color-danger-bg)', border: 'var(--color-danger)' },
  warning: { bg: 'var(--color-warning-bg)', border: 'var(--color-warning)' },
  info: { bg: 'var(--color-info-bg)', border: 'var(--color-info)' },
};

export default function Toast({ toast, onClose }) {
  const style = toastStyles[toast.type] || toastStyles.info;

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: 'var(--color-text)',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 260,
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 14 }}>{toast.message}</span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        ✕
      </button>
    </div>
  );
}
