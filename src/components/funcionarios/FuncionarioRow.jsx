function iniciais(nome) {
  return String(nome || 'US')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function FuncionarioRow({ funcionario, fazendaNome = '—', onEdit, onDesativar, onReativar, onDesligar }) {
  if (!funcionario) return null;

  const status = funcionario.status || 'ativo';
  const ativo = status === 'ativo';
  const desligado = status === 'desligado';

  return (
    <div
      className="funcionario-row"
      onClick={onEdit}
      onKeyDown={(e) => e.key === 'Enter' && onEdit?.()}
      role="button"
      tabIndex={0}
      aria-label={`Editar funcionário ${funcionario.nome}`}
    >
      <div className="funcionario-avatar" aria-hidden="true">
        {iniciais(funcionario.nome)}
      </div>

      <div className="funcionario-main">
        <div className="funcionario-nome">{funcionario.nome}</div>
        <div className="funcionario-cargo">
          {funcionario.cargo || '—'} · {fazendaNome}
        </div>
      </div>

      <div className="funcionario-phone">{funcionario.telefone || funcionario.email || '—'}</div>

      <span className={`funcionario-status ${ativo ? 'badge-ativo' : desligado ? 'badge-r' : 'badge-inativo'}`}>{ativo ? 'Ativo' : desligado ? 'Desligado' : 'Inativo'}</span>
      <div className="row-actions row-actions--tight" onClick={(e) => e.stopPropagation()}>
        {ativo ? <button className="action-btn" onClick={onDesativar}>Desativar</button> : <button className="action-btn" onClick={onReativar}>Reativar</button>}
        {!desligado ? <button className="action-btn action-btn-danger" onClick={onDesligar}>Marcar desligado</button> : null}
      </div>
    </div>
  );
}
