export default function AlertList({
  alerts = [],
  onNavigate = null,
  onResolveAlert = null,
}) {
  if (!alerts.length) {
    return (
      <div className="empty-box">
        <strong>Nenhum alerta no momento.</strong>
        <span>O sistema não encontrou pendências críticas agora.</span>
      </div>
    );
  }

  function abrirPagina(alert) {
    if (typeof onNavigate === 'function' && alert?.pagina) {
      onNavigate(alert.pagina);
    }
  }

  function marcarComoFeito(event, alert) {
    event.stopPropagation();

    if (typeof onResolveAlert === 'function') {
      onResolveAlert(alert);
    }
  }

  return (
    <div className="alerts-list">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`alert-item ${
            alert.nivel === 'warning'
              ? 'warn'
              : alert.nivel === 'info'
              ? 'info'
              : ''
          }`}
          onClick={() => abrirPagina(alert)}
          role={onNavigate ? 'button' : undefined}
          tabIndex={onNavigate ? 0 : undefined}
          style={onNavigate ? { cursor: 'pointer' } : undefined}
          title={onNavigate ? 'Clique para abrir a página relacionada' : undefined}
        >
          <div
            className={`alert-icon ${
              alert.nivel === 'warning'
                ? 'warn'
                : alert.nivel === 'info'
                ? 'info'
                : 'cr'
            }`}
          >
            {alert.nivel === 'critical'
              ? '!'
              : alert.nivel === 'warning'
              ? '•'
              : 'i'}
          </div>

          <div className="alert-txt" style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              <strong>{alert.titulo}</strong>

              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {alert.tipoLabel || 'Geral'}
              </span>
            </div>

            <span>{alert.mensagem}</span>
          </div>

          {onResolveAlert ? (
            <button
              type="button"
              onClick={(event) => marcarComoFeito(event, alert)}
              className="action-btn"
              style={{ marginLeft: 12, whiteSpace: 'nowrap' }}
            >
              Feito
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}