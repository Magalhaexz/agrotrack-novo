export function UserAvatar({ usuario, size = 36 }) {
  const getInitials = (nome) => {
    if (!nome) return 'U';
    const partes = nome.trim().split(' ');
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();

    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
  };

  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    fontWeight: 700,
    fontSize: size * 0.38,
    border: '2px solid var(--color-border)',
    flexShrink: 0,
    cursor: 'pointer',
  };

  if (usuario?.foto_url) {
    return (
      <div style={style}>
        <img
          src={usuario.foto_url}
          alt={usuario.nome || 'Usuário'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  return <div style={style}>{getInitials(usuario?.nome)}</div>;
}

export default UserAvatar;
