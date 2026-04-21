const CONFIG_NIVEL = {
  critical: { classeItem: '',     classeIcone: 'cr',   icone: '!' },
  warning:  { classeItem: 'warn', classeIcone: 'warn', icone: '•' },
  info:     { classeItem: 'info', classeIcone: 'info', icone: 'i' },
};

function obterConfigNivel(nivel) {
  return CONFIG_NIVEL[nivel] || CONFIG_NIVEL.info;
}

export default function AlertList({ alerts = [], onNavigate = null, onResolveAlert = null }) {
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
      {alerts.map((alert) => {
        const config = obterConfigNivel(alert.nivel);
        const navegavel = typeof onNavigate === 'function' && alert?.pagina;

        return (
          <div
            key={alert.id}
            className={`alert-item ${config.classeItem}`}
            onClick={() => abrirPagina(alert)}
            onKeyDown={(e) => e.key === 'Enter' && abrirPagina(alert)}
            role={navegavel ? 'button' : undefined}
            tabIndex={navegavel ? 0 : undefined}
            style={navegavel ? { cursor: 'pointer' } : undefined}
            aria-label={navegavel ? `${alert.titulo} — clique para abrir a página relacionada` : undefined}
          >
            <div
              className={`alert-icon ${config.classeIcone}`}
              aria-hidden="true"
            >
              {config.icone}
            </div>

            <div className="alert-txt" style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <strong>{alert.titulo}</strong>
                <span className="alert-tipo-badge">
                  {alert.tipoLabel || 'Geral'}
                </span>
              </div>
              <span>{alert.mensagem}</span>
            </div>

            {onResolveAlert && (
              <button
                type="button"
                onClick={(e) => marcarComoFeito(e, alert)}
                className="action-btn"
                style={{ marginLeft: 12, whiteSpace: 'nowrap' }}
                aria-label={`Marcar alerta "${alert.titulo}" como resolvido`}
              >
                Feito
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}