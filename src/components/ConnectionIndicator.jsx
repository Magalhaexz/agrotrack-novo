export default function ConnectionIndicator({ online = true, pendentes = 0 }) {
  if (!online) {
    return (
      <span className="connection-indicator connection-indicator--offline" role="status">
        Sem internet. Os registros serão salvos neste aparelho e sincronizados quando a conexão voltar.
      </span>
    );
  }

  if (pendentes > 0) {
    return (
      <span className="connection-indicator connection-indicator--pending" role="status">
        {pendentes} {pendentes === 1 ? 'registro aguardando sincronização' : 'registros aguardando sincronização'}
      </span>
    );
  }

  return (
    <span className="connection-indicator connection-indicator--online" role="status">
      Conectado
    </span>
  );
}
