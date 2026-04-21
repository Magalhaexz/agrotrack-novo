function iniciais(nome) {
<<<<<<< HEAD
  return String(nome || 'US')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export default function FuncionarioRow({ funcionario, fazendaNome = '—', onEdit }) {
  if (!funcionario) return null;

  const status = funcionario.status || 'ativo';
  const ativo = status === 'ativo';

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

      <div style={{ flex: 1 }}>
        <div className="funcionario-nome">{funcionario.nome}</div>
        <div className="funcionario-cargo">
          {funcionario.cargo || '—'} · {fazendaNome}
        </div>
      </div>

      <div style={{ minWidth: 140, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>
        {funcionario.telefone || '—'}
      </div>

      <span className={ativo ? 'badge-ativo' : 'badge-inativo'}>
        {ativo ? 'Ativo' : 'Inativo'}
      </span>
    </div>
  );
}
=======
  return String(nome || 'US').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function FuncionarioRow({ funcionario, fazendaNome = '—', onEdit }) {
  return (
    <div className="funcionario-row" onClick={onEdit}>
      <div className="funcionario-avatar">{iniciais(funcionario.nome)}</div>
      <div style={{ flex: 1 }}>
        <div className="funcionario-nome">{funcionario.nome}</div>
        <div className="funcionario-cargo">{funcionario.cargo || '—'} · {fazendaNome}</div>
      </div>
      <div style={{ minWidth: 140, color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>{funcionario.telefone || '—'}</div>
      <span className={(funcionario.status || 'ativo') === 'ativo' ? 'badge-ativo' : 'badge-inativo'}>
        {(funcionario.status || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
      </span>
    </div>
  );
}
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
