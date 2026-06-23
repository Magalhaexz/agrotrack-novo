export default function ConnectionIndicator({ online = true, pendentes = 0 }) {
  if (!online) {
    return (
      <span className="connection-indicator connection-indicator--offline" role="status">
        <span className="connection-indicator__label">
          Sem internet. Os registros serão salvos neste aparelho e sincronizados quando a conexão voltar.
        </span>
      </span>
    );
  }

  if (pendentes > 0) {
    return (
      <span className="connection-indicator connection-indicator--pending" role="status">
        <span className="connection-indicator__label">
          {pendentes} {pendentes === 1 ? 'registro aguardando sincronização' : 'registros aguardando sincronização'}
        </span>
      </span>
    );
  }

  return (
    <span className="connection-indicator connection-indicator--online" role="status">
      <span className="connection-indicator__label">Conectado</span>
    </span>
  );
}
