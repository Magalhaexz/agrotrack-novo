export default function ConfirmModal({
  open,
  title,
  message,
  tone = 'danger',
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const confirmBtnStyle =
    tone === 'danger'
      ? { background: '#b33434', color: '#fff' }
      : { background: '#2f5ec8', color: '#fff' };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        zIndex: 1200,
      }}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 480, borderRadius: 14, overflow: 'hidden' }}
      >
        <div className="card-header">
          <span className="card-title">{title || 'Confirmar ação'}</span>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, color: '#cce0a8' }}>{message}</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #425150',
                background: '#2b3332',
                color: '#d9e4df',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                ...confirmBtnStyle,
              }}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
