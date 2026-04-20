const toastStyles = {
  success: { bg: '#1f4f28', border: '#73d17c' },
  error: { bg: '#4f1f1f', border: '#ff8a8a' },
  warning: { bg: '#5a4a1c', border: '#f5cf6d' },
  info: { bg: '#1f334f', border: '#77b7ff' },
};

export default function Toast({ toast, onClose }) {
  const style = toastStyles[toast.type] || toastStyles.info;

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: '#f3ffe8',
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 260,
        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
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
          color: '#efffe0',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        ✕
      </button>
    </div>
  );
}
