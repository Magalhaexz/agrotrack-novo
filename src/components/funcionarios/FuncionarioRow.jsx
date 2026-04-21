function iniciais(nome) {
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
